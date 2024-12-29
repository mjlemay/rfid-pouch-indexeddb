import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  images: {
      unoptimized: true,
  },
  distDir: 'out', 
  // trailingSlash: true,
  assetPrefix: '.',
  staticPageGenerationTimeout: 1000,
  reactStrictMode: false
};

export default nextConfig;
