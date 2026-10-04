import { z } from "zod";

// Shared between the agent (tools, subagents, judge) and the Next.js UI.

export const Target = z.object({
  purl: z.string(),
  ecosystem: z.literal("npm"),
  name: z.string(),
  version: z.string(),
});
export type Target = z.infer<typeof Target>;

export const OfficialState = z.enum(["PUBLISHED", "DISPUTED", "REJECTED", "UNKNOWN"]);
export type OfficialState = z.infer<typeof OfficialState>;

/** One source's affected-range statement and whether it covers the target version. */
export const RangeStatement = z.object({
  source: z.enum(["nvd", "ghsa", "osv"]),
  id: z.string(),
  url: z.string(),
  ranges: z.array(z.string()),
  /** null when the source has no range for this package. */
  affectsTarget: z.boolean().nullable(),
});
export type RangeStatement = z.infer<typeof RangeStatement>;

export const CveRecord = z.object({
  cveId: z.string(),
  target: Target,
  official: z.object({ state: OfficialState, nvdStatus: z.string().nullable() }),
  description: z.string(),
  cwes: z.array(z.string()),
  cvss: z
    .object({ score: z.number(), severity: z.string(), vector: z.string() })
    .nullable(),
  ghsaIds: z.array(z.string()),
  ranges: z.array(RangeStatement),
  /** Vulnerability IDs OSV reports for the exact target purl. */
  osvTargetVulns: z.array(z.string()),
  references: z.array(z.string()),
});
export type CveRecord = z.infer<typeof CveRecord>;

export const ClaimKind = z.enum([
  "product",
  "versions",
  "auth",
  "vector",
  "impact",
  "reachability",
  "weakness",
  "target",
]);

export const Claim = z.object({
  id: z.string(),
  kind: ClaimKind,
  text: z.string(),
  assertedBy: z.array(z.string()),
});
export type Claim = z.infer<typeof Claim>;

export const ClaimList = z.object({ claims: z.array(Claim.omit({ id: true })) });

export const FindingStatus = z.enum(["supported", "contradicted", "not_tested"]);

export const TechnicalReport = z.object({
  fixReference: z
    .string()
    .nullable()
    .describe("URL of the fix commit, PR, or release that addresses the issue; null if not found"),
  vulnerableCode: z
    .string()
    .nullable()
    .describe("file/function of the vulnerable code path and one or two sentences on why it is vulnerable"),
  poc: z.object({
    description: z.string(),
    script: z.string().describe("The PoC script you ran, at most 2000 characters"),
  }),
  versionsTested: z.array(
    z.object({
      version: z.string(),
      role: z.enum(["target", "fixed", "positive_control", "other"]),
      reproduced: z.boolean().nullable(),
      observation: z.string().describe("What the PoC printed or measured, at most 400 characters"),
    }),
  ),
  findings: z.array(
    z.object({
      claimId: z.string(),
      status: FindingStatus,
      evidence: z.string().describe("At most 400 characters"),
    }),
  ),
  notes: z.string().describe("Caveats and anything you could not test, at most 600 characters"),
});
export type TechnicalReport = z.infer<typeof TechnicalReport>;

export const DiscourseRole = z.enum([
  "maintainer",
  "cna",
  "reporter",
  "vuln_db",
  "scanner_vendor",
  "community",
]);
export type DiscourseRole = z.infer<typeof DiscourseRole>;

export const DiscourseItem = z.object({
  speaker: z.string(),
  role: DiscourseRole,
  url: z.string(),
  quote: z.string().describe("Verbatim text copied from the source, at most 300 characters"),
  stance: z.enum(["supports", "disputes", "neutral"]),
  claimId: z.string(),
  date: z.string().nullable(),
});
export type DiscourseItem = z.infer<typeof DiscourseItem>;

export const DiscourseReport = z.object({
  items: z.array(DiscourseItem),
  unresolved: z.array(z.string()),
  summary: z.string().describe("At most 600 characters"),
});
export type DiscourseReport = z.infer<typeof DiscourseReport>;

export const Label = z.enum([
  "SUPPORTED",
  "LIKELY SUPPORTED",
  "DISPUTED",
  "LIKELY OVERSTATED",
  "LIKELY INVALID",
  "INSUFFICIENT EVIDENCE",
]);
export type Label = z.infer<typeof Label>;

export const ClaimVerdict = z.enum(["supported", "contradicted", "disputed", "unverified"]);
export type ClaimVerdict = z.infer<typeof ClaimVerdict>;

export const JudgeResult = z.object({
  global: z.record(z.string(), z.number()),
  claims: z.record(
    z.string(),
    z.object({ technicallySupported: z.number(), crediblyDisputed: z.number() }),
  ),
  authorityOfDispute: z.number().describe("0 none, 1 community, 2 vendor/db, 3 maintainer"),
  judgeModel: z.string(),
  confidence: z.record(z.string(), z.number()).optional(),
});
export type JudgeResult = z.infer<typeof JudgeResult>;

export const TotsAssessment = z.object({
  cveId: z.string(),
  target: Target,
  official: CveRecord.shape.official,
  record: CveRecord,
  claims: z.array(Claim.extend({ verdict: ClaimVerdict })),
  technical: TechnicalReport,
  discourse: DiscourseReport,
  jev: JudgeResult,
  label: Label,
  evidenceQuality: z.array(z.object({ check: z.string(), ok: z.boolean().nullable() })),
  policyTrace: z.array(z.string()),
  generatedAt: z.string(),
  models: z.record(z.string(), z.string()),
});
export type TotsAssessment = z.infer<typeof TotsAssessment>;

/** Parses `pkg:npm/name@version` and `pkg:npm/%40scope/name@version`. */
export function parsePurl(purl: string): Target {
  const match = /^pkg:npm\/(.+)@([^@/]+)$/.exec(purl.trim());
  if (!match) throw new Error(`Unsupported purl (npm only, with a version): ${purl}`);
  const name = decodeURIComponent(match[1]!);
  return { purl: `pkg:npm/${match[1]}@${match[2]}`, ecosystem: "npm", name, version: match[2]! };
}

export const CVE_ID = /^CVE-\d{4}-\d{4,}$/;
