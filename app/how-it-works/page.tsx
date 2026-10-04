import type { Metadata } from "next";
import Link from "next/link";
import { listTargets } from "../../agent/lib/db";
import { reportPath, type Label } from "../../agent/lib/schemas";
import { LabelBadge } from "../components/badges";
import { CodeSignal, PeopleSignal } from "../components/signals";
import { Architecture } from "./architecture";

export const metadata: Metadata = { title: "How it works · TOTS" };
export const dynamic = "force-dynamic";

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="font-mono text-xs text-zinc-500 dark:text-zinc-400">{n}</div>
      <div className="mt-1 font-medium">{title}</div>
      <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{children}</div>
    </div>
  );
}

function Arrow() {
  return <div className="py-1 text-center font-mono text-zinc-500 dark:text-zinc-400">↓</div>;
}

function slug(title: string) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** A section whose heading is a shareable anchor link, e.g. /how-it-works#under-the-hood. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = slug(title);
  return (
    <section id={id} className="scroll-mt-6 space-y-3">
      <h2 className="group text-lg font-semibold tracking-tight">
        <a href={`#${id}`} className="inline-flex items-baseline gap-2 hover:underline hover:underline-offset-4">
          {title}
          <span
            aria-hidden
            className="font-mono text-zinc-500 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 dark:text-zinc-400"
          >
            #
          </span>
        </a>
      </h2>
      {children}
    </section>
  );
}

const LABELS: { label: Label; rule: string }[] = [
  { label: "INSUFFICIENT EVIDENCE", rule: "Checked first: not enough concrete evidence to decide." },
  { label: "DISPUTED", rule: "A credible dispute that the PoC doesn't settle either way." },
  { label: "LIKELY INVALID", rule: "The target looks unaffected: the PoC works on a vulnerable version but not the target, or maintainers dispute it." },
  { label: "LIKELY OVERSTATED", rule: "The bug is real on the target, but the claimed impact isn't what the evidence shows." },
  { label: "SUPPORTED", rule: "Reproduced on the target version, and no claim is credibly disputed." },
  { label: "LIKELY SUPPORTED", rule: "Probably affected, but not reproduced, with no strong dispute." },
];

const FUTURE: { title: string; body: React.ReactNode }[] = [
  {
    title: "TOTS as a threat-intel feed",
    body: (
      <>
        A read-only API that any scanner, SBOM tool, or TIP can query before it raises an alert:
        <pre className="mt-2 whitespace-pre-wrap break-words rounded bg-zinc-100 p-3 font-mono text-xs dark:bg-zinc-950">
          {`GET api.tots.dev/CVE-2024-10491?purl=pkg:npm/express@5.2.1

{
  "label": "DISPUTED",
  "code": "reproduces on 5.2.1",
  "maintainers": "dispute",
  "report": "https://tots-security.vercel.app/CVE-2024-10491/express@5.2.1"
}`}
        </pre>
      </>
    ),
  },
  {
    title: "VEX out of the box",
    body: "Emit CycloneDX/OpenVEX statements from the label (LIKELY INVALID → not_affected with the PoC as justification), so the assessment travels with the SBOM.",
  },
  {
    title: "In the pull request",
    body: "A GitHub app that comments on Dependabot and scanner PRs with the TOTS label, so reviewers stop arguing about the same CVE in every repo.",
  },
  {
    title: "Watch, don't snapshot",
    body: "eve schedules re-check an assessment when a fix ships, an advisory changes range, or a maintainer weighs in, and flag when a label flips.",
  },
];

export default async function HowItWorks() {
  const targets = await listTargets().catch(() => []);
  const example = targets.find((t) => t.latest?.label === "DISPUTED") ?? targets.find((t) => t.latest?.assessment);
  const a = example?.latest?.assessment ?? null;

  return (
    <div className="mx-auto max-w-3xl space-y-12">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">How TOTS works</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400">
          A CVE is a statement, not a verdict. Scanners repeat it, maintainers argue with it, and the version range
          drifts between databases. TOTS takes one CVE and one package version and asks the two questions a security
          engineer would: <em>does the code actually do this?</em> and <em>what do the people who own it say?</em>
        </p>
      </header>

      <Section title="The pipeline">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          One durable eve workflow runs every assessment. Each box is a step that survives restarts: if a model call
          fails halfway, the run resumes where it stopped instead of starting over.
        </p>
        <div>
          <Step n="01" title="Record">
            Fetch the CVE from NVD, the GitHub Advisory Database, and OSV with plain HTTP calls, with no model involved.
            Each source keeps its own version range, because disagreement between sources is evidence.
          </Step>
          <Arrow />
          <Step n="02" title="Claims">
            A model breaks the description into atomic claims (product, each source&apos;s range, auth, vector, impact),
            plus the one the label hinges on: <span className="font-mono">&lt;package@version&gt; is affected</span>.
          </Step>
          <Arrow />
          <div className="grid gap-3 sm:grid-cols-2">
            <Step n="03a" title="Technical investigator">
              Runs in an isolated Vercel Sandbox. Installs the target, the fixed version, and a known-vulnerable
              &ldquo;positive control&rdquo;, reads the patch, and runs one minimal PoC against all of them. It is
              blocked from reading issue threads, so opinions can&apos;t leak in.
            </Step>
            <Step n="03b" title="Discourse investigator">
              Reads advisories, GitHub issues and PRs, and vendor notes. Records who said what, with their role (using
              GitHub&apos;s own maintainer marker), a verbatim quote, and a link. No sentiment scores.
            </Step>
          </div>
          <p className="py-1 text-center text-xs text-zinc-600 dark:text-zinc-400">in parallel · neither sees the other&apos;s work</p>
          <Arrow />
          <Step n="04" title="Judge">
            Jev, an evaluation model, answers typed questions over both reports: is the target affected? Was it
            reproduced? Is there a credible dispute, and how authoritative is it? Each answer is a probability, not a
            paragraph.
          </Step>
          <Arrow />
          <Step n="05" title="Policy">
            Fixed thresholds turn those probabilities into a label. No model picks the label, and every report shows the
            rule that fired.
          </Step>
        </div>
      </Section>

      <Section title="The labels">
        <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
          {LABELS.map(({ label, rule }) => (
            <li key={label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:gap-4">
              <span className="sm:w-48 sm:shrink-0">
                <LabelBadge label={label} />
              </span>
              <span className="text-zinc-600 dark:text-zinc-400">{rule}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The official CVE status is always shown next to the label. TOTS doesn&apos;t override the CVE Program; it
          says how well the public evidence supports the claim for this version.
        </p>
      </Section>

      {a && example && (
        <Section title="A real one">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center gap-3">
              <Link href={reportPath(a.cveId, a.target.purl)} className="font-mono font-medium underline-offset-4 hover:underline">
                {a.cveId}
              </Link>
              <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{a.target.purl.replace("pkg:npm/", "")}</span>
              <LabelBadge label={a.label} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Code</div>
                <CodeSignal a={a} />
              </div>
              <div>
                <div className="mb-1 text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400">People</div>
                <PeopleSignal a={a} />
              </div>
            </div>
            <p className="mt-4 font-mono text-xs text-zinc-600 dark:text-zinc-400">{a.policyTrace.at(-1)}</p>
          </div>
          {a.label === "DISPUTED" && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              This is the case TOTS exists for. Scanners flag it, the maintainers say it doesn&apos;t apply, and the
              sandbox shows the behaviour is still there. Neither side is simply right, and the report shows both.
            </p>
          )}
        </Section>
      )}

      <Section title="Under the hood">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          TOTS is built on Vercel end to end. The site, the agent, the durable workflow, the sandbox, every model call,
          the feature flag, and the database all live in one Vercel project. The Vercel services authenticate with the
          project&apos;s OIDC token, so there are no AI provider keys to manage.
        </p>
        <Architecture />
        <ul className="grid gap-2 text-sm sm:grid-cols-2">
          {[
            ["eve", "Vercel's framework for durable agents: the workflow tool, both subagents, and their sandboxes"],
            ["Vercel Workflow", "Each run is a durable workflow; a crash or redeploy resumes it mid-step"],
            ["Vercel Sandbox", "Isolated microVMs for PoCs, egress limited to npm and GitHub"],
            ["Vercel AI Gateway", "One endpoint for Claude, OpenAI, and Jev, billed and observed in one place"],
            ["Vercel Flags", "Live runs are off by default; only a flag-checked server action can queue one"],
            ["Neon via Vercel Marketplace", "Postgres provisioned from the Vercel dashboard, env vars injected"],
            ["Next.js on Vercel", "This site, deployed alongside the agent with withEve"],
            ["Vercel OIDC", "Short-lived project tokens for the Gateway, Sandbox, and Flags; no provider API keys"],
          ].map(([name, what]) => (
            <li key={name} className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="font-mono text-xs font-semibold">{name}</div>
              <div className="text-zinc-600 dark:text-zinc-400">{what}</div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Where this could go">
        <div className="space-y-3">
          {FUTURE.map(({ title, body }) => (
            <div key={title} className="rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
              <div className="font-medium">{title}</div>
              <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{body}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
