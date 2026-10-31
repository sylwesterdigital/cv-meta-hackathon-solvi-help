import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {collectImports} from '../scripts/check_browser_modules.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const match=html.match(/<script type="importmap">([^<]+)<\/script>/);
const mappings=JSON.parse(match?.[1]||'{}').imports;

test('cached editor cannot hide Office Space after a new release',()=>{
 const editor=fs.readFileSync(path.join(root,'js/editor.js'),'utf8');
 assert.match(editor,/\['Office Space',\['walls','closed room','stairs','stairs advanced','escalator','moving walkway','lift'\]\]/);
 assert.match(editor,/if\(k==='walls'\)\{this\.startWallDrawing\('wall'\);\}/);
 assert.match(html,/id="wallPanel"/);
 assert.match(html,new RegExp(`src="\\./js/main\\.js\\?v=${version.replaceAll('.','\\.')}"`));
 assert.match(html,new RegExp(`href="\\./styles\\.css\\?v=${version.replaceAll('.','\\.')}"`));
});

test('all local ES modules resolve to a version-specific URL regardless of old browser cache',()=>{
 assert.equal(mappings.three,'./vendor/three/three.module.js');
 assert.equal(mappings['three/addons/'],'./vendor/three/addons/');
 const firstParty=fs.readdirSync(path.join(root,'js')).filter(f=>f.endsWith('.js'));
 for(const f of firstParty){
   assert.equal(mappings[`./js/${f}`],`./js/${f}?v=${version}`,`Cache-bust ${f}`);
 }
 // An import './editor.js' in a cached './js/studio.js' must resolve through
 // the document's import map to a fresh versioned module URL.
 for(const source of firstParty.map(f=>`js/${f}`)){
  const code=fs.readFileSync(path.join(root,source),'utf8');
  for(const spec of collectImports(code)){
   if(!spec.startsWith('.'))continue;
   const resolved=path.posix.normalize(path.posix.join(path.posix.dirname(source),spec));
   if(!resolved.startsWith('js/'))continue;
   assert.equal(mappings[`./${resolved}`],`./${resolved}?v=${version}`,
     `${source} imports ${spec} without a fresh mapping`);
  }
 }
});
