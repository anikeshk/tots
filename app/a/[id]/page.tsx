import { notFound, permanentRedirect } from "next/navigation";
import { getTarget } from "../../../agent/lib/db";
import { reportPath } from "../../../agent/lib/schemas";

// Old UUID links redirect to the readable /CVE-…/package@version URL.
export default async function LegacyAssessment({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const found = await getTarget(id);
  if (!found) notFound();
  permanentRedirect(reportPath(found.target.cve_id, found.target.purl));
}
