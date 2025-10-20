import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  serverExternalPackages: [
    "rpc-websockets",
    "jito-ts",
  ],
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  turbopack: {
    resolveAlias: {
      "rpc-websockets/dist/lib/client": "rpc-websockets/dist/index.js",
      "rpc-websockets/dist/lib/client/websocket": "rpc-websockets/dist/index.js",
      "@drift-labs/sdk/node_modules/@solana/web3.js": "@solana/web3.js",
      "@drift-labs/sdk/node_modules/@solana/spl-token": "@solana/spl-token",
      "@reflectmoney/stable.ts/node_modules/@solana/web3.js": "@solana/web3.js",
      "@reflectmoney/stable.ts/node_modules/@solana/spl-token": "@solana/spl-token",
      "@coral-xyz/anchor/node_modules/@solana/web3.js": "@solana/web3.js",
      "@coral-xyz/anchor/node_modules/@solana/spl-token": "@solana/spl-token",
    },
  },
};

export default nextConfig;