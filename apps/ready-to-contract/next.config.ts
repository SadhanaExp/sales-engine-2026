import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  // This app lives inside the sales-engine repo, which has its own lockfile and
  // its own src/proxy.ts. Without pinning the root, Turbopack walks up, adopts
  // the parent as the project and tries to compile that proxy against this
  // app's @/* alias.
  turbopack: {
    root: path.resolve("."),
  },
};

export default nextConfig;
