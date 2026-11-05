import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const editorSource=readFileSync(new URL('../js/editor.js',import.meta.url),'utf8');
const infraSource=readFileSync(new URL('../js/infrastructure-drawing.js',import.meta.url),'utf8');
const vegetationSource=readFileSync(new URL('../js/vegetation-drawing.js',import.meta.url),'utf8');
const curveSource=readFileSync(new URL('../js/spatial-editor.js',import.meta.url),'utf8');

// Execute the real editor Add method with a small fake scene. This verifies
// the ordering of placement, publication and persistence, not just its text.
const begin=editorSource.indexOf(' add(kind,showGallery=true,lightType=undefined,persist=true,furnitureVariant=');
const end=editorSource.indexOf('\n // Autonomous agents use the same furniture generator',begin);
assert.ok(begin>0&&end>begin,'editor Add source must be extractable');
const addText=editorSource.slice(begin,end).trim();
const makeAdd=new Function('objectFor','rebuildFurniture','TOOL_TYPES','setLight',
 'PRIMITIVE_FIELDS','sanitisePrimitive','byId','window','syncEquipmentMedia','hydrateRobot','hydrateSceneModel',
 `return ({${addText}}).add;`);
let serial=0;
const mockWindow={solviRoom:'main',solviAPI:null};
const makeObject=kind=>({name:kind,userData:{editorId:`new-${++serial}`,editorKind:kind},
 position:{x:0,y:0,z:0}});
const add=makeAdd(makeObject,(obj,props)=>{obj.userData.furniture={...props};},[],()=>{},
 {},()=>null,()=>({hidden:false}),mockWindow,()=>{},()=>{},()=>{});
function createEditor(smartReturns=false){
 const log={smart:0,added:0,saved:0,disposed:0,anchored:0,toast:[]};
 const editor={items:[],world:{scene:{add:()=>log.added++}},physics:{sync:()=>{}},
  placeSmartNewObject:()=>{log.smart++;return smartReturns;},
  disposeObject:()=>log.disposed++,toast:message=>log.toast.push(message),
  rememberSmartPlacement:()=>log.anchored++,select:()=>{},refreshList:()=>{},
  recordEdit:()=>{},queueSave:()=>log.saved++,snapshot:()=>({})};
 return {editor,log};
}

for(const variant of ['infrastructure','groundPlot','cropBed','waterPatch','vegetationArea']){
 test(`drawn ${variant} draft is never rejected by smart furniture placement`,()=>{
  const {editor,log}=createEditor(false);
  const object=add.call(editor,'furniture',false,undefined,false,variant);
  assert.ok(object,`No draft for ${variant}`);
  assert.equal(object.userData.furniture.variant,variant);
  assert.deepEqual(object.position,{x:0,y:0,z:0},'sketch owns final world position');
  assert.equal(log.smart,0,'camera-distance/collision planner must not run');
  assert.equal(log.added,1,'draft remains available for drawing');
  assert.equal(log.saved,0,'uncommitted draft is never written to multiplayer');
  assert.equal(log.anchored,0,'draft is not a recent furniture placement');
  assert.deepEqual(log.toast,[]);
 });
}
for(const kind of ['curve','portal']){
 test(`${kind} explicit-position draft cannot be blocked by furniture placement`,()=>{
  const {editor,log}=createEditor(false);
  const object=add.call(editor,kind,false,undefined,false);
  assert.ok(object);
  assert.equal(log.smart,0);
  assert.equal(log.saved,0);
  assert.equal(log.added,1);
  assert.equal(log.anchored,0);
 });
}
test('ordinary furniture additions still require safe visible placement',()=>{
 const {editor,log}=createEditor(false);
 assert.equal(add.call(editor,'furniture',true,undefined,true,'chair'),null);
 assert.equal(log.smart,1);
 assert.equal(log.added,0);
 assert.equal(log.disposed,1);
 assert.equal(log.saved,0);
 assert.match(log.toast[0],/No visible, collision-free space/);
});
test('ordinary primitive additions remain protected by the same collision check',()=>{
 const {editor,log}=createEditor(false);
 assert.equal(add.call(editor,'cube'),null);
 assert.equal(log.smart,1);
 assert.equal(log.saved,0);
});
test('a successful ordinary furniture addition is still sent through the normal multiplayer path',()=>{
 const {editor,log}=createEditor(true);
 assert.ok(add.call(editor,'furniture',true,undefined,true,'table'));
 assert.equal(log.smart,1);
 assert.equal(log.saved,1);
 assert.equal(log.anchored,1);
});
test('drawn road/motorway path, vegetation polygon and curve all explicitly choose their own positions',()=>{
 assert.match(infraSource,/editor\.add\('furniture',false,undefined,false,'infrastructure'\)/);
 assert.match(infraSource,/points=raw\.map/);
 assert.match(infraSource,/obj\.position\.set\(origin\[0\],0,origin\[1\]\)/);
 assert.match(infraSource,/editor\.queueSave\(obj\)/);
 assert.match(vegetationSource,/editor\.add\('furniture',false,undefined,false,d\.variant\)/);
 assert.match(vegetationSource,/obj\.position\.set\(origin\[0\],0,origin\[1\]\)/);
 assert.match(curveSource,/editor\.add\('curve',false,undefined,false\)/);
 assert.match(curveSource,/obj\.position\.copy\(origin\)/);
 assert.match(editorSource,/startInfrastructureDrawing\(this,infra\)/);
});
