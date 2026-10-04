import "server-only";
import { Client } from "eve/client";
import { getVercelOidcToken } from "@vercel/oidc";
import { failRun } from "../../agent/lib/db";

/** Opens an eve session for a queued run. Resolves once eve accepts the session, not when the run ends. */
export async function startInvestigation(runId: string, origin: string) {
  const client = new Client({
    host: origin,
    // The trusted OIDC header also passes Vercel deployment protection on preview URLs.
    ...(process.env.VERCEL
      ? { auth: { vercelOidc: { token: async () => await getVercelOidcToken() } } }
      : {}),
    redirect: "error",
  });
  try {
    await client.sessions.create({ message: `Investigate run ${runId}` });
  } catch (error) {
    await failRun(runId, `Could not start the agent session: ${error instanceof Error ? error.message : error}`);
    throw error;
  }
}
