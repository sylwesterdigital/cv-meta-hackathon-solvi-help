import { mkdir, copyFile, cp, access, readFile, realpath } from 'node:fs/promises';
import { preserveLocalAssets } from './preserve-local-assets.mjs';
import { stageRapierBundle } from './rapier-vendor.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// If a release ships watcher log enhancements, preserve the executable bit
// when the existing watcher copies this tested file into the repository.
try {
  const { chmod } = await import('node:fs/promises');
  await chmod(path.join(root, 'solvi-watch.sh'), 0o755);
} catch (err) { if (err?.code !== 'ENOENT') throw err; }

const pkgRoot = path.join(root, 'node_modules', 'three');
const examples = path.join(pkgRoot, 'examples', 'jsm');
const vendor = path.join(root, 'vendor', 'three');

async function copy(src, dest) {
  await mkdir(path.dirname(dest), { recursive: true });
  await copyFile(src, dest);
}

try { await access(path.join(pkgRoot, 'build', 'three.module.js')); }
catch { console.error('Three.js missing: run npm install.'); process.exit(2); }

await copy(path.join(pkgRoot, 'build', 'three.module.js'), path.join(vendor, 'three.module.js'));
await copy(path.join(pkgRoot, 'build', 'three.core.js'), path.join(vendor, 'three.core.js'));

// Collect static imports/exports, including multiline named imports and side effects.
const STATIC = /\b(?:import|export)\s+(?:(?:(?!;)[\s\S]){0,2500}?\s+from\s*)?['"]([^'"]+)['"]/g;
const DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
function imports(source) {
  const found = [];
  for (const pattern of [STATIC, DYNAMIC]) {
    pattern.lastIndex = 0;
    for (const m of source.matchAll(pattern)) found.push(m[1]);
  }
  return [...new Set(found)];
}

const queue = ['geometries/TextGeometry.js','loaders/FontLoader.js','controls/OrbitControls.js', 'controls/TransformControls.js', 'loaders/GLTFLoader.js', 'loaders/FBXLoader.js', 'utils/SkeletonUtils.js', 'loaders/DRACOLoader.js', 'loaders/KTX2Loader.js', 'libs/meshopt_decoder.module.js', 'webxr/XRControllerModelFactory.js', 'webxr/XRHandModelFactory.js'];
const visited = new Set();
while (queue.length) {
  const rel = queue.shift();
  if (visited.has(rel)) continue;
  visited.add(rel);
  const src = path.resolve(examples, rel);
  if (!src.startsWith(examples + path.sep)) throw new Error('Unsafe addon import: ' + rel);
  const js = await readFile(src, 'utf8');
  await copy(src, path.join(vendor, 'addons', rel));
  for (const spec of imports(js)) {
    if (spec === 'three') continue;
    let dependency;
    if (spec.startsWith('./') || spec.startsWith('../')) {
      dependency = path.relative(examples, path.resolve(path.dirname(src), spec));
    } else if (spec.startsWith('three/addons/')) {
      dependency = spec.slice('three/addons/'.length);
    } else {
      throw new Error(`Unexpected Three.js addon import: ${rel} -> ${spec}`);
    }
    if (!dependency.endsWith('.js')) throw new Error('Unexpected non-JS addon import: ' + dependency);
    if (dependency.startsWith('..') || path.isAbsolute(dependency)) throw new Error('Addon escapes source directory: ' + dependency);
    queue.push(dependency);
  }
}
for (const name of ['helvetiker','optimer','gentilis']) await copy(path.join(pkgRoot,'examples','fonts',name+'_regular.typeface.json'),path.join(vendor,'fonts',name+'_regular.typeface.json'));
await cp(path.join(examples, 'libs', 'draco'), path.join(vendor, 'draco'), { recursive: true, force: true });
await cp(path.join(examples, 'libs', 'basis'), path.join(vendor, 'basis'), {recursive:true,force:true});
// Rapier 0.21 moved its self-contained ESM bundle under dist/rapier.mjs.
await stageRapierBundle(root);
// Locally hosted HLS playback for Chromium; no third-party CDN at runtime.
await copy(path.join(root,'node_modules','hls.js','dist','hls.min.js'),path.join(root,'vendor','hls','hls.min.js'));
console.log(`Three.js bundled with ${visited.size} recursively resolved addon modules and Draco decoder.`);

// All tracked local assets must be preserved *byte-for-byte* in the verified stage,
// not skipped because a developer-edited GLB fails a heuristic header check.
// The running watcher checks equality during Git preflight, before writing anything.
await preserveLocalAssets(root);

// Import user-supplied library models from assets/avatars as part of the normal build.
try {
  const repo = path.resolve(root, '..', '..');
  await access(path.join(repo, '.git'));
  const {lstat, open} = await import('node:fs/promises');
  const catalog = JSON.parse(await readFile(path.join(root, 'assets/avatars/catalog.json'), 'utf8'));
  const seen = new Set();let total=0,copied=0;
  for (const item of catalog.avatars||[]) {
    const filename = item.url?.split('/').at(-1);
    if (!filename || !/^[A-Za-z0-9_-]+\.glb$/.test(filename) || seen.has(filename)) continue;
    seen.add(filename);
    const src = path.join(repo, 'assets', 'avatars', filename);
    let info;try {info=await lstat(src);}catch {continue;}
    if (!info.isFile() || info.isSymbolicLink() || info.size>24*1024*1024 || total+info.size>90*1024*1024) {
      console.warn(`Avatar not staged (unsupported type or size): ${filename}`);continue;
    }
    const fh=await open(src,'r');const header=Buffer.alloc(12);
    try{await fh.read(header,0,12,0);}finally{await fh.close();}
    if(header.toString('ascii',0,4)!=='glTF'||header.readUInt32LE(4)!==2||header.readUInt32LE(8)!==info.size){
      console.warn('Ignoring invalid GLB avatar: '+filename);continue;
    }
    const dest=path.join(root,'assets','avatars',filename);
    if(path.resolve(src)===path.resolve(dest))continue;
    await copy(src,dest);total+=info.size;copied++;
  }
  if(copied)console.log(`Local avatar library: ${copied} GLB(s), ${(total/1048576).toFixed(1)} MiB staged for Git + Ubuntu deployment.`);
} catch (e) {
  // Running this build directly (outside the watcher) has no repository parent.
  console.log('No local watcher avatar repository detected; using release-bundled assets.');
}
