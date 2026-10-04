import { generateText, Output } from "ai";
import { evaluate } from "eve/ai";
import { z } from "zod";
import { JEV, USE_GATEWAY, model } from "./models";
import type { Claim, CveRecord, DiscourseReport, JudgeResult, TechnicalReport } from "./schemas";

// Jev answers typed questions over evidence the investigators already gathered. It never investigates.
// Jev's state is limited to ~32k tokens, so the bundle is built from compact, schema-shaped reports.

type BooleanQuestion = { type: "boolean"; instructions: string; criteria?: { true: string; false: string } };
type ScoreQuestion = { type: "score"; instructions: string; criteria: string[] };

const GLOBAL_QUESTIONS: Record<string, BooleanQuestion> = {
  bug_exists: {
    type: "boolean",
    instructions: "Does the evidence show the described vulnerability exists in at least one version of the package?",
  },
  target_affected: {
    type: "boolean",
    instructions: "Does the evidence show the specific target version (state.target) is affected by this vulnerability?",
    criteria: {
      true: "Technical testing or authoritative sources show the target version is vulnerable.",
      false: "Testing, version ranges, or maintainers indicate the target version is not vulnerable.",
    },
  },
  reproduced_on_target: {
    type: "boolean",
    instructions: "Did the technical PoC reproduce the vulnerable behaviour on the target version itself?",
  },
  positive_control_reproduced: {
    type: "boolean",
    instructions: "Did the technical PoC reproduce the vulnerable behaviour on a known-vulnerable (positive control) version?",
  },
  patch_addresses_claim: {
    type: "boolean",
    instructions: "Does the identified fix or patch materially remove the described security issue?",
  },
  impact_matches_description: {
    type: "boolean",
    instructions: "Is the impact described in the CVE consistent with what the technical evidence demonstrates?",
  },
  credible_dispute_exists: {
    type: "boolean",
    instructions: "Is there a credible, specific dispute (from a maintainer, vendor, or reproducible test) about whether this vulnerability applies to the target?",
  },
  evidence_sufficient: {
    type: "boolean",
    instructions: "Is there enough concrete evidence (code, tests, primary sources) to make a determination about the target?",
  },
};

const AUTHORITY: ScoreQuestion = {
  type: "score",
  instructions: "What is the highest authority of anyone disputing that the target is affected?",
  criteria: [
    "No one disputes it",
    "Community members or users",
    "Vulnerability databases, scanner vendors, or security researchers",
    "Project maintainers or the CNA",
  ],
};

function trim(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function buildJudgeState(
  record: CveRecord,
  claims: Claim[],
  technical: TechnicalReport,
  discourse: DiscourseReport,
) {
  return {
    target: record.target.purl,
    cve: {
      id: record.cveId,
      description: trim(record.description, 1500),
      officialState: record.official.state,
      sourceRanges: record.ranges.map(({ source, id, ranges, affectsTarget }) => ({
        source,
        id,
        ranges,
        affectsTarget,
      })),
      osvReportsForTargetPurl: record.osvTargetVulns,
    },
    claims: claims.map(({ id, kind, text, assertedBy }) => ({ id, kind, text, assertedBy })),
    technicalEvidence: {
      ...technical,
      poc: { description: trim(technical.poc.description, 600), script: trim(technical.poc.script, 1500) },
    },
    discourseEvidence: {
      summary: discourse.summary,
      unresolved: discourse.unresolved,
      items: discourse.items.map((item) => ({ ...item, quote: trim(item.quote, 300) })),
    },
  };
}

export async function runJudge(
  record: CveRecord,
  claims: Claim[],
  technical: TechnicalReport,
  discourse: DiscourseReport,
  abortSignal?: AbortSignal,
): Promise<JudgeResult> {
  const claimQuestions: Record<string, BooleanQuestion> = {};
  for (const claim of claims) {
    claimQuestions[`claim_${claim.id}_supported`] = {
      type: "boolean",
      instructions: `Is claim ${claim.id} technically supported by the technical evidence? Claim: "${claim.text}"`,
    };
    claimQuestions[`claim_${claim.id}_disputed`] = {
      type: "boolean",
      instructions: `Is claim ${claim.id} credibly disputed by a specific source in the discourse evidence? Claim: "${claim.text}"`,
    };
  }

  const questions = { ...GLOBAL_QUESTIONS, ...claimQuestions, authority_of_dispute: AUTHORITY };
  const state = buildJudgeState(record, claims, technical, discourse);
  const { answers, confidence, judgeModel } = USE_GATEWAY
    ? await judgeWithJev(state, questions, abortSignal)
    : await judgeWithLanguageModel(state, questions, abortSignal);

  const global: Record<string, number> = {};
  for (const key of Object.keys(GLOBAL_QUESTIONS)) global[key] = answers[key]?.probability ?? 0;

  const perClaim: JudgeResult["claims"] = {};
  for (const claim of claims) {
    perClaim[claim.id] = {
      technicallySupported: answers[`claim_${claim.id}_supported`]?.probability ?? 0,
      crediblyDisputed: answers[`claim_${claim.id}_disputed`]?.probability ?? 0,
    };
  }

  return {
    global,
    claims: perClaim,
    authorityOfDispute: answers.authority_of_dispute?.score ?? 0,
    judgeModel,
    ...(confidence ? { confidence } : {}),
  };
}

type Answers = Record<string, { probability?: number; score?: number }>;
type Questions = Record<string, BooleanQuestion | ScoreQuestion>;

async function judgeWithJev(state: ReturnType<typeof buildJudgeState>, questions: Questions, abortSignal?: AbortSignal) {
  const result = await evaluate({ model: JEV, abortSignal, state, questions });
  const confidence = (result.providerMetadata?.typesafe as { confidence?: Record<string, number> } | undefined)
    ?.confidence;
  return { answers: result.answers as Answers, confidence, judgeModel: JEV };
}

/**
 * Local fallback when Jev is unreachable (the ChatGPT subscription has no evaluation model): the same
 * typed questions, answered in one structured-output call, like the AI SDK's language-model adapters.
 */
async function judgeWithLanguageModel(state: ReturnType<typeof buildJudgeState>, questions: Questions, abortSignal?: AbortSignal) {
  const { output } = await generateText({
    model: model("claims"),
    abortSignal,
    output: Output.object({
      schema: z.object({
        answers: z.array(
          z.object({
            id: z.string(),
            value: z.number().describe("Boolean questions: P(true) in [0, 1]. Score questions: a level index."),
          }),
        ),
      }),
    }),
    system:
      "You are an evaluator. Answer every question about the state. For boolean questions give your estimated probability that the statement is true (0 to 1). For score questions give the zero-based index of the best-matching level. Use only the evidence in the state.",
    prompt: JSON.stringify({ state, questions }),
  });
  const answers: Answers = {};
  for (const [id, question] of Object.entries(questions)) {
    const value = output.answers.find((a) => a.id === id)?.value ?? 0;
    answers[id] =
      question.type === "boolean"
        ? { probability: Math.min(1, Math.max(0, value)) }
        : { score: Math.min(question.criteria.length - 1, Math.max(0, value)) };
  }
  return { answers, confidence: undefined, judgeModel: `chatgpt/gpt-5.6-sol (Jev unavailable)` };
}
