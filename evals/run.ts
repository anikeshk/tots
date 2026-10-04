import type { TotsAssessment } from "../agent/lib/schemas";
import { getRun, queueRun } from "../agent/lib/db";

/** Queues a run, sends it to the agent under test, and returns the saved assessment. */
export async function investigate(
  t: { send: (message: string) => Promise<{ message?: string }> },
  cveId: string,
  purl: string,
): Promise<{ assessment: TotsAssessment | null; error: string | null }> {
  const { runId } = await queueRun(cveId, purl);
  await t.send(`Investigate run ${runId}`);
  const run = await getRun(runId);
  return { assessment: run?.assessment ?? null, error: run?.error ?? null };
}
