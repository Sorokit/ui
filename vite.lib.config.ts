import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    dts({
      tsconfigPath: path.resolve(__dirname, "tsconfig.app.json"),
      entryRoot: path.resolve(__dirname, "src"),
      outDir: "dist",
      include: ["src/components", "src/lib/utils.ts"],
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, "src/components/index.ts"),
      formats: ["es", "cjs"],
      fileName: (format) => `sorokit-ui.${format}.js`,
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "sorokit-core",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          "react/jsx-runtime": "jsxRuntime",
          "sorokit-core": "SorokitCore",
        },
      },
    },
    cssFileName: "style",
    cssCodeSplit: false,
    emptyOutDir: true,
  },
});
