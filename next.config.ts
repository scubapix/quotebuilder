import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/quotes/[id]/pdf": [
      "./src/assets/fonts/quote-pdf/**/*.ttf",
    ],
    "/api/quotes/[id]/email": [
      "./src/assets/fonts/quote-pdf/**/*.ttf",
    ],
  },
};

export default nextConfig;
