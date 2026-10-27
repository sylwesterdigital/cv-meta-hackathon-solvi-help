// Import developer-edited base models during normal watcher validation.
// No separate CLI/packer; existing watcher calls scripts/prepare_vendor.mjs.
import path from 'node:path';
import { access, lstat, mkdir, copyFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export async function preserveLocalAssets(stage) {
  const root = path.resolve(stage);
  // Never import arbitrary parent files when this is a stand-alone build.
  if (path.basename(path.dirname(root)) !== '.solvi') return [];
  const repo = path.resolve(root, '..', '..');
  try { await access(path.join(repo, '.git')); }
  catch (e) { if (e?.code === 'ENOENT') return []; throw e; }
  const preserved = [];
  for (const filename of ['solvi-character.glb', 'facecap.glb']) {
    const src = path.join(repo, 'assets', filename);
    let metadata;
    try { metadata = await lstat(src); }
    catch (e) { if (e?.code === 'ENOENT') continue; throw e; }
    // Missing or invalid *format* must never silently fall through to preflight conflict.
    // The watcher already has a bundled fallback when no local file exists.
    if (!metadata.isFile() || metadata.isSymbolicLink()) {
      throw new Error('Cannot preserve local base model (not a regular file): ' + src);
    }
    if (!metadata.size || metadata.size > 100 * 1024 * 1024) {
      throw new Error('Cannot preserve local base model (invalid size): ' + src);
    }
    const dest = path.join(root, 'assets', filename);
    await mkdir(path.dirname(dest), { recursive: true });
    await copyFile(src, dest);
    const sourceBytes = await readFile(src);
    const outputBytes = await readFile(dest);
    if (digest(sourceBytes) !== digest(outputBytes)) {
      throw new Error('Local base asset copy did not match: ' + filename);
    }
    preserved.push(filename);
    console.log('PRESERVED LOCAL BASE ASSET: ' + filename + ' (' + metadata.size + ' bytes; exact match)');
  }
  return preserved;
}
