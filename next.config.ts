import type { NextConfig } from "next";

const e2eDistDir =
  process.env.NEXT_DIST_DIR === "next-e2e-build" ? "next-e2e-build" : undefined;

const nextConfig: NextConfig = {
  ...(e2eDistDir ? { distDir: e2eDistDir } : {}),
};

export default nextConfig;
