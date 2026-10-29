import { copyFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = resolve(__dirname, '../dist');

// Copy ESM build to index.mjs
if (existsSync(resolve(distDir, 'index.js'))) {
  copyFileSync(resolve(distDir, 'index.js'), resolve(distDir, 'index.mjs'));
}

// Copy CJS build to index.cjs and clean up temp cjs folder
if (existsSync(resolve(distDir, 'cjs/index.js'))) {
  copyFileSync(resolve(distDir, 'cjs/index.js'), resolve(distDir, 'index.cjs'));
  rmSync(resolve(distDir, 'cjs'), { recursive: true, force: true });
}

console.log('Dual ESM (index.mjs) + CJS (index.cjs) build generated successfully.');
