import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the project root so Next never picks up a lockfile from a parent folder.
  turbopack: { root: path.join(__dirname) },
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
