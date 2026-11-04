import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {sanitiseWall,wallArrayTransforms,wallRoofCopyIndices} from '../js/office-wall-math.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const building=(array={},roof={})=>sanitiseWall({closed:true,points:[[0,0],[10,0],[10,8],[0,8]],height:3,roof:{enabled:true,style:'flat',...roof},array:{enabled:true,count:4,axis:'y',gap:.2,...array},ceiling:{enabled:true}});

test('vertical multi-floor walls get only one roof on the physically highest level',()=>{
 const buildingUp=building();
 assert.deepEqual(wallRoofCopyIndices(buildingUp),[3]);
 assert.ok(Math.abs(wallArrayTransforms(buildingUp)[3].offset[1]-9.6)<1e-8);
 const buildingDown=building({direction:-1});
 assert.deepEqual(wallRoofCopyIndices(buildingDown),[0]);
 assert.ok(Math.abs(wallArrayTransforms(buildingDown)[3].offset[1]+9.6)<1e-8);
});
test('single floor and lateral building arrays retain appropriate roofs',()=>{
 assert.deepEqual(wallRoofCopyIndices(building({enabled:false})),[0]);
 assert.deepEqual(wallRoofCopyIndices(building({count:1})),[0]);
 assert.deepEqual(wallRoofCopyIndices(building({axis:'x',count:3})),[0,1,2]);
 assert.deepEqual(wallRoofCopyIndices(building({axis:'z',count:2})),[0,1]);
 assert.deepEqual(wallRoofCopyIndices(building({}, {enabled:false})),[]);
 assert.deepEqual(wallRoofCopyIndices({...building(),closed:false}),[]);
});
test('roof accessories are never duplicated; intermediate ceilings are unaffected',()=>{
 const source=read('js/office-walls.js');
 assert.match(source,/const roofCopies=new Set\(wallRoofCopyIndices\(s\)\)/);
 assert.match(source,/if\(isRoofPart\(original\)&&!roofCopies\.has\(copy\.index\)\)continue/);
 assert.match(source,/if\(!roofCopies\.has\(0\)\)for\(const original of originals\)/);
 assert.match(source,/child\.userData\.wallRoof\|\|child\.userData\.wallRoofPanel\|\|child\.userData\.wallRoofAccessory/);
 assert.match(source,/chimney\.userData\.wallRoofAccessory=true/);
 assert.match(source,/if\(s\.ceiling\.enabled/);
 assert.match(read('index.html'),/House roof · top floor only/);
});
test('XR controller raycasting always supplies a camera before Sprite.raycast can execute',()=>{
 const world=read('js/world.js');
 const match=world.match(/  xrRaycast\(controller,\{checkSmartScreen=false\}=\{\}\)\{([\s\S]*?)\n  \}\n  shiftXRViewer/);
 assert.ok(match,'XR raycasting method found');
 const invoke=new Function('controller','{checkSmartScreen=false}={}',match[1]);
 const camera={matrixWorld:{valid:true}},controller={updateWorldMatrix(){}};
 let smartCalls=0,raycasts=0;
 const raycaster={camera:null,setFromXRController(){this.camera=null;},intersectObjects(){raycasts++;assert.equal(this.camera,camera);return [];}};
 const renderer={xr:{getCamera(){return camera;}}};
 const worldContext={renderer,raycaster,camera:{matrixWorld:{desktop:true}},xrButtons:[],xrMediaControls:{visible:false},xrLanding(){assert.equal(raycaster.camera,camera);return null;},robotEditor:{hitLiftButton(){return null;},hitSmartScreen(){smartCalls++;assert.equal(raycaster.camera,camera);return null;},items:[]}};
 assert.equal(invoke.call(worldContext,controller).smartScreen,null);
 assert.equal(smartCalls,0,'idle XR frames skip unnecessary full-room smart-screen intersections');
 assert.ok(raycasts>0);
 invoke.call(worldContext,controller,{checkSmartScreen:true});
 assert.equal(smartCalls,1,'XR select still interacts with smart screens');
});
test('XR resize does not call renderer.setSize while an XR device is presenting',()=>{
 const world=read('js/world.js');
 assert.match(world,/if\(!this\.renderer\.xr\.isPresenting\)this\.renderer\.setSize\(innerWidth,innerHeight\)/);
 assert.match(world,/this\.xrRaycast\(controller,\{checkSmartScreen:true\}\)/);
 assert.match(world,/this\.raycaster\.camera=this\.renderer\.xr\.getCamera\(\)\|\|this\.camera/);
 assert.match(read('js/editor.js'),/hits\.find\(h=>!h\.object\.isSprite\)/);
});

test('multiplayer connection reconnects after Back-Forward Cache restoration',()=>{
 const main=read('js/main.js'),live=read('js/live.js');
 assert.match(main,/window\.addEventListener\('pageshow',event=>\{if\(event\.persisted/);
 assert.match(main,/room\.stopped=false;room\.attempts=0;room\.ws=null;room\.connect\(\)/);
 assert.match(live,/close\(\)\{this\.stopped=true;this\.joined=false;clearTimeout\(this\.timer\);clearInterval\(this\.syncTimer\)/);
});
