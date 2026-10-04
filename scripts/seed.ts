import { Client } from "eve/client";
import { getRun, queueRun } from "../agent/lib/db";

// Runs the seed investigations against a running local app (`pnpm dev`), writing to the
// same database the deployment reads. Usage: pnpm seed [origin] [CVE-ID filter]
const SEEDS = [
  { cveId: "CVE-2024-45296", purl: "pkg:npm/path-to-regexp@6.2.2" },
  { cveId: "CVE-2024-10491", purl: "pkg:npm/express@5.2.1" },
];

const origin = process.argv[2] ?? "http://localhost:3000";
const only = process.argv[3];
const client = new Client({ host: origin });

const runs = await Promise.all(
  SEEDS.filter((seed) => !only || seed.cveId === only).map(async (seed) => {
    const { runId } = await queueRun(seed.cveId, seed.purl);
    await client.sessions.create({ message: `Investigate run ${runId}` });
    console.log(`started ${seed.cveId} ${seed.purl} (run ${runId})`);
    return { ...seed, runId };
  }),
);

const pending = new Set(runs.map((r) => r.runId));
while (pending.size > 0) {
  await new Promise((resolve) => setTimeout(resolve, 10_000));
  for (const run of runs.filter((r) => pending.has(r.runId))) {
    const row = await getRun(run.runId);
    if (row?.status === "succeeded" || row?.status === "failed") {
      pending.delete(run.runId);
      console.log(`${run.cveId} ${run.purl}: ${row.status} ${row.label ?? row.error ?? ""}`);
    } else {
      console.log(`${run.cveId}: ${row?.status} · ${row?.stage ?? ""}`);
    }
  }
}
