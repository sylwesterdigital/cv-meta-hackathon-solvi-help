import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {sanitiseWall} from '../js/office-wall-math.js';

const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
function evaluate(name,THREE,deps={},exports='{}'){
 const code=source(name).replace(/^import .*;\s*$/gm,'').replace(/^export \{.*;\s*$/gm,'').replace(/export (const|function|class) /g,'$1 ');
 const args=Object.keys(deps);
 return new Function('THREE',...args,`${code}\nreturn ${exports};`)(THREE,...Object.values(deps));
}
function mockThree(){
 class Vec2{constructor(x,y){this.x=x;this.y=y;}}
 class Obj{constructor(){this.children=[];this.userData={};this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};this.rotation={};}
  add(child){this.children.push(child);}remove(child){this.children=this.children.filter(v=>v!==child);}}
 class Geo{constructor(...args){this.args=args;this.type=this.constructor.name;}dispose(){}}
 class Mat{constructor(input){Object.assign(this,input);}dispose(){}}
 class Mesh extends Obj{constructor(geometry,material){super();this.geometry=geometry;this.material=material;}}
 class Group extends Obj{}
 const result={Vector2:Vec2,Mesh,Group,MeshStandardMaterial:Mat};
 for(const name of ['BoxGeometry','CylinderGeometry','TorusGeometry','LatheGeometry'])result[name]=class extends Geo{constructor(...args){super(...args);this.type=name;}};
 return result;
}

test('natural wood marble and granite textures are deterministic, bounded, and vary spatially',()=>{
 const THREE=mockThree();
 const natural=evaluate('js/procedural-natural-textures.js',THREE,{},'{naturalPixel,NATURAL_MATERIALS}');
 assert.deepEqual(natural.NATURAL_MATERIALS,['wood','marble','granite']);
 for(const kind of natural.NATURAL_MATERIALS){
  const colors=new Set();
  for(let i=0;i<24;i++){
   const color=natural.naturalPixel(kind,i*5,i*3,128);
   assert.equal(color.length,3);
   assert.ok(color.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
   assert.deepEqual(color,natural.naturalPixel(kind,i*5,i*3,128));
   colors.add(color.join(','));
  }
  assert.ok(colors.size>8,kind+' should not be a plain colour');
 }
});

test('each basic prop has real generated mesh parts, bounded editable parameters and optional features',()=>{
 const THREE=mockThree();
 const equipment=evaluate('js/procedural-equipment.js',THREE,{},'{EQUIPMENT_TYPES,EQUIPMENT_NUMERIC,buildEquipment}');
 const p=evaluate('js/primitive-properties.js',THREE,{wallPresetTexture:()=>null,...equipment,VEGETATION_TYPES:[],VEGETATION_NUMERIC:{},cleanVegetation:v=>v,vegetationParts:()=>[],INFRASTRUCTURE_NUMERIC:{},cleanInfrastructure:v=>v,infrastructureParts:()=>[]},'{BASIC_PROP_TYPES,sanitiseFurniture,makeFurniture,rebuildFurniture}');
 assert.deepEqual(p.BASIC_PROP_TYPES,['plate','mug','glass','bowl','bottle','can','flowerpot','box']);
 for(const variant of p.BASIC_PROP_TYPES){
  const object=p.makeFurniture({variant});
  assert.equal(object.userData.editorKind,'furniture');
  assert.equal(object.userData.furniture.variant,variant);
  assert.ok(object.children.length>0,variant);
  assert.ok(object.children.every(c=>c.userData.furniturePart),variant);
  assert.ok(object.children.some(c=>c.geometry.type=== (variant==='box'?'BoxGeometry':'LatheGeometry')),variant);
  assert.ok(object.userData.furniture.width<=.35,variant+' should be a small object by default');
  const data=p.sanitiseFurniture({...object.userData.furniture,width:1e10,height:-100});
  assert.ok(data.width<=8&&data.height>=.025);
 }
 assert.ok(p.makeFurniture({variant:'mug',handle:true}).children.some(c=>c.userData.furnitureHandle));
 assert.ok(!p.makeFurniture({variant:'mug',handle:false}).children.some(c=>c.userData.furnitureHandle));
 assert.equal(p.makeFurniture({variant:'box',openTop:false}).children.length,6);
 assert.equal(p.makeFurniture({variant:'box',openTop:true}).children.length,5);
 assert.ok(p.makeFurniture({variant:'flowerpot',soil:true}).children.length>p.makeFurniture({variant:'flowerpot',soil:false}).children.length);
 assert.ok(p.makeFurniture({variant:'bottle',cap:true}).children.length>p.makeFurniture({variant:'bottle',cap:false}).children.length);
});

test('natural materials are retained by wall and furniture settings and exposed in the add menu',()=>{
 for(const texture of ['wood','marble','granite']){
  const wall=sanitiseWall({points:[[0,0],[4,0]],texture,textureScale:1.7,textureDistortion:.7,textureContrast:1.3,ceiling:{texture}});
  assert.equal(wall.texture,texture);
  assert.equal(wall.ceiling.texture,texture);
  assert.equal(wall.textureScale,1.7);
 }
 const editor=source('js/editor.js'),html=source('index.html');
 assert.match(editor,/\['Basic props',BASIC_PROP_TYPES\]/);
 assert.match(editor,/textureScale','Pattern scale/);
 for(const id of ['wallTextureScale','wallTextureDistortion','wallTextureContrast'])assert.match(html,new RegExp('id="'+id+'"'));
 for(const kind of ['wood','marble','granite'])assert.match(html,new RegExp('<option value="'+kind+'">'));
});
