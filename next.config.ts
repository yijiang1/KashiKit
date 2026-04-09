import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["172.20.7.232"],
  images: {
    remotePatterns: [
      { hostname: "img.youtube.com" },
    ],
  },
};

export default nextConfig;
