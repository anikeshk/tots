import type { LanguageModel } from "ai";
import { chatgpt } from "eve/models/openai";

// Deployed: AI Gateway strings, authenticated with the project's OIDC token.
// Local: the ChatGPT subscription from `eve dev` /login (it cannot run in a deployment), unless
// TOTS_MODELS=gateway. Jev is only reachable through the Gateway; locally the judge falls back to
// asking the same typed questions of the ChatGPT model (see judge.ts).
export const USE_GATEWAY = Boolean(process.env.VERCEL) || process.env.TOTS_MODELS === "gateway";

const GATEWAY = {
  root: "openai/gpt-5.6-luna-fast",
  claims: "openai/gpt-5.6-sol",
  // OpenAI's cyber safety filter rejects PoC work even for published advisories, so the
  // investigators run on Claude.
  technical: "anthropic/claude-sonnet-5.5",
  discourse: "anthropic/claude-sonnet-5.5",
} as const;

const CHATGPT = {
  root: "gpt-5.6-luna-fast",
  claims: "gpt-5.6-sol",
  technical: "gpt-5.6-sol",
  discourse: "gpt-5.6-sol",
} as const;

export type ModelRole = keyof typeof GATEWAY;

export function model(role: ModelRole): LanguageModel {
  return USE_GATEWAY ? GATEWAY[role] : chatgpt(CHATGPT[role]);
}

export const JEV = "typesafe-ai/jev";

/** Human-readable model names recorded on each assessment. */
export function modelNames(judge: string): Record<string, string> {
  const names = USE_GATEWAY ? GATEWAY : CHATGPT;
  const prefix = USE_GATEWAY ? "" : "chatgpt/";
  return {
    claims: prefix + names.claims,
    technical: prefix + names.technical,
    discourse: prefix + names.discourse,
    judge,
  };
}
