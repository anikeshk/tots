import { defineWorkflowTool } from "eve/tools";
import { z } from "zod";
import { decomposeClaims } from "../lib/claims";
import { claimRun, completeRun, failRun, setStage } from "../lib/db";
import { runJudge } from "../lib/judge";
import { modelNames } from "../lib/models";
import { applyPolicy } from "../lib/policy";
import { fetchCveRecord } from "../lib/records";
import {
  DiscourseReport,
  TechnicalReport,
  type Claim,
  type CveRecord,
  type JudgeResult,
  type TotsAssessment,
} from "../lib/schemas";

// Orchestrates one TOTS run. A run can only start from a `queued` row, which only the
// flag-checked Next.js server action creates, so the public /eve/v1 route cannot start one.

async function claim(runId: string, sessionId: string) {
  "use step";
  return claimRun(runId, sessionId);
}

async function stage(runId: string, name: string) {
  "use step";
  await setStage(runId, name);
}

async function fetchRecord(cveId: string, purl: string) {
  "use step";
  return fetchCveRecord(cveId, purl);
}

async function claims(record: CveRecord) {
  "use step";
  return decomposeClaims(record);
}

async function judge(record: CveRecord, list: Claim[], technical: TechnicalReport, discourse: DiscourseReport) {
  "use step";
  return runJudge(record, list, technical, discourse);
}

async function finalize(
  runId: string,
  record: CveRecord,
  list: Claim[],
  technical: TechnicalReport,
  discourse: DiscourseReport,
  jev: JudgeResult,
) {
  "use step";
  const policy = applyPolicy(jev, list, technical, discourse, record);
  const assessment: TotsAssessment = {
    cveId: record.cveId,
    target: record.target,
    official: record.official,
    record,
    claims: list.map((c) => ({ ...c, verdict: policy.claimVerdicts[c.id] ?? "unverified" })),
    technical,
    discourse,
    jev,
    label: policy.label,
    evidenceQuality: policy.evidenceQuality,
    policyTrace: policy.trace,
    generatedAt: new Date().toISOString(),
    models: modelNames(jev.judgeModel),
  };
  await completeRun(runId, assessment);
  return { label: policy.label, trace: policy.trace };
}

async function fail(runId: string, message: string) {
  "use step";
  await failRun(runId, message);
}

function briefing(record: CveRecord, list: Claim[], task: string) {
  return [
    task,
    "",
    "Return your report in the requested structured format. Use these claim IDs exactly.",
    "",
    JSON.stringify(
      {
        target: record.target,
        cve: {
          id: record.cveId,
          description: record.description,
          cwes: record.cwes,
          ghsaIds: record.ghsaIds,
          sourceRanges: record.ranges,
          references: record.references,
        },
        claims: list,
      },
      null,
      2,
    ),
  ].join("\n");
}

export default defineWorkflowTool({
  description:
    "Run a TOTS investigation for a queued run ID: fetch the CVE record, split it into claims, run the technical and discourse investigators in parallel, judge the evidence with Jev, and save the assessment.",
  inputSchema: z.object({ runId: z.string().uuid() }),
  async *execute({ runId }, ctx) {
    "use workflow";

    const run = await claim(runId, ctx.session.id);
    if (!run) {
      return { ok: false, error: "Run is unknown or has already started. Only queued runs can be investigated." };
    }

    try {
      yield { stage: "record", cveId: run.cve_id, purl: run.purl };
      const record = await fetchRecord(run.cve_id, run.purl);

      yield { stage: "claims" };
      await stage(runId, "claims");
      const list = await claims(record);

      yield { stage: "investigating", claims: list.length };
      await stage(runId, "investigating");

      const ask = async <T>(name: string, message: string, schema: z.ZodType<T>) => {
        const response = await ctx.agent(name).send(message, { outputSchema: schema, signal: ctx.abortSignal });
        const result = await response.result();
        if (result.status === "failed" || result.data === undefined) {
          throw new Error(`${name} investigator failed: ${result.error?.message ?? "no structured result"}`);
        }
        return result.data as T;
      };

      // Independent: neither investigator sees the other's output.
      const [technical, discourse] = await Promise.all([
        ask(
          "technical",
          briefing(record, list, "Investigate this CVE technically for the target version."),
          TechnicalReport,
        ),
        ask(
          "discourse",
          briefing(record, list, "Collect the public discourse about this CVE and the target version."),
          DiscourseReport,
        ),
      ]);

      yield { stage: "judging" };
      await stage(runId, "judging");
      const jev = await judge(record, list, technical, discourse);

      const result = await finalize(runId, record, list, technical, discourse, jev);
      return { ok: true, runId, cveId: record.cveId, purl: record.target.purl, ...result };
    } catch (error) {
      await fail(runId, error instanceof Error ? error.message : String(error));
      throw error;
    }
  },
});
