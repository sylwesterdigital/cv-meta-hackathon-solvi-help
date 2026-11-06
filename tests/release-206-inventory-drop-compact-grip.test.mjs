import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const html=src('index.html'),css=src('styles.css'),inventorySrc=src('js/robot-inventory.js');

function mockDom(){
 class Element{
  constructor(tag='div'){this.tag=tag;this.children=[];this.dataset={};this.listeners={};this.disabled=false;this.hidden=false;this.className='';this.classList={toggle(){},add(){}};this.textContent='';}
  append(...elements){this.children.push(...elements);}
  replaceChildren(...elements){this.children=[...elements];}
  setAttribute(){}
  addEventListener(event,listener){this.listeners[event]=listener;}
  click(){if(!this.disabled)this.listeners.click?.();}
  querySelectorAll(selector){return selector==='[data-inventory-tab]'?this.tabs||[]:[];}
  querySelector(selector){return selector==='[data-inventory-close]'?this.close:null;}
 }
 const panel=new Element();panel.tabs=['held','pocket','wearable','bag'].map(tab=>{const el=new Element('button');el.dataset.inventoryTab=tab;return el;});panel.close=new Element('button');
 const elements={robotInventoryPanel:panel,inventoryRobotName:new Element(),inventoryDropRight:new Element('button'),inventoryDropLeft:new Element('button'),inventoryHoldNearby:new Element('button'),robotInventoryOpen:new Element('button'),inventoryActionHint:new Element(),robotInventoryItems:new Element()};
 return {document:{getElementById:id=>elements[id]||null,createElement:tag=>new Element(tag)},elements};
}
function inventoryClass(){
 const cleaned=inventorySrc.replace(/^import .*;\s*$/gm,'').replace(/^export /gm,'');
 const THREE={Vector3:class{constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}},Box3:class{setFromObject(){this.min={y:0};return this;}isEmpty(){return false;}}};
 return new Function('THREE','HANDS','isToolObject','cleanToolGripProfile','cleanToolAnimationName','TOOL_ACTIVITIES','canBePickable','pickableTarget','makeFurniture','capturePresetThumbnail','fridgeSlotPose','applyEditMode','isEditMode','updateHeldPose', cleaned+'\nreturn RobotInventory;')(
  THREE,['right','left'],o=>o?.userData?.inventory?.category==='tool',v=>v, v=>v,{shovel:{label:'Dig ahead'}},()=>true,()=>null,()=>null,()=>'',()=>null,()=>{},()=>false,()=>true);
}
function vector(x=0,y=0,z=0){return {x,y,z,copy(o){Object.assign(this,{x:o.x,y:o.y,z:o.z});return this;},addScaledVector(dir,k){this.x+=dir.x*k;this.y+=dir.y*k;this.z+=dir.z*k;return this;}};}

test('Held tab has dedicated, visible left and right Drop controls outside item scroll',()=>{
 for(const id of ['inventoryDropRight','inventoryDropLeft','inventoryActionHint','robotInventoryItems'])assert.match(html,new RegExp('id="'+id+'"'));
 assert.ok(html.indexOf('id="inventoryDropRight"')<html.indexOf('id="robotInventoryItems"'));
 assert.match(css,/#robotInventoryPanel \.robot-inventory-items\{flex:1 1 auto;min-height:0/);
 assert.match(css,/#robotInventoryPanel \.robot-inventory-item div\{flex:none!important/);
 assert.match(css,/#robotInventoryPanel \.robot-inventory-item\{display:grid!important/);
 assert.match(inventorySrc,/button\.textContent=held\?`Drop \$\{held\.name\} \(\$\{hand\}\)`/);
});

test('one-click Drop removes hand ownership, persists item, and immediately clears quick action',()=>{
 const {document,elements}=mockDom();globalThis.document=document;
 const RobotInventory=inventoryClass();
 const robot={name:'Lemox',position:vector(0,0,0),rotation:{y:0},userData:{editorKind:'robot',editorId:'lemox-12345678'}};
 const shovel={name:'Shovel',visible:true,position:vector(),userData:{editorKind:'furniture',editorId:'shovel-12345678',pickable:true,inventory:{category:'tool',size:'bag'},furniture:{variant:'shovel'},storage:{type:'held',holderId:'lemox-12345678',hand:'right'},physics:{mode:'off'}},updateWorldMatrix(){}};
 const writes=[],syncs=[];
 const editor={items:[robot,shovel],canEdit:()=>true,physics:{sync:o=>syncs.push(o),applyEditedPose(){}},queueSave:o=>writes.push(o),toast(){}};
 const inv=new RobotInventory(editor);inv.activeRobot=robot;inv.itemThumbnail=()=>'';inv.updatePortrait=()=>{};inv.bind();inv.render();
 assert.equal(elements.inventoryDropRight.hidden,false);
 assert.equal(elements.inventoryDropRight.disabled,false);
 assert.equal(elements.inventoryDropRight.textContent,'Drop Shovel (right)');
 assert.equal(elements.inventoryDropLeft.hidden,true);
 assert.equal(elements.robotInventoryItems.children.length,1);
 const card=elements.robotInventoryItems.children[0];
 assert.ok(card.children[2].children.some(b=>b.textContent==='Drop'),'item also retains an in-card Drop button');
 elements.inventoryDropRight.click();
 assert.equal(shovel.userData.storage,undefined,'the same object is released into world');
 assert.equal(shovel.visible,true);
 assert.equal(shovel.userData.physics.mode,'dynamic');
 assert.deepEqual(writes,[shovel]);
 assert.deepEqual(syncs,[shovel]);
 assert.equal(elements.inventoryDropRight.hidden,true,'drop control hides after release');
 assert.equal(elements.robotInventoryItems.children.length,1);
 assert.equal(elements.robotInventoryItems.children[0].textContent,'No items in this category');
});

test('two equipped tools provide separate hand drop actions and obey permissions',()=>{
 const {document,elements}=mockDom();globalThis.document=document;
 const RobotInventory=inventoryClass();
 const robot={name:'Lemox',position:vector(),rotation:{y:0},userData:{editorKind:'robot',editorId:'lemox-12345678'}};
 const tool=hand=>({name:hand==='left'?'Saw':'Shovel',userData:{editorKind:'furniture',editorId:hand+'-tool-12345678',pickable:true,inventory:{category:'tool'},storage:{type:'held',holderId:'lemox-12345678',hand}}});
 const right=tool('right'),left=tool('left');
 const editor={items:[robot,right,left],canEdit:o=>o!==left,toast(){}};
 const inv=new RobotInventory(editor);inv.activeRobot=robot;inv.itemThumbnail=()=>'';inv.updatePortrait=()=>{};inv.render();
 assert.equal(elements.inventoryDropRight.hidden,false);assert.equal(elements.inventoryDropLeft.hidden,false);
 assert.equal(elements.inventoryDropRight.disabled,false);assert.equal(elements.inventoryDropLeft.disabled,true);
 assert.match(elements.inventoryDropLeft.textContent,/Drop Saw \(left\)/);
});

test('grip editor defaults to compact common fields with advanced offsets folded',()=>{
 assert.match(html,/<details id="toolGripDetails"[^>]*>/);
 assert.match(html,/<details id="toolGripAdvanced" class="tool-grip-advanced">/,'advanced controls are collapsed by default');
 const common=html.split('<details id="toolGripDetails"')[1].split('<details id="toolGripAdvanced"')[0];
 assert.match(common,/id="toolGripHand"/);assert.match(common,/id="toolGripBone"/);
 assert.match(common,/id="toolActionClip"/);assert.match(common,/data-grip-field="rotation"/);
 assert.doesNotMatch(common,/data-grip-field="position"|data-grip-field="anchor"/);
 for(const field of ['bone','followRotation','rotation','position','anchor'])assert.match(html,new RegExp('data-grip-field="'+field+'"'));
 assert.match(inventorySrc,/advanced\.open=false/);
 assert.match(css,/#propertiesPanel #toolGripDetails \.tool-grip-axes\{display:grid/);
});
