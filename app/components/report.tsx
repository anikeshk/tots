import type { DiscourseRole, TotsAssessment } from "../../agent/lib/schemas";
import { Prob, Verdict } from "./badges";

function Card({ title, children, className = "" }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 ${className}`}>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{title}</h2>
      {children}
    </section>
  );
}

const ROLE_STYLES: Record<DiscourseRole, string> = {
  maintainer: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  cna: "bg-zinc-700 text-white dark:bg-zinc-300 dark:text-zinc-900",
  reporter: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  vuln_db: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  scanner_vendor: "bg-zinc-200 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100",
  community: "border border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400",
};

const STANCE_STYLES = {
  supports: "text-rose-700 dark:text-rose-300",
  disputes: "text-emerald-700 dark:text-emerald-300",
  neutral: "text-zinc-600 dark:text-zinc-400",
} as const;

const JEV_LABELS: Record<string, string> = {
  bug_exists: "Bug exists in some version",
  target_affected: "Target version affected",
  reproduced_on_target: "Reproduced on target",
  positive_control_reproduced: "Positive control reproduced",
  patch_addresses_claim: "Patch addresses the issue",
  impact_matches_description: "Impact matches description",
  credible_dispute_exists: "Credible dispute exists",
  evidence_sufficient: "Evidence sufficient",
};

export function Report({ assessment: a }: { assessment: TotsAssessment }) {
  return (
    <div className="space-y-6">
      <Card title="Why this label">
        <ol className="space-y-1 font-mono text-xs">
          {a.policyTrace.map((line, i) => (
            <li key={i} className={line.startsWith("→") ? "font-semibold" : "text-zinc-600 dark:text-zinc-400"}>
              {line}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
          Generated {a.generatedAt.replace("T", " ").slice(0, 16)} UTC · investigators {a.models.technical} · judge{" "}
          {a.models.judge}
        </p>
      </Card>

      <Card title="Claims">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="py-2 pr-4 font-medium">Claim</th>
                <th className="py-2 pr-4 font-medium">Verdict</th>
                <th className="py-2 pr-4 font-medium">Technically supported</th>
                <th className="py-2 font-medium">Credibly disputed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {a.claims.map((c) => (
                <tr key={c.id} className={c.id === "target" ? "bg-zinc-50 dark:bg-zinc-800/40" : ""}>
                  <td className="py-2 pr-4">
                    <div className={c.id === "target" ? "font-medium" : ""}>{c.text}</div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-400">
                      {c.kind} · asserted by {c.assertedBy.join(", ")}
                    </div>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <Verdict verdict={c.verdict} />
                  </td>
                  <td className="py-2 pr-4">
                    <Prob value={a.jev.claims[c.id]?.technicallySupported ?? 0} />
                  </td>
                  <td className="py-2">
                    <Prob value={a.jev.claims[c.id]?.crediblyDisputed ?? 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Technical evidence">
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="text-xs text-zinc-600 dark:text-zinc-400">Fix</dt>
              <dd className="break-all">
                {a.technical.fixReference ? (
                  <a href={a.technical.fixReference} className="underline underline-offset-2" target="_blank" rel="noreferrer">
                    {a.technical.fixReference}
                  </a>
                ) : (
                  "Not identified"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-600 dark:text-zinc-400">Vulnerable code</dt>
              <dd>{a.technical.vulnerableCode ?? "Not identified"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-600 dark:text-zinc-400">PoC</dt>
              <dd>{a.technical.poc.description}</dd>
              <details className="mt-1">
                <summary className="cursor-pointer text-xs text-zinc-600 dark:text-zinc-400">Script</summary>
                <pre className="mt-1 max-h-72 overflow-auto rounded bg-zinc-100 p-2 font-mono text-xs dark:bg-zinc-950">
                  {a.technical.poc.script}
                </pre>
              </details>
            </div>
          </dl>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-xs text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="py-1 pr-3 font-medium">Version</th>
                <th className="py-1 pr-3 font-medium">Role</th>
                <th className="py-1 font-medium">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 align-top dark:divide-zinc-800">
              {a.technical.versionsTested.map((v, i) => (
                <tr key={i}>
                  <td className="py-2 pr-3 font-mono text-xs">{v.version}</td>
                  <td className="py-2 pr-3 text-xs text-zinc-600 dark:text-zinc-400">{v.role.replace("_", " ")}</td>
                  <td className="py-2 text-xs">
                    <span className="font-mono font-semibold">
                      {v.reproduced === null ? "not run" : v.reproduced ? "reproduced" : "not reproduced"}
                    </span>
                    <div className="text-zinc-600 dark:text-zinc-400">{v.observation}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {a.technical.notes && <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{a.technical.notes}</p>}
        </Card>

        <Card title="Discourse evidence">
          <p className="mb-3 text-sm">{a.discourse.summary}</p>
          <ul className="space-y-3">
            {a.discourse.items.map((item, i) => (
              <li key={i} className="text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded px-1.5 py-0.5 font-mono ${ROLE_STYLES[item.role]}`}>{item.role.replace("_", " ")}</span>
                  <a href={item.url} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
                    {item.speaker}
                  </a>
                  <span className={`font-mono ${STANCE_STYLES[item.stance]}`}>
                    {item.stance} {item.claimId}
                  </span>
                  {item.date && <span className="text-zinc-500 dark:text-zinc-400">{item.date.slice(0, 10)}</span>}
                </div>
                <blockquote className="mt-1 border-l-2 border-zinc-300 pl-3 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                  {item.quote}
                </blockquote>
              </li>
            ))}
          </ul>
          {a.discourse.unresolved.length > 0 && (
            <div className="mt-4">
              <h3 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Unresolved</h3>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
                {a.discourse.unresolved.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Jev scores">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {Object.entries(a.jev.global).map(([key, value]) => (
                <tr key={key}>
                  <td className="py-1.5 pr-4">{JEV_LABELS[key] ?? key}</td>
                  <td className="py-1.5">
                    <Prob value={value} />
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-1.5 pr-4">Authority of dispute (0 none – 3 maintainer)</td>
                <td className="py-1.5 font-mono text-xs">{a.jev.authorityOfDispute.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </Card>

        <Card title="Official record">
          <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">{a.record.description}</p>
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-zinc-600 dark:text-zinc-400">
              <tr>
                <th className="py-1 pr-3 font-medium">Source</th>
                <th className="py-1 pr-3 font-medium">Affected ranges</th>
                <th className="py-1 font-medium">Covers target?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {a.record.ranges.map((r) => (
                <tr key={`${r.source}-${r.id}`}>
                  <td className="py-1.5 pr-3">
                    <a href={r.url} target="_blank" rel="noreferrer" className="font-mono text-xs uppercase underline-offset-2 hover:underline">
                      {r.source}
                    </a>
                  </td>
                  <td className="py-1.5 pr-3 font-mono text-xs">{r.ranges.join(" || ") || "—"}</td>
                  <td className="py-1.5 font-mono text-xs">{r.affectsTarget === null ? "—" : r.affectsTarget ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">
            OSV reports for this exact version: {a.record.osvTargetVulns.length ? a.record.osvTargetVulns.join(", ") : "none"}
            {a.record.cvss ? ` · CVSS ${a.record.cvss.score} ${a.record.cvss.severity}` : ""}
            {a.record.cwes.length ? ` · ${a.record.cwes.join(", ")}` : ""}
          </p>
        </Card>
      </div>

      <Card title="Evidence quality">
        <ul className="grid gap-1 text-sm sm:grid-cols-2">
          {a.evidenceQuality.map((q) => (
            <li key={q.check} className="flex items-center gap-2">
              <span className="w-4 font-mono">{q.ok === null ? "–" : q.ok ? "✓" : "✗"}</span>
              {q.check}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
