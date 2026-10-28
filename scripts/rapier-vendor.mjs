import path from 'node:path';
import { mkdir, copyFile, stat } from 'node:fs/promises';

/** Vendor the Rapier 0.21 browser ESM build, which embeds its WASM in the bundle. */
export async function stageRapierBundle(projectRoot) {
  const source = path.join(projectRoot, 'node_modules', '@dimforge', 'rapier3d-compat', 'dist', 'rapier.mjs');
  const dest = path.join(projectRoot, 'vendor', 'rapier', 'rapier.mjs');
  let info;
  try { info = await stat(source); }
  catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    throw new Error('Missing Rapier 0.21 ESM build: ' + source + '. Install @dimforge/rapier3d-compat@0.21.0.');
  }
  if (!info.isFile() || info.size < 100) throw new Error('Invalid Rapier ESM build: ' + source);
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(source, dest);
  return dest;
}
