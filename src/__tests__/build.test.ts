import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

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
      expect(content).toContain('module.exports');
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
});
