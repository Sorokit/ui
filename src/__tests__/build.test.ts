import fs from 'fs';
import path from 'path';
import { describe, expect,it } from 'vitest';

import viteLibConfig from '../../vite.lib.config';

describe('Vite library build configuration (#350)', () => {
  it('enables sourcemap generation', () => {
    expect(viteLibConfig.build?.sourcemap).toBe(true);
  });

  it('disables minification so output stays readable', () => {
    expect(viteLibConfig.build?.minify).toBe(false);
  });

  it('includes sorokit-core in optimizeDeps', () => {
    expect(viteLibConfig.optimizeDeps?.include).toContain('sorokit-core');
  });
});

describe('Library Build', () => {
  it('should produce ES module output', () => {
    const esPath = path.resolve(__dirname, '../../dist/sorokit-ui.es.js');
    if (fs.existsSync(esPath)) {
      const content = fs.readFileSync(esPath, 'utf-8');
      expect(content).toContain('export');
    }
  });

  it('should produce CommonJS output', () => {
    const cjsPath = path.resolve(__dirname, '../../dist/sorokit-ui.cjs.js');
    if (fs.existsSync(cjsPath)) {
      const content = fs.readFileSync(cjsPath, 'utf-8');
      expect(content).toContain('exports.');
    }
  });

  it('should NOT bundle React', () => {
    const esPath = path.resolve(__dirname, '../../dist/sorokit-ui.es.js');
    if (fs.existsSync(esPath)) {
      const content = fs.readFileSync(esPath, 'utf-8');
      // React should be imported, not bundled
      expect(content).toMatch(/from ['"]react['"]/);
      // But React internals should not be bundled
      expect(content).not.toContain('ReactDOM.createRoot');
    }
  });

  it('should produce TypeScript definitions', () => {
    const dtsPath = path.resolve(__dirname, '../../dist/index.d.ts');
    if (fs.existsSync(dtsPath)) {
      const content = fs.readFileSync(dtsPath, 'utf-8');
      expect(content).toContain('export');
    }
  });

  it('should produce a valid sourcemap alongside the ES module output (#350)', () => {
    const esPath = path.resolve(__dirname, '../../dist/sorokit-ui.es.js');
    const mapPath = `${esPath}.map`;
    if (fs.existsSync(esPath)) {
      expect(fs.existsSync(mapPath)).toBe(true);
      const content = fs.readFileSync(esPath, 'utf-8');
      expect(content).toContain('sourceMappingURL');

      const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      expect(map.version).toBeDefined();
      expect(Array.isArray(map.sources)).toBe(true);
      expect(map.sources.length).toBeGreaterThan(0);
    }
  });

  it('should produce a valid sourcemap alongside the CommonJS output (#350)', () => {
    const cjsPath = path.resolve(__dirname, '../../dist/sorokit-ui.cjs.js');
    const mapPath = `${cjsPath}.map`;
    if (fs.existsSync(cjsPath)) {
      expect(fs.existsSync(mapPath)).toBe(true);
      const map = JSON.parse(fs.readFileSync(mapPath, 'utf-8'));
      expect(map.version).toBeDefined();
    }
  });

  it('should produce readable (unminified) output, not a single collapsed line (#350)', () => {
    const esPath = path.resolve(__dirname, '../../dist/sorokit-ui.es.js');
    const indexPath = path.resolve(__dirname, '../../dist/index.js');
    const targetPath = fs.existsSync(indexPath) ? indexPath : esPath;
    if (fs.existsSync(targetPath)) {
      const content = fs.readFileSync(targetPath, 'utf-8');
      // A minified bundle collapses to one or a handful of very long lines;
      // unminified output keeps source-like line breaks and indentation.
      const lines = content.split('\n');
      expect(lines.length).toBeGreaterThan(20);
      expect(content).toMatch(/\n[\t ]+\S/);
    }
  });

  describe('Dual ESM/CJS Export and Tree-shaking Compatibility (#698)', () => {
    it('validates package.json exports map for dual loading integrity', () => {
      const pkgPath = path.resolve(__dirname, '../../package.json');
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

      expect(pkg.exports).toBeDefined();
      expect(pkg.exports['.']).toBeDefined();
      expect(pkg.exports['.'].import).toBe('./dist/index.js');
      expect(pkg.exports['.'].require).toBe('./dist/index.cjs');
      expect(pkg.exports['.'].types).toBe('./dist/index.d.ts');
    });

    it('verifies ESM bundle exports named symbols for tree-shaking', () => {
      const esPath = path.resolve(__dirname, '../../dist/index.js');
      if (fs.existsSync(esPath)) {
        const content = fs.readFileSync(esPath, 'utf-8');
        expect(content).toMatch(/export\s*\{/);
      }
    });

    it('verifies CJS bundle provides CommonJS exports', () => {
      const cjsPath = path.resolve(__dirname, '../../dist/index.cjs');
      if (fs.existsSync(cjsPath)) {
        const content = fs.readFileSync(cjsPath, 'utf-8');
        expect(content).toContain('exports.');
      }
    });
  });
});
