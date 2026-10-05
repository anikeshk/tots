import type { Metadata } from "next";
import Link from "next/link";
import { Lifecycle } from "./lifecycle";

export const metadata: Metadata = { title: "Anatomy of a CVE · TOTS" };

type Stage = {
  n: string;
  title: string;
  who: string;
  body: React.ReactNode;
  examples?: { name: string; note: string }[];
  tots?: string;
};

const STAGES: Stage[] = [
  {
    n: "01",
    title: "Discovery",
    who: "Researcher, user, or maintainer",
    body: "Someone notices the code doing something it shouldn't. For now it's a bug with a theory attached.",
  },
  {
    n: "02",
    title: "Report",
    who: "Finder → maintainer",
    body: "Ideally in private: a SECURITY.md contact, GitHub's private reporting, or a coordinator like CERT/CC. Posting it publicly first makes it a zero-day.",
  },
  {
    n: "03",
    title: "Triage",
    who: "Maintainer",
    body: "The maintainer tries to reproduce it and decides if it's a security issue at all. “That's documented behaviour” is a common, sometimes correct, answer.",
  },
  {
    n: "04",
    title: "CVE ID reserved",
    who: "A CNA",
    body: "A CNA (for npm, usually GitHub or MITRE) assigns an ID like CVE-2024-10491. It can do this even if the maintainer disagrees.",
    examples: [
      { name: "CVE-2024-10491", note: "the official ID: year, then a number" },
      { name: "GHSA-xxxx-xxxx-xxxx", note: "GitHub's advisory ID, often an alias of a CVE" },
      { name: "CWE-1333", note: "a bug type, not a vulnerability ID" },
    ],
  },
  {
    n: "05",
    title: "Discussion",
    who: "Finder, maintainer, sometimes a coordinator",
    body: "They agree on how severe it is, which versions it affects, and when to go public. Usually that's quick. When they don't agree, the debate carries on in public issues and PRs, and can end with the record tagged DISPUTED or REJECTED.",
    tots: "The discourse investigator reads these conversations: who said what, in what role.",
  },
  {
    n: "06",
    title: "Fix, or not",
    who: "Maintainer",
    body: "Usually a patched release. Sometimes a workaround, a docs change, or no fix because the behaviour is intended.",
  },
  {
    n: "07",
    title: "Publication",
    who: "CNA, maintainer",
    body: "The CVE record goes public with a description and affected versions. Advisories and release notes appear alongside it.",
  },
  {
    n: "08",
    title: "Enrichment",
    who: "NVD, GitHub, OSV",
    body: "Each database adds its own severity score and machine-readable version range. They usually match; occasionally one lists different versions.",
    tots: "TOTS reads all three and keeps each source's range, so a mismatch shows up instead of being hidden.",
  },
  {
    n: "09",
    title: "Scanners alert",
    who: "Scanners, users",
    body: "Scanners match your dependencies against those databases and alert on every installed version in range, whether or not your code uses the vulnerable feature.",
    examples: [
      { name: "npm audit", note: "reads GitHub Advisory Database" },
      { name: "Dependabot", note: "reads GitHub Advisory Database" },
      { name: "OSV-Scanner", note: "reads OSV" },
      { name: "Trivy", note: "reads GitHub, NVD, and others" },
      { name: "Grype", note: "reads GitHub, NVD, and others" },
    ],
  },
  {
    n: "10",
    title: "Upgrade",
    who: "Everyone using the package",
    body: "The longest stage. Old versions stay installed for years, and every team asks: does this apply to my version?",
    tots: "That's the question TOTS answers.",
  },
];


const GLOSSARY: { term: string; full: string; context: string }[] = [
  { term: "CVE", full: "Common Vulnerabilities and Exposures", context: "The public catalogue of vulnerabilities. Each entry has an ID like CVE-2024-10491 and a short record." },
  { term: "CNA", full: "CVE Numbering Authority", context: "An organisation allowed to assign CVE IDs, such as GitHub, MITRE, or a large vendor." },
  { term: "CVD", full: "Coordinated Vulnerability Disclosure", context: "The practice of fixing a bug privately before announcing it, so a patch exists on day one." },
  { term: "CERT/CC", full: "CERT Coordination Center", context: "Carnegie Mellon's coordinator that helps finders reach vendors. Wrote the CVD guide cited below." },
  { term: "MITRE", full: "The MITRE Corporation", context: "A US non-profit that runs the CVE Program and acts as a CNA of last resort." },
  { term: "NVD", full: "National Vulnerability Database", context: "Run by NIST (US National Institute of Standards and Technology). Adds scores and affected-product data to CVEs." },
  { term: "GHSA", full: "GitHub Security Advisory", context: "GitHub's advisory format and database. The main source for npm packages." },
  { term: "OSV", full: "Open Source Vulnerabilities", context: "Google's open database that merges advisories from many ecosystems, with precise version ranges." },
  { term: "CVSS", full: "Common Vulnerability Scoring System", context: "The 0–10 severity score. Describes the worst case, not your version or setup." },
  { term: "CWE", full: "Common Weakness Enumeration", context: "A list of bug types, e.g. CWE-1333 for slow regexes. Says what kind of bug, not whether it's real." },
  { term: "PoC", full: "Proof of Concept", context: "A minimal script that shows the bug happening. TOTS runs one in a sandbox against your version." },
  { term: "PR", full: "Pull Request", context: "A proposed code change on GitHub. Fixes and many arguments about CVEs live in PRs and issues." },
  { term: "SBOM", full: "Software Bill of Materials", context: "A list of every package and version in a piece of software. Scanners match it against CVEs." },
  { term: "VEX", full: "Vulnerability Exploitability eXchange", context: "A statement that a product is or isn't affected by a CVE. CycloneDX and OpenVEX are two formats for it." },
  { term: "TIP", full: "Threat Intelligence Platform", context: "A tool that collects security feeds for a security team." },
  { term: "purl", full: "Package URL", context: "A standard package identifier, e.g. pkg:npm/express@5.2.1." },
  { term: "npm", full: "Node Package Manager", context: "The JavaScript package registry. TOTS only covers npm packages for now." },
  { term: "HTTP(S)", full: "HyperText Transfer Protocol (Secure)", context: "How the web fetches data. TOTS reads NVD, GitHub, and OSV with plain HTTP calls." },
  { term: "OIDC", full: "OpenID Connect", context: "A sign-in standard. Vercel issues short-lived OIDC tokens so TOTS needs no stored API keys." },
  { term: "AI", full: "Artificial Intelligence", context: "Here: the language models that break down claims, investigate, and judge." },
];

export default function AnatomyOfACve() {
  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="space-y-3">
        <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">
          <Link href="/how-it-works" className="underline-offset-4 hover:underline">
            How it works
          </Link>{" "}
          / Anatomy of a CVE
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Anatomy of a CVE</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          A CVE is an ID for a publicly known vulnerability. By the time a scanner shows you one, it has passed through
          a lot of hands.
        </p>
      </header>

      <Lifecycle />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Step by step</h2>
        <ol className="space-y-2">
          {STAGES.map(({ n, title, who, body, examples, tots }) => (
            <li
              key={n}
              id={`stage-${n}`}
              className="scroll-mt-6 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{n}</span>
                <span className="font-medium">{title}</span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">{who}</span>
              </div>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</p>
              {examples && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {examples.map(({ name, note }) => (
                    <li key={name} className="rounded-md border border-zinc-200 px-2 py-0.5 text-xs dark:border-zinc-700">
                      <span className="font-mono font-medium">{name}</span>
                      <span className="text-zinc-500 dark:text-zinc-400"> · {note}</span>
                    </li>
                  ))}
                </ul>
              )}
              {tots && <p className="mt-2 text-sm font-medium text-sky-700 dark:text-sky-300">↳ {tots}</p>}
            </li>
          ))}
        </ol>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Real CVEs skip and overlap these steps: a bug is posted publicly first, or a CVE is published before any fix
          exists. That&apos;s why TOTS checks the code and reads the discussion instead of trusting the record.{" "}
          <Link href="/how-it-works" className="font-medium text-zinc-900 underline underline-offset-4 dark:text-zinc-100">
            See how it works →
          </Link>
        </p>
      </section>

      <section id="glossary" className="scroll-mt-6 space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Glossary</h2>
        <dl className="grid gap-2 sm:grid-cols-2">
          {GLOSSARY.map(({ term, full, context }) => (
            <div key={term} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <dt>
                <span className="font-mono text-xs font-semibold">{term}</span>{" "}
                <span className="text-sm font-medium">· {full}</span>
              </dt>
              <dd className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{context}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-2 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">Sources</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-zinc-600 dark:text-zinc-400">
          <li>
            <a className="underline underline-offset-4" href="https://certcc.github.io/CERT-Guide-to-CVD/topics/phases/">
              The CERT Guide to Coordinated Vulnerability Disclosure
            </a>
            , CERT/CC, Carnegie Mellon SEI (CMU/SEI-2017-SR-022). The disclosure phases.
          </li>
          <li>
            <a className="underline underline-offset-4" href="https://www.cve.org/About/Process">
              CVE Program: Process
            </a>
            , cve.org. The CVE record lifecycle and its states.
          </li>
          <li>
            <a
              className="underline underline-offset-4"
              href="https://www.cve.org/Resources/General/Policies/CVE-Record-Dispute-Policy.pdf"
            >
              CVE Record Dispute Policy
            </a>
            , cve.org. How disputes escalate and when a record is tagged DISPUTED.
          </li>
          <li>
            <a className="underline underline-offset-4" href="https://daniel.haxx.se/blog/2024/02/21/disputed-not-rejected/">
              DISPUTED, not REJECTED
            </a>
            , Daniel Stenberg (curl), 2024. A maintainer&apos;s view of a dispute.
          </li>
        </ul>
      </section>
    </div>
  );
}
