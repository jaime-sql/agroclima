import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import { shortSha } from "./src/lib/build-sha";

const nextConfig: NextConfig = {
  // Inlined into the server bundle. Deploy sets GITHUB_SHA; local builds stay "dev".
  env: {
    BUILD_SHA: shortSha(process.env.GITHUB_SHA),
  },
  // Cache Components schedule render work with Node's setTimeout `_idleStart`.
  // workerd does not implement that timer field, so a page request hangs and
  // the runtime cancels it. This shell does not use Cache Components.
  cacheComponents: false,
  partialPrefetching: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

void initOpenNextCloudflareForDev();
