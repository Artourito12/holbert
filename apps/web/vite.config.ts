import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

const root = path.resolve(import.meta.dirname, "../..");

export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  // .env.local vit à la racine du repo (partagé avec les fonctions api/)
  envDir: root,
  server: {
    // En dev, les fonctions serverless tournent via `npm run dev:api` (vercel dev)
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  resolve: {
    alias: [
      { find: /^@holbert\/ui$/, replacement: path.join(root, "packages/ui/src/index.ts") },
      { find: /^@holbert\/ui\//, replacement: path.join(root, "packages/ui/src/") },
      { find: /^@holbert\/core$/, replacement: path.join(root, "packages/core/src/index.ts") },
      { find: /^@holbert\/core\//, replacement: path.join(root, "packages/core/src/") },
    ],
  },
});
