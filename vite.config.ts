import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig, type UserConfig } from "vite";
import dts from "vite-plugin-dts";
import type { InlineConfig } from "vitest";

// Vitest sets VITEST=true for every test run. Tailwind's compiler and the
// declaration bundler are build-only concerns, so they are skipped while
// testing; the dev server, the library build and Vitest all share this file.
const isTest = process.env.VITEST === "true";

const config = {
  plugins: [
    react(),
    ...(isTest
      ? []
      : [
          tailwindcss(),
          dts({ tsconfigPath: path.resolve(__dirname, "tsconfig.lib.json") }),
        ]),
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
    include: ["sorokit-core", "@creit.tech/stellar-wallets-kit"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
    testTimeout: 10000,
    // The suite drives a lot of DOM-heavy components; running file-by-file in
    // a single fork keeps it deterministic on CI runners.
    fileParallelism: false,
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/__tests__/**",
        "src/test/**",
        "src/verify-exports.ts",
      ],
    },
  },
} satisfies UserConfig & { test: InlineConfig };

export default defineConfig(config);
