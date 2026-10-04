"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTarget, queueRun } from "../agent/lib/db";
import { CVE_ID, parsePurl, reportPath } from "../agent/lib/schemas";
import { liveRuns } from "../flags";
import { startInvestigation } from "./lib/start";

// The only code path that creates queued runs. The flag check here includes Vercel Toolbar
// overrides, because it runs inside the viewer's request.

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export interface StartState {
  error?: string;
}

export async function addCve(_prev: StartState, form: FormData): Promise<StartState> {
  if (!(await liveRuns())) return { error: "Live runs are turned off." };

  const cveId = String(form.get("cveId") ?? "").trim().toUpperCase();
  const purlInput = String(form.get("purl") ?? "").trim();
  if (!CVE_ID.test(cveId)) return { error: "Enter a CVE ID like CVE-2024-45296." };
  let purl: string;
  try {
    purl = parsePurl(purlInput).purl;
  } catch {
    return { error: "Enter an npm purl with a version, like pkg:npm/express@5.2.1." };
  }

  const { runId } = await queueRun(cveId, purl);
  await startInvestigation(runId, await origin());
  redirect(reportPath(cveId, purl));
}

export async function rerun(targetId: string): Promise<StartState> {
  if (!(await liveRuns())) return { error: "Live runs are turned off." };
  const found = await getTarget(targetId);
  if (!found) return { error: "Unknown assessment." };
  if (found.runs.some((r) => r.status === "queued" || r.status === "running")) {
    return { error: "A run is already in progress." };
  }
  const { runId } = await queueRun(found.target.cve_id, found.target.purl);
  await startInvestigation(runId, await origin());
  return {};
}
