import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { investigate } from "./run";

// Valid case: GHSA-9wv6-86v2-598j, ReDoS in path-to-regexp, fixed in 6.3.0.
export default defineEval({
  description: "CVE-2024-45296 on path-to-regexp@6.2.2 is SUPPORTED with a reproduced PoC.",
  tags: ["seed"],
  async test(t) {
    const { assessment, error } = await investigate(t, "CVE-2024-45296", "pkg:npm/path-to-regexp@6.2.2");
    t.succeeded();
    await t.require(error, equals(null));
    t.check(assessment?.label, equals("SUPPORTED"));
    const versions = assessment?.technical.versionsTested ?? [];
    t.check(
      versions.some((v) => v.role === "positive_control" && v.reproduced === true),
      equals(true),
    ).label("positive control reproduced");
    t.check(
      versions.some((v) => v.role === "fixed" && v.reproduced === false),
      equals(true),
    ).label("fixed version does not reproduce");
  },
});
