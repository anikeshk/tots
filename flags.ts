import { flag } from "flags/next";
import { vercelAdapter } from "@flags-sdk/vercel";

/** Gates Re-run and Add CVE. Off in production by default; override per browser with the Vercel Toolbar. */
export const liveRuns = flag<boolean>({
  key: "live-runs",
  description: "Allow starting live CVE investigations (Re-run / Add CVE)",
  defaultValue: false,
  options: [
    { value: false, label: "Off" },
    { value: true, label: "On" },
  ],
  adapter: vercelAdapter,
});
