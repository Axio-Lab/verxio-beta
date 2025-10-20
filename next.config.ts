import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  // Ensure webpack builds (e.g., in Docker/Railway) resolve Solana program aliases
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@solana-program/token": require('path').join(__dirname, 'src/shims/solana-program-token.ts'),
      // Fix rpc-websockets path resolution for jito-ts and nested dependencies
      "rpc-websockets/dist/lib/client": "rpc-websockets",
      "rpc-websockets/dist/lib/client/websocket": "rpc-websockets",
      // Keep nested SDKs pinned to the top-level copies to avoid duplication issues
      "@drift-labs/sdk/node_modules/@solana/web3.js": "@solana/web3.js",
      "@drift-labs/sdk/node_modules/@solana/spl-token": "@solana/spl-token",
      "@reflectmoney/stable.ts/node_modules/@solana/web3.js": "@solana/web3.js",
      "@reflectmoney/stable.ts/node_modules/@solana/spl-token": "@solana/spl-token",
      "@coral-xyz/anchor/node_modules/@solana/web3.js": "@solana/web3.js",
      "@coral-xyz/anchor/node_modules/@solana/spl-token": "@solana/spl-token",
    };
    return config;
  },
  turbopack: {
    resolveAlias: {
      "rpc-websockets/dist/lib/client": "rpc-websockets",
      "rpc-websockets/dist/lib/client/websocket": "rpc-websockets",
      "@solana-program/token": "./src/shims/solana-program-token.ts",
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