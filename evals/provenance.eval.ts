import { defineEval } from "eve/evals";
import { equals } from "eve/evals/expect";
import { investigate } from "./run";

// Every discourse item must carry a URL, and its "verbatim" quote must actually appear there.

const normalize = (text: string) =>
  text
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase();

export default defineEval({
  description: "Discourse quotes appear verbatim on the pages they cite.",
  tags: ["provenance"],
  async test(t) {
    const { assessment } = await investigate(t, "CVE-2024-10491", "pkg:npm/express@5.2.1");
    t.succeeded();
    const items = assessment?.discourse.items ?? [];

    const results = await Promise.all(
      items.map(async (item) => {
        try {
          const page = normalize(await (await fetch(item.url)).text());
          // Compare the first 80 characters, so truncation with "…" still matches.
          return page.includes(normalize(item.quote).replace(/…$/, "").slice(0, 80).trim());
        } catch {
          return false;
        }
      }),
    );

    const found = results.filter(Boolean).length;
    t.check(items.length > 0, equals(true)).label("at least one discourse item");
    t.check(
      found >= Math.ceil(results.length * 0.8),
      equals(true),
    ).label(`≥ 80% of quotes found on their cited page (${found}/${results.length})`);
  },
});
