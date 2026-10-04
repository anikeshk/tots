import type { NextConfig } from "next";
import createWithVercelToolbar from "@vercel/toolbar/plugins/next";
import { withEve } from "eve/next";

const nextConfig: NextConfig = {};

const withVercelToolbar = createWithVercelToolbar();

// withEve mounts the agent in agent/ at /eve/v1/* (a separate service on Vercel).
export default withEve(withVercelToolbar(nextConfig));
