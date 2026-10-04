import { defineEvalConfig } from "eve/evals";

// Each eval runs a full investigation (sandbox + two investigators + judge), so allow 20 minutes.
export default defineEvalConfig({
  timeoutMs: 20 * 60_000,
  maxConcurrency: 2,
});
