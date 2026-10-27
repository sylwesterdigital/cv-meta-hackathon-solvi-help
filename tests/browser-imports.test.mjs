import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {browserModules,collectImports} from '../scripts/check_browser_modules.mjs';

test('detects missing addon transitive import before deployment',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'solvi-import-'));
 try {
  fs.mkdirSync(path.join(root,'js'),{recursive:true});
  fs.mkdirSync(path.join(root,'vendor/three/addons/loaders'),{recursive:true});
  fs.mkdirSync(path.join(root,'vendor/three/addons/utils'),{recursive:true});
  fs.writeFileSync(path.join(root,'js/main.js'),"import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';");
  fs.writeFileSync(path.join(root,'vendor/three/addons/loaders/GLTFLoader.js'),"import {mergeVertices} from '../utils/BufferGeometryUtils.js';");
  assert.throws(()=>browserModules(root),/MISSING BROWSER MODULE.*BufferGeometryUtils/);
  fs.writeFileSync(path.join(root,'vendor/three/addons/utils/BufferGeometryUtils.js'),'export const mergeVertices=()=>{};');
  assert.equal(browserModules(root).length,3);
 } finally {fs.rmSync(root,{recursive:true,force:true});}
});
test('handles multiline imports, exports and side-effect imports',()=>{
 const src="import {\n a,\n b\n} from '../some.js';\nexport {b} from './other.js';\nimport './side.js';";
 assert.deepEqual(collectImports(src),['../some.js','./other.js','./side.js']);
});
