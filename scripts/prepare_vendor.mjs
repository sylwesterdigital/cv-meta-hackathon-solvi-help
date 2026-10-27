import { mkdir, copyFile, cp, access, readFile, realpath } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

const queue = ['controls/OrbitControls.js', 'loaders/GLTFLoader.js', 'loaders/DRACOLoader.js'];
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
await cp(path.join(examples, 'libs', 'draco'), path.join(vendor, 'draco'), { recursive: true, force: true });
console.log(`Three.js bundled with ${visited.size} recursively resolved addon modules and Draco decoder.`);
