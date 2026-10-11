import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Hide the dev-tools badge: it sits over the sidebar footer in demos and screenshots.
  devIndicators: false,
  // Lets two dev servers run side by side without sharing build output (e.g. NEXT_DIST_DIR=.next-b).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // This folder is the project root (a stray lockfile higher up made Next guess wrong).
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
