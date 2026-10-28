import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const IMPORT_RE = /\b(?:import|export)\s+(?:(?:(?!;)[\s\S]){0,2500}?\s+from\s*)?['"]([^'"]+)['"]/g;
export const DYNAMIC_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

export function collectImports(js) {
  const specs=[];
  for (const pattern of [IMPORT_RE, DYNAMIC_RE]) {
    pattern.lastIndex=0;
    for (const match of js.matchAll(pattern)) specs.push(match[1]);
  }
  return [...new Set(specs)];
}

export function browserModules(root=defaultRoot) {
  const rootPath=path.resolve(root);
  const queue=['js/main.js'];
  const visited=new Set();
  while (queue.length) {
    const rel=queue.shift();
    if (visited.has(rel)) continue;
    const full=path.resolve(rootPath,rel);
    if (!full.startsWith(rootPath+path.sep)) throw Error(`Unsafe module URL: ${rel}`);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
      throw Error(`MISSING BROWSER MODULE (404): /${rel}`);
    }
    visited.add(rel);
    const js=fs.readFileSync(full,'utf8');
    for (const spec of collectImports(js)) {
      let next;
      if(spec==='three') next='vendor/three/three.module.js';
      else if(spec.startsWith('three/addons/')) next='vendor/three/addons/'+spec.slice('three/addons/'.length);
      else if(spec.startsWith('./') || spec.startsWith('../'))
        next=path.relative(rootPath,path.resolve(path.dirname(full),spec));
      else throw Error(`Unresolved browser import: ${rel} -> ${spec}`);
      if (!/\.(?:js|mjs)$/.test(next)) throw Error(`Unexpected browser module: ${rel} -> ${spec}`);
      if (next.startsWith('..') || path.isAbsolute(next)) throw Error(`Import escaped webroot: ${rel} -> ${spec}`);
      queue.push(next);
    }
  }
  return [...visited].sort();
}

if (process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const modules=browserModules(process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : defaultRoot);
    if (process.argv.includes('--json')) console.log(JSON.stringify({modules}));
    else console.log(`PASS: ${modules.length} browser modules resolved; no missing imports.`);
  } catch (error) { console.error('FAIL: '+error.message); process.exitCode=1; }
}
