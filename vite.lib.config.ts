import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

/**
 * Library build configuration for sorokit-ui
 * 
 * Produces:
 * - dist/index.js (ES modules)
 * - dist/index.cjs (CommonJS)
 * - dist/index.d.ts (TypeScript definitions)
 * - dist/style.css (Component CSS)
 * 
 * Use with: vite build --config vite.lib.config.ts
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      tsconfigPath: path.resolve(__dirname, "tsconfig.lib.json"),
    }),
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/index.ts"),
      name: "SorokitUI",
      fileName: (format) => `index.${format === "es" ? "js" : "cjs"}`,
      formats: ["es", "cjs"],
    },
    rollupOptions: {
      external: (id) =>
        !id.startsWith(".") &&
        !id.startsWith("@/") &&
        !id.startsWith("\0") &&
        !path.isAbsolute(id),
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith(".css")) {
            return "style.css";
          }
          return "[name][extname]";
        },
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
    minify: false,
    sourcemap: true,
    outDir: "dist",
    emptyOutDir: true,
  },
  optimizeDeps: {
    include: [
      "sorokit-core",
      "@creit.tech/stellar-wallets-kit",
      "react",
      "react-dom",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
