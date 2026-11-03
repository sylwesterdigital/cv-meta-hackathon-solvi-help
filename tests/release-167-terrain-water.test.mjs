import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const source=read('js/procedural-vegetation.js');
// These checks deliberately run against the shipped source without requiring
// npm-installed Three.js; the browser imports the Three.js versioned vendor.
const noImports=source.replace(/^import .*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
const v=new Function('THREE',noImports+'\nreturn {cleanVegetation,plotPointsForConfig,boundsFromPoints,terrainHeightAt,plotArea};')({});

test('water patches sanitise shape, depth, colour and boundary',()=>{
 const p=v.cleanVegetation({variant:'waterPatch',plotShape:'circle',width:6,waterDepth:1.2,waterLevel:.7,terrainRelief:.5,waterColor:'#44aacc'});
 assert.equal(p.plotShape,'circle');
 assert.equal(p.waterDepth,1.2);
 assert.equal(p.waterColor,'#44aacc');
 assert.equal(v.plotPointsForConfig({...p,width:6}).length,32);
 assert.match(source,/terrainCollider=true/);
 assert.match(source,/MeshPhysicalMaterial/);
});
test('ground plots retain polygon area, shape parameters and raised terrain',()=>{
 const p=v.cleanVegetation({variant:'groundPlot',plotShape:'square',width:4,depth:3,terrainRelief:1});
 const points=v.plotPointsForConfig({...p,width:4,depth:3});
 assert.equal(v.plotArea(points),12);
 const bounds=v.boundsFromPoints(points);
 assert.ok(v.terrainHeightAt(p,bounds,0,0,false)>.1);
 assert.match(source,/const subdivision=/);
});
