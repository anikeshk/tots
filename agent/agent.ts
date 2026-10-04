import { defineAgent } from "eve";
import { model } from "./lib/models";

export default defineAgent({
  model: model("root"),
  // The public eve route is anonymous (none()), so the root agent gets no shell, file, or web
  // tools and cannot delegate to copies of itself. Its only capability is investigate_cve.
  defaultTools: false,
  tool: false,
});
