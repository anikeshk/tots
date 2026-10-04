import Link from "next/link";
import { listTargets } from "../agent/lib/db";
import { liveRuns } from "../flags";
import { AddCveForm } from "./components/add-cve-form";
import { reportPath } from "../agent/lib/schemas";
import { LabelBadge, OfficialBadge } from "./components/badges";
import { CodeSignal, PeopleSignal } from "./components/signals";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [targets, enabled] = await Promise.all([listTargets(), liveRuns()]);

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Is this CVE real for this package version?</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          A published CVE can still be disputed, overstated, or wrongly scoped. For each CVE and package version, TOTS
          runs two independent investigations: one tests the code in a sandbox, and one collects what maintainers,
          databases, and vendors have said. A judge model (Jev) scores the evidence, and a fixed policy turns those
          scores into the label.
        </p>
      </section>

      <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 text-xs uppercase tracking-wide text-zinc-600 dark:text-zinc-400 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3 font-medium">CVE</th>
              <th className="px-4 py-3 font-medium">Package version</th>
              <th className="px-4 py-3 font-medium">Official</th>
              <th className="px-4 py-3 font-medium">TOTS</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Code</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">People</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {targets.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-600 dark:text-zinc-400">
                  No assessments yet.
                </td>
              </tr>
            )}
            {targets.map((t) => (
              <tr key={t.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                <td className="px-4 py-3 font-mono">
                  <Link href={reportPath(t.cve_id, t.purl)} className="font-medium underline-offset-4 hover:underline">
                    {t.cve_id}
                  </Link>
                </td>
                <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-400">{t.purl.replace("pkg:npm/", "")}</td>
                <td className="px-4 py-3">
                  {t.latest?.assessment ? <OfficialBadge state={t.latest.assessment.official.state} /> : "—"}
                </td>
                <td className="px-4 py-3">
                  {t.active ? (
                    <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">running · {t.active.stage ?? "queued"}</span>
                  ) : (
                    <LabelBadge label={t.latest?.label ?? null} />
                  )}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  {t.latest?.assessment ? <CodeSignal a={t.latest.assessment} /> : null}
                </td>
                <td className="hidden px-4 py-3 md:table-cell">
                  {t.latest?.assessment ? <PeopleSignal a={t.latest.assessment} /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <AddCveForm enabled={enabled} />
    </div>
  );
}
