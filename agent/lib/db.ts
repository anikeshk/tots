import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { TotsAssessment } from "./schemas";

// Lazily created so `next build` and `eve build` work without DATABASE_URL.
let client: NeonQueryFunction<false, false> | undefined;

export function sql() {
  if (!client) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    client = neon(url);
  }
  return client;
}

export type RunStatus = "queued" | "running" | "succeeded" | "failed";

export interface TargetRow {
  id: string;
  cve_id: string;
  purl: string;
  created_at: string;
}

export interface RunRow {
  id: string;
  target_id: string;
  status: RunStatus;
  session_id: string | null;
  stage: string | null;
  label: string | null;
  assessment: TotsAssessment | null;
  error: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TargetSummary extends TargetRow {
  latest: Pick<RunRow, "id" | "status" | "label" | "finished_at" | "assessment"> | null;
  active: Pick<RunRow, "id" | "status" | "session_id" | "stage"> | null;
}

/** Inserts the target if new and queues a run for it. Only server-side, flag-checked code calls this. */
export async function queueRun(cveId: string, purl: string) {
  const db = sql();
  const [target] = (await db`
    INSERT INTO targets (cve_id, purl) VALUES (${cveId}, ${purl})
    ON CONFLICT (cve_id, purl) DO UPDATE SET cve_id = EXCLUDED.cve_id
    RETURNING *`) as TargetRow[];
  const [run] = (await db`
    INSERT INTO runs (target_id, status) VALUES (${target!.id}, 'queued')
    RETURNING id`) as { id: string }[];
  return { targetId: target!.id, runId: run!.id };
}

/** Atomically moves a queued run to running. Returns null if the run is unknown or already claimed. */
export async function claimRun(runId: string, sessionId: string) {
  const rows = (await sql()`
    UPDATE runs r SET status = 'running', session_id = ${sessionId}, started_at = now(), stage = 'record'
    FROM targets t
    WHERE r.id = ${runId} AND r.status = 'queued' AND t.id = r.target_id
    RETURNING r.id, t.cve_id, t.purl`) as { id: string; cve_id: string; purl: string }[];
  return rows[0] ?? null;
}

export async function setStage(runId: string, stage: string) {
  await sql()`UPDATE runs SET stage = ${stage} WHERE id = ${runId}`;
}

export async function completeRun(runId: string, assessment: TotsAssessment) {
  await sql()`
    UPDATE runs SET status = 'succeeded', stage = 'done', label = ${assessment.label},
      assessment = ${JSON.stringify(assessment)}::jsonb, finished_at = now()
    WHERE id = ${runId}`;
}

export async function failRun(runId: string, error: string) {
  await sql()`
    UPDATE runs SET status = 'failed', error = ${error.slice(0, 2000)}, finished_at = now()
    WHERE id = ${runId} AND status <> 'succeeded'`;
}

export async function listTargets(): Promise<TargetSummary[]> {
  return (await sql()`
    SELECT t.*,
      (SELECT row_to_json(x) FROM (
        SELECT r.id, r.status, r.label, r.finished_at, r.assessment FROM runs r
        WHERE r.target_id = t.id AND r.status = 'succeeded'
        ORDER BY r.finished_at DESC LIMIT 1) x) AS latest,
      (SELECT row_to_json(y) FROM (
        SELECT r.id, r.status, r.session_id, r.stage FROM runs r
        WHERE r.target_id = t.id AND r.status IN ('queued', 'running')
        ORDER BY r.created_at DESC LIMIT 1) y) AS active
    FROM targets t
    ORDER BY t.created_at ASC`) as TargetSummary[];
}

export async function getTarget(id: string) {
  const [target] = (await sql()`SELECT * FROM targets WHERE id = ${id}`) as TargetRow[];
  if (!target) return null;
  const runs = (await sql()`
    SELECT * FROM runs WHERE target_id = ${id} ORDER BY created_at DESC LIMIT 20`) as RunRow[];
  return { target, runs };
}

export async function getRun(id: string) {
  const [run] = (await sql()`SELECT * FROM runs WHERE id = ${id}`) as RunRow[];
  return run ?? null;
}
