import { getRun } from "../../../../agent/lib/db";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return Response.json({ error: "not found" }, { status: 404 });
  const run = await getRun(id);
  if (!run) return Response.json({ error: "not found" }, { status: 404 });
  const { status, stage, label, error, started_at, finished_at } = run;
  return Response.json({ status, stage, label, error, started_at, finished_at });
}
