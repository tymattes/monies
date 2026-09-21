import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Browser tests and screenshots set E2E=1: the dev "N" badge floats over the
  // page and can cover controls.
  ...(process.env.E2E ? { devIndicators: false as const } : {}),
};

export default nextConfig;
