import { defineSandbox } from "eve/sandbox";
import { VercelSandbox } from "eve/sandbox/vercel";

export const environment = VercelSandbox.environment();

// Egress is limited to the npm registry and GitHub source downloads.
export default defineSandbox(() =>
  environment.open({
    networkPolicy: {
      allow: {
        "registry.npmjs.org": [],
        "github.com": [],
        "codeload.github.com": [],
        "raw.githubusercontent.com": [],
        "objects.githubusercontent.com": [],
      },
    },
    resources: { vcpus: 2 },
  }),
);
