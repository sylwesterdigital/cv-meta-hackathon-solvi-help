import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stageRapierBundle } from '../scripts/rapier-vendor.mjs';

test('Rapier 0.21 ESM build is staged from dist/rapier.mjs (not the removed rapier.es.js)', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'solvi-rapier-test-'));
  try {
    const src = path.join(root, 'node_modules/@dimforge/rapier3d-compat/dist/rapier.mjs');
    await mkdir(path.dirname(src), { recursive: true });
    const contents = 'export default { init() {} };\n'.repeat(10);
    await writeFile(src, contents);
    const dest = await stageRapierBundle(root);
    assert.equal(dest, path.join(root, 'vendor/rapier/rapier.mjs'));
    assert.equal(await readFile(dest, 'utf8'), contents);
    const scenePhysics = readFileSync(new URL('../js/scene-physics.js', import.meta.url), 'utf8');
    assert.match(scenePhysics, /import\('\.\.\/vendor\/rapier\/rapier\.mjs'\)/);
    assert.doesNotMatch(scenePhysics, /rapier\.es\.js/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('Rapier missing build fails with clear versioned diagnostic', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'solvi-rapier-missing-'));
  try { await assert.rejects(stageRapierBundle(root), /Missing Rapier 0\.21 ESM build/); }
  finally { await rm(root, { recursive: true, force: true }); }
});

test('browser dependency checker accepts .mjs imports for Rapier', () => {
  const source = readFileSync(new URL('../scripts/check_browser_modules.mjs', import.meta.url), 'utf8');
  assert.match(source, /js\|mjs/);
});
