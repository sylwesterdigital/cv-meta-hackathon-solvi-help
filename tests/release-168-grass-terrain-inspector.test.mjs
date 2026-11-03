import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('js/procedural-vegetation.js');
const noImports=source.replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
const v=new Function('THREE',noImports+'\nreturn {cleanVegetation,plotPointsForConfig,boundsFromPoints,terrainHeightAt,updateGrassRobotInfluence};')({});

test('contextual inspector slider floats beneath a row without reflowing three-column controls',()=>{
 const editor=read('js/editor.js'),css=read('styles.css');
 assert.match(editor,/document\.body\.append\(context\)/);
 assert.match(editor,/positionValueSlider\(\)/);
 assert.doesNotMatch(editor,/insertAdjacentElement\('afterend',context\)/);
 assert.match(css,/body>#inspectorValueSlider\.inspector-value-slider\{[^}]*position:fixed!important/s);
 assert.match(css,/body>#inspectorValueSlider\[hidden\]/);
});
test('grass blades use narrowing geometry with a singular pointed tip',()=>{
 assert.match(source,/Seven vertices, five triangles/);
 assert.match(source,/0,1,0/);
 assert.match(source,/geo\.setIndex\?\.\(\[0,1,2,1,3,2/);
 assert.match(source,/new THREE\.Float32BufferAttribute\(vertices,3\)/);
});
test('moving robots affect grass through constant-size per-frame shader uniforms',()=>{
 const robot={position:{x:0,z:0}};
 v.updateGrassRobotInfluence([robot],1/60);
 robot.position.x=.12;
 v.updateGrassRobotInfluence([robot],1/60);
 assert.match(source,/uniform vec4 uRobotInfluences\[4\]/);
 assert.match(source,/1\.0-smoothstep\(0\.28,1\.55,dist\)/);
 assert.match(read('js/world.js'),/updateGrassRobotInfluence\(\(this\.robotEditor\?\.items\|\|\[\]\)\.filter/);
});
test('raised planting patches are static and vegetation is elevated with the soil',()=>{
 const editor=read('js/editor.js'),physics=read('js/scene-physics.js');
 assert.match(editor,/\['groundPlot','cropBed','waterPatch','vegetationArea'\]/);
 assert.match(editor,/Terrain height \(m\)/);
 assert.match(physics,/legacy surfaces in memory/);
 assert.match(source,/item\.pos\[1\]\+terrainHeightAt\(p,bounds/);
 const p=v.cleanVegetation({variant:'vegetationArea',terrainRelief:1.4,terrainFrequency:2.1,plotSeed:19});
 const bounds={cx:0,cz:0,hw:5,hd:5};
 assert.ok(v.terrainHeightAt(p,bounds,0,0,false)>0);
 assert.ok(v.terrainHeightAt(p,bounds,0,0,false)>v.terrainHeightAt({...p,terrainRelief:0},bounds,0,0,false));
});
