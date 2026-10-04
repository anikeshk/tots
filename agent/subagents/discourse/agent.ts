import { defineAgent } from "eve";
import { model } from "../../lib/models";

export default defineAgent({
  description:
    "Discourse investigator: collects who said what about a CVE (maintainers, CNA, databases, scanner vendors, community) with verbatim quotes and links.",
  model: model("discourse"),
  reasoning: "medium",
  // No shell or file tools; only web_fetch, web_search, and the GitHub tools under tools/.
  defaultTools: false,
  tool: false,
});
