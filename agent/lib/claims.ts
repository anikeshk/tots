import { generateText, Output } from "ai";
import { model } from "./models";
import { ClaimList, type Claim, type CveRecord } from "./schemas";

/** Breaks the CVE description and per-source ranges into atomic claims, plus the target claim. */
export async function decomposeClaims(record: CveRecord, abortSignal?: AbortSignal): Promise<Claim[]> {
  const { output } = await generateText({
    model: model("claims"),
    abortSignal,
    output: Output.object({ schema: ClaimList }),
    system: [
      "You split a CVE record into atomic, independently checkable claims.",
      "Each claim states one thing: the affected product, a version range (one claim per source that",
      "states a range, naming the source), authentication requirement, attack vector, impact,",
      "remote reachability, or weakness type. Only include claims the record actually makes.",
      "Do not add a claim about the target version; that is added separately.",
      "assertedBy lists the sources making the claim, e.g. NVD, GHSA, OSV, or the CVE description.",
    ].join(" "),
    prompt: JSON.stringify({
      cveId: record.cveId,
      package: record.target.name,
      description: record.description,
      cwes: record.cwes,
      cvss: record.cvss,
      ranges: record.ranges.map(({ source, id, ranges }) => ({ source, id, ranges })),
    }),
  });

  const claims: Claim[] = output.claims
    .filter((claim) => claim.kind !== "target")
    .slice(0, 8)
    .map((claim, index) => ({ ...claim, id: `c${index + 1}` }));

  claims.push({
    id: "target",
    kind: "target",
    text: `${record.target.name}@${record.target.version} is affected by ${record.cveId}`,
    assertedBy: ["the scan or report under review"],
  });
  return claims;
}
