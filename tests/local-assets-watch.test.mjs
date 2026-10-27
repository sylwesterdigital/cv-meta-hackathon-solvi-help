import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { preserveLocalAssets } from '../scripts/preserve-local-assets.mjs';

test('watcher stage preserves uncommitted user-modified GLB without heuristic rejection', async () => {
  const repo = await mkdtemp(path.join(os.tmpdir(), 'solvi-user-model-'));
  try {
    const stage = path.join(repo,'.solvi','solvi-validate-test');
    await mkdir(path.join(stage,'assets'),{recursive:true});
    await mkdir(path.join(repo,'assets'),{recursive:true});
    await mkdir(path.join(repo,'.git'),{recursive:true});
    const changed = Buffer.concat([Buffer.from('glTF'),Buffer.from('intentionally locally changed bytes')]);
    await writeFile(path.join(repo,'assets','solvi-character.glb'),changed);
    await writeFile(path.join(stage,'assets','solvi-character.glb'),Buffer.from('release model'));
    const result = await preserveLocalAssets(stage);
    assert.deepEqual(result,['solvi-character.glb']);
    assert.deepEqual(await readFile(path.join(stage,'assets','solvi-character.glb')),changed);
    assert.deepEqual(await readFile(path.join(repo,'assets','solvi-character.glb')),changed);
  } finally {await rm(repo,{recursive:true,force:true});}
});

test('preservation does not read outside watcher checkout', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(),'solvi-normal-build-'));
  try { assert.deepEqual(await preserveLocalAssets(tmp),[]); }
  finally { await rm(tmp,{recursive:true,force:true}); }
});
