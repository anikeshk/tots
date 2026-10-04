import { defineAgent } from "eve";
import { model } from "../../lib/models";

export default defineAgent({
  description:
    "Technical investigator: installs the target, fixed, and known-vulnerable versions of an npm package in a sandbox, reads the patch, and runs a minimal PoC.",
  model: model("technical"),
  reasoning: "high",
  // Only callable from the investigate_cve workflow, never directly by the root model.
  tool: false,
});
