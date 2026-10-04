import { defineTool } from "eve/tools";
import { webFetch } from "eve/tools/web_fetch";

// Keeps the technical investigator independent of discourse: it may read code, commits, diffs,
// releases, and advisories, but not issue threads, discussions, or PR conversations.
const DISCOURSE_PATH = /^\/[^/]+\/[^/]+\/(issues|discussions)(\/|$)|^\/[^/]+\/[^/]+\/pull\/\d+(\/?$|\/(commits\/?)?$)/;

export default defineTool({
  ...webFetch,
  description:
    "Fetch a URL (code, commits, .diff/.patch files, releases, advisories). Issue threads, discussions, and PR conversations are blocked; fetch `/pull/<n>.diff` for a PR's code.",
  execute(input, ctx) {
    const url = new URL(input.url);
    if (url.hostname === "github.com" && DISCOURSE_PATH.test(url.pathname)) {
      throw new Error(
        "Blocked: the technical investigator does not read issue threads, discussions, or PR conversations. Fetch the commit or `/pull/<n>.diff` instead.",
      );
    }
    return webFetch.execute(input, ctx);
  },
});
