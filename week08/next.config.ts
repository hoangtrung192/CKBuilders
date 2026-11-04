import type { NextConfig } from "next";
const config: NextConfig = {
  serverExternalPackages: ["node:sqlite"],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Document-Isolation-Policy",
            value: "isolate-and-credentialless",
          },
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/compat",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },
};
export default config;
