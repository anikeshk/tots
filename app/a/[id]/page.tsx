import Link from "next/link";
import { notFound } from "next/navigation";
import { getTarget } from "../../../agent/lib/db";
import { liveRuns } from "../../../flags";
import { LabelBadge, OfficialBadge } from "../../components/badges";
import { LiveRun } from "../../components/live-run";
import { Report } from "../../components/report";

export const dynamic = "force-dynamic";

export default async function AssessmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [found, enabled] = await Promise.all([getTarget(id), liveRuns()]);
  if (!found) notFound();

  const { target, runs } = found;
  const latest = runs.find((r) => r.status === "succeeded" && r.assessment);
  const active = runs.find((r) => r.status === "queued" || r.status === "running") ?? null;
  const lastFailed = runs[0]?.status === "failed" ? runs[0] : null;

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-zinc-500 hover:underline">
        ← All assessments
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-mono text-2xl font-semibold">{target.cve_id}</h1>
          <p className="font-mono text-zinc-600 dark:text-zinc-400">{target.purl}</p>
          <div className="flex flex-wrap items-center gap-2">
            {latest?.assessment && <OfficialBadge state={latest.assessment.official.state} />}
            <LabelBadge label={latest?.label ?? null} large />
          </div>
        </div>
        <LiveRun
          targetId={target.id}
          active={active ? { id: active.id, status: active.status, stage: active.stage } : null}
          enabled={enabled}
          lastError={lastFailed?.error ?? null}
        />
      </header>

      {latest?.assessment ? (
        <Report assessment={latest.assessment} />
      ) : (
        !active && <p className="text-zinc-500">No completed assessment yet.</p>
      )}

      {runs.length > 1 && (
        <section className="text-xs text-zinc-500">
          <h2 className="mb-1 font-semibold uppercase tracking-wide">Run history</h2>
          <ul className="space-y-0.5 font-mono">
            {runs.map((r) => (
              <li key={r.id}>
                {new Date(r.created_at).toISOString().replace("T", " ").slice(0, 16)} · {r.status}
                {r.label ? ` · ${r.label}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
