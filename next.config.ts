import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/quotes/[id]/pdf": [
      "./node_modules/@expo-google-fonts/roboto/**/*.ttf",
      "./node_modules/@expo-google-fonts/roboto-mono/**/*.ttf",
    ],
    "/api/quotes/[id]/email": [
      "./node_modules/@expo-google-fonts/roboto/**/*.ttf",
      "./node_modules/@expo-google-fonts/roboto-mono/**/*.ttf",
    ],
  },
};

export default nextConfig;
