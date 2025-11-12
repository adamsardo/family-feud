import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Ensure the repo root is used when multiple lockfiles exist
    root: __dirname,
  },
};

export default nextConfig;
