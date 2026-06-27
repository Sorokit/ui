import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

/**
 * Library build configuration for sorokit-ui
 * 
 * Produces:
 * - dist/sorokit-ui.es.js (ES modules)
 * - dist/sorokit-ui.cjs (CommonJS)
 * - dist/sorokit-ui.d.ts (TypeScript definitions)
 * 
 * Use with: vite build --config vite.lib.config.ts
 */
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/components/index.ts'),
      name: 'SorokitUI',
      fileName: (format) => `sorokit-ui.${format === 'es' ? 'es' : 'cjs'}.js`,
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        // Tailwind CSS should be imported by consumer
        'tailwindcss',
      ],
      output: {
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
        },
      },
    },
    minify: 'terser',
    sourcemap: true,
    // Preserve specific directory structure
    outDir: 'dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
