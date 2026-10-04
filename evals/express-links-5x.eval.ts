import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { investigate } from "./run";

// Contested case: CVE-2024-10491 (res.links Link-header injection) flagged on express@5.2.1.
// NVD/GHSA/OSV scope it to 3.x; maintainers say 4.x/5.x reports are wrong (expressjs/express#6222).
// Expected label set from the first reviewed run (2026-10-04): the PoC reproduces the same
// Link-header injection on 3.21.2, 4.x, and 5.2.1, while maintainers say 4.x/5.x are unaffected.
// That technical-vs-maintainer conflict is DISPUTED, not LIKELY INVALID (see PLAN.md §1).
const EXPECTED_LABELS = ["DISPUTED"];

export default defineEval({
  description: "CVE-2024-10491 on express@5.2.1 is DISPUTED: maintainers dispute it, the PoC does not settle it.",
  tags: ["seed"],
  async test(t) {
    const { assessment, error } = await investigate(t, "CVE-2024-10491", "pkg:npm/express@5.2.1");
    t.succeeded();
    await t.require(error, equals(null));
    t.check(
      EXPECTED_LABELS.includes(assessment?.label ?? ""),
      equals(true),
    ).label(`label is one of ${EXPECTED_LABELS.join(", ")} (got ${assessment?.label})`);
    t.check(
      assessment?.claims.find((c) => c.id === "target")?.verdict !== "supported",
      equals(true),
    ).label("target claim is not supported");
    t.check(
      (assessment?.discourse.items ?? []).some((i) => i.role === "maintainer" && i.stance === "disputes"),
      equals(true),
    ).label("a maintainer dispute was found");
  },
});
