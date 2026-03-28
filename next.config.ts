import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
