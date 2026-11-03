import test from 'node:test';
import assert from 'node:assert/strict';
import {sanitiseFurniture,rebuildFurniture} from '../js/primitive-properties.js';
import {cleanVegetation,vegetationParts,plotArea} from '../js/procedural-vegetation.js';
import * as THREE from 'three';

test('water patches sanitise and build',()=>{
 const p=sanitiseFurniture({variant:'waterPatch',plotShape:'circle',width:6,waterDepth:1.2,waterLevel:.7,terrainRelief:.5});
 assert.equal(p.variant,'waterPatch');
 assert.equal(p.plotShape,'circle');
 const group=new THREE.Group();
 rebuildFurniture(group,p);
 assert.ok(group.children.some(c=>c.userData.terrainCollider));
 assert.ok(group.children.some(c=>c.material && c.material.transparent));
});

test('ground plots keep usable polygon area',()=>{
 const cfg=cleanVegetation({variant:'groundPlot',plotShape:'square',width:4,depth:3});
 const parts=vegetationParts({...cfg,width:4,depth:3});
 assert.ok(parts.length>=1);
 assert.ok(plotArea([[-2,-1.5],[2,-1.5],[2,1.5],[-2,1.5]])>1);
});
