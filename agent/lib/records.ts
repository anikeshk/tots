import semver from "semver";
import { github, type GitHubAdvisory } from "./github";
import { parsePurl, type CveRecord, type OfficialState, type RangeStatement } from "./schemas";

// Fetches the official record from NVD, GitHub Advisories, and OSV with plain HTTP (no LLM),
// keeping each source's own version range so disagreement between sources stays visible.

interface NvdCve {
  id: string;
  vulnStatus: string;
  cveTags?: { tags: string[] }[];
  descriptions: { lang: string; value: string }[];
  weaknesses?: { description: { value: string }[] }[];
  metrics?: Record<string, { cvssData: { baseScore: number; baseSeverity: string; vectorString: string } }[]>;
  configurations?: { nodes: { cpeMatch: NvdCpeMatch[] }[] }[];
  references: { url: string }[];
}

interface NvdCpeMatch {
  vulnerable: boolean;
  criteria: string;
  versionStartIncluding?: string;
  versionStartExcluding?: string;
  versionEndIncluding?: string;
  versionEndExcluding?: string;
}

interface OsvVuln {
  id: string;
  aliases?: string[];
  affected?: {
    package?: { name: string; ecosystem: string };
    ranges?: { type: string; events: Record<string, string>[] }[];
    versions?: string[];
  }[];
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  const response = await fetch(url, init);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return (await response.json()) as T;
}

function cpeProduct(criteria: string) {
  // cpe:2.3:a:vendor:product:version:...
  return criteria.split(":")[4] ?? "";
}

function nvdRange(match: NvdCpeMatch) {
  const parts = [
    match.versionStartIncluding && `>=${match.versionStartIncluding}`,
    match.versionStartExcluding && `>${match.versionStartExcluding}`,
    match.versionEndIncluding && `<=${match.versionEndIncluding}`,
    match.versionEndExcluding && `<${match.versionEndExcluding}`,
  ].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  const version = match.criteria.split(":")[5];
  return version && version !== "*" ? `=${version}` : "*";
}

function osvRanges(vuln: OsvVuln, name: string) {
  const ranges: string[] = [];
  for (const affected of vuln.affected ?? []) {
    if (affected.package?.ecosystem !== "npm" || affected.package.name !== name) continue;
    for (const range of affected.ranges ?? []) {
      if (range.type !== "SEMVER") continue;
      let lower: string | undefined;
      for (const event of range.events) {
        if (event.introduced !== undefined) lower = event.introduced;
        const upper = event.fixed ? `<${event.fixed}` : event.last_affected ? `<=${event.last_affected}` : null;
        if (upper) {
          ranges.push(`${lower && lower !== "0" ? `>=${lower} ` : ""}${upper}`);
          lower = undefined;
        }
      }
      if (lower !== undefined) ranges.push(lower === "0" ? "*" : `>=${lower}`);
    }
  }
  return ranges;
}

function covers(ranges: string[], version: string): boolean | null {
  if (ranges.length === 0) return null;
  return ranges.some((range) => semver.satisfies(version, range, { includePrerelease: true }));
}

export async function fetchCveRecord(cveId: string, purl: string): Promise<CveRecord> {
  const target = parsePurl(purl);

  const [nvdResponse, advisories, osvCve, osvTarget] = await Promise.all([
    getJson<{ vulnerabilities: { cve: NvdCve }[] }>(
      `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${cveId}`,
    ),
    github<GitHubAdvisory[]>(`/advisories?cve_id=${cveId}&ecosystem=npm`),
    getJson<OsvVuln>(`https://api.osv.dev/v1/vulns/${cveId}`),
    getJson<{ vulns?: { id: string; aliases?: string[] }[] }>("https://api.osv.dev/v1/query", {
      method: "POST",
      body: JSON.stringify({ package: { purl: target.purl } }),
    }),
  ]);

  const nvd = nvdResponse?.vulnerabilities[0]?.cve ?? null;
  const ranges: RangeStatement[] = [];

  if (nvd) {
    const matches = (nvd.configurations ?? [])
      .flatMap((config) => config.nodes)
      .flatMap((node) => node.cpeMatch)
      .filter((match) => match.vulnerable && cpeProduct(match.criteria) === target.name.replace(/^@[^/]+\//, ""));
    const nvdRanges = matches.map(nvdRange);
    ranges.push({
      source: "nvd",
      id: cveId,
      url: `https://nvd.nist.gov/vuln/detail/${cveId}`,
      ranges: nvdRanges,
      affectsTarget: nvdRanges.includes("*") ? true : covers(nvdRanges, target.version),
    });
  }

  for (const advisory of advisories) {
    const packageRanges = advisory.vulnerabilities
      .filter((v) => v.package.ecosystem === "npm" && v.package.name === target.name)
      .map((v) => v.vulnerable_version_range?.replace(/,\s*/g, " ") ?? "*");
    ranges.push({
      source: "ghsa",
      id: advisory.ghsa_id,
      url: advisory.html_url,
      ranges: packageRanges,
      affectsTarget: advisory.withdrawn_at ? false : covers(packageRanges, target.version),
    });
  }

  // OSV's CVE record often lacks package ranges; its GHSA records carry the npm ranges.
  const osvRecords = [
    osvCve,
    ...(await Promise.all(
      advisories.map((a) => getJson<OsvVuln>(`https://api.osv.dev/v1/vulns/${a.ghsa_id}`)),
    )),
  ].filter((v): v is OsvVuln => v !== null);
  const osvRangeList = [...new Set(osvRecords.flatMap((v) => osvRanges(v, target.name)))];
  if (osvRecords.length > 0) {
    const id = osvRecords.find((v) => osvRanges(v, target.name).length > 0)?.id ?? osvRecords[0]!.id;
    ranges.push({
      source: "osv",
      id,
      url: `https://osv.dev/vulnerability/${id}`,
      ranges: osvRangeList,
      affectsTarget: osvRangeList.includes("*") ? true : covers(osvRangeList, target.version),
    });
  }

  const description =
    nvd?.descriptions.find((d) => d.lang === "en")?.value ?? advisories[0]?.summary ?? "";
  const tags = (nvd?.cveTags ?? []).flatMap((t) => t.tags);
  let state: OfficialState = "UNKNOWN";
  if (nvd) {
    if (nvd.vulnStatus === "Rejected") state = "REJECTED";
    else if (tags.includes("disputed") || description.startsWith("** DISPUTED")) state = "DISPUTED";
    else state = "PUBLISHED";
  }

  const metric = Object.values(nvd?.metrics ?? {}).flat()[0]?.cvssData;
  const cwes = [
    ...new Set((nvd?.weaknesses ?? []).flatMap((w) => w.description.map((d) => d.value))),
  ].filter((cwe) => cwe.startsWith("CWE-"));

  const references = [
    ...new Set([
      ...(nvd?.references.map((r) => r.url) ?? []),
      ...advisories.flatMap((a) => [a.html_url, ...a.references]),
    ]),
  ];

  return {
    cveId,
    target,
    official: { state, nvdStatus: nvd?.vulnStatus ?? null },
    description,
    cwes,
    cvss: metric
      ? { score: metric.baseScore, severity: metric.baseSeverity, vector: metric.vectorString }
      : null,
    ghsaIds: advisories.map((a) => a.ghsa_id),
    ranges,
    osvTargetVulns: (osvTarget?.vulns ?? []).flatMap((v) => [v.id, ...(v.aliases ?? [])]),
    references,
  };
}
