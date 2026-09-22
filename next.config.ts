import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A whole eight's session files: four files a seat, ~30 kB each.
    serverActions: { bodySizeLimit: "25mb" },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75],
  },
};

export default nextConfig;
