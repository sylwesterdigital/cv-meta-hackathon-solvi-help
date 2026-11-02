// Scene-backed inventory: objects keep stable IDs and their bag relationship.
// A bag's contents refer to its ID, not to the avatar wearing it. Dropping the
// bag therefore never extracts/destroys its contents.
import * as THREE from 'three';
import {pickableTarget,canBePickable} from './object-carry.js';

export const INVENTORY_CATEGORIES=Object.freeze(['world','general','key','money','phone','notepad','tool','food','backpack','jetpack','parachute','wearable']);
export const INVENTORY_SIZES=Object.freeze(['pocket','bag']);
export function cleanInventory(raw){
 if(!raw||typeof raw!=='object')return {category:'world',size:'pocket',consumable:false};
 const category=INVENTORY_CATEGORIES.includes(raw.category)?raw.category:'world';
 return {category,size:INVENTORY_SIZES.includes(raw.size)?raw.size:'pocket',consumable:raw.consumable===true};
}
export function cleanStorage(raw){
 if(!raw||typeof raw!=='object')return null;
 if(!['pocket','bag','worn'].includes(raw.type))return null;
 const id=/^[A-Za-z0-9_-]{8,80}$/;
 if(raw.type==='bag')return typeof raw.bagId==='string'&&id.test(raw.bagId)?{type:'bag',bagId:raw.bagId}:null;
 if(typeof raw.holderId!=='string'||!id.test(raw.holderId))return null;
 return raw.type==='worn'&&['front','back'].includes(raw.slot)?{type:'worn',holderId:raw.holderId,slot:raw.slot}:
  raw.type==='pocket'?{type:'pocket',holderId:raw.holderId}:null;
}
export function inventoryLocation(obj){return cleanStorage(obj?.userData?.storage)?.type||'ground';}
export function bodyBackBone(robot){
 const visual=robot?.children?.find(c=>c.userData?.robotVisual);
 let best=null,score=-1;
 visual?.traverse?.(bone=>{
  if(!bone.isBone)return;
  const n=String(bone.name).toLowerCase().replace(/[^a-z0-9]/g,'');
  const s=/spine2|upperchest|chestupper/.test(n)?100:/spine3|chest/.test(n)?90:/spine1/.test(n)?65:/spine/.test(n)?45:0;
  if(s>score){score=s;best=bone;}
 });
 return score>0?best:null;
}
function stableId(o){return String(o?.userData?.editorId||'');}
export class RobotInventory{
 constructor(editor){this.editor=editor;this.activeRobot=null;this.tab='pocket';}
 owned(robot,obj){return this.editor.canEdit(robot)&&this.editor.canEdit(obj)&&obj.userData?.pickable===true&&canBePickable(obj.userData.editorKind);}
 entries(robot){
  if(!robot)return [];
  const id=stableId(robot),items=this.editor.items;
  const bags=items.filter(o=>cleanInventory(o.userData?.inventory).category==='backpack'&&o.userData?.storage?.type==='worn'&&o.userData.storage.holderId===id);
  const bagIds=new Set(bags.map(stableId));
  return items.filter(o=>o.userData?.storage?.holderId===id||o.userData?.storage?.type==='bag'&&bagIds.has(o.userData.storage.bagId));
 }
 slot(robot,preferred='back'){
  const used=this.entries(robot).filter(o=>o.userData.storage?.type==='worn').map(o=>o.userData.storage.slot);
  return [preferred,preferred==='back'?'front':'back'].find(slot=>!used.includes(slot))||null;
 }
 bagFor(robot){return this.entries(robot).find(o=>o.userData.storage?.type==='worn'&&cleanInventory(o.userData.inventory).category==='backpack')||null;}
 collect(robot,obj){
  if(!this.owned(robot,obj)||obj.userData.storage||robot.userData.robotCarry||!this.editor.physics?.enabled)return false;
  const setting=cleanInventory(obj.userData.inventory);if(setting.category==='world')return false;
  const owned=this.entries(robot),id=stableId(robot);
  let storage;
  if(['backpack','jetpack','parachute','wearable'].includes(setting.category)){
   const slot=this.slot(robot);if(!slot){this.editor.toast?.('Both front/back backpack slots are occupied');return false;}
   storage={type:'worn',holderId:id,slot};
  }else if(setting.size==='bag'){
   const bag=this.bagFor(robot);
   if(!bag){this.editor.toast?.('This item needs a backpack first');return false;}
   if(owned.filter(o=>o.userData.storage?.type==='bag'&&o.userData.storage?.bagId===stableId(bag)).length>=24){this.editor.toast?.('Backpack is full');return false;}
   storage={type:'bag',bagId:stableId(bag)};
  }else{
   if(owned.filter(o=>o.userData.storage?.type==='pocket').length>=12){this.editor.toast?.('Pockets are full');return false;}
   storage={type:'pocket',holderId:id};
  }
  obj.userData.storage=storage;
  this.applyState(obj);this.editor.queueSave(obj);
  this.editor.toast?.(`${obj.name} → ${storage.type==='worn'?storage.slot:storage.type}`);
  this.render();return true;
 }
 pickupNearest(robot){
  const obj=pickableTarget(robot,this.editor.items);
  return obj&&cleanInventory(obj.userData.inventory).category!=='world'?this.collect(robot,obj):false;
 }
 applyState(obj){
  const storage=cleanStorage(obj.userData?.storage);
  if(!storage){obj.visible=true;return;}
  // Stored items are not physical scene obstacles while pocketed or carried.
  this.editor.physics?.remove?.(stableId(obj));
  obj.visible=storage.type==='worn';
 }
 reconcile(){
  const ids=new Map(this.editor.items.map(o=>[stableId(o),o]));
  for(const obj of this.editor.items){
   const storage=cleanStorage(obj.userData?.storage);if(!storage)continue;
   const ref=storage.type==='bag'?ids.get(storage.bagId):ids.get(storage.holderId);
   const valid=ref&&(storage.type==='bag'?cleanInventory(ref.userData?.inventory).category==='backpack':ref.userData?.editorKind==='robot');
   if(!valid){delete obj.userData.storage;obj.visible=true;this.editor.physics?.sync?.(obj);this.editor.queueSave?.(obj);}
   else this.applyState(obj);
  }
 }
 wearablePose(robot,obj){
  const bone=bodyBackBone(robot);
  robot.updateWorldMatrix(true,true);
  const local=new THREE.Vector3(0,.0,obj.userData.storage.slot==='front'?.24:-.26);
  let p,q;
  if(bone){p=bone.localToWorld(local.clone());q=bone.getWorldQuaternion(new THREE.Quaternion());}
  else {p=robot.localToWorld(new THREE.Vector3(0,1.3,obj.userData.storage.slot==='front'?.27:-.27));q=robot.getWorldQuaternion(new THREE.Quaternion());}
  // Avoid assuming all authored GLBs use the same orientation convention.
  const parent=obj.parent?.getWorldQuaternion?.(new THREE.Quaternion())||new THREE.Quaternion();
  obj.quaternion.copy(parent.invert().multiply(q));
  obj.position.copy(obj.parent?.worldToLocal?.(p.clone())||p);
 }
 tick(){
  for(const obj of this.editor.items){const storage=cleanStorage(obj.userData?.storage);if(!storage)continue;
   if(storage.type==='worn'){
    const robot=this.editor.items.find(r=>stableId(r)===storage.holderId&&r.userData.editorKind==='robot');
    if(robot){obj.visible=true;this.wearablePose(robot,obj);}else obj.visible=false;
   }else obj.visible=false;
  }
 }
 drop(robot,obj){
  const storage=cleanStorage(obj.userData.storage);
  if(!storage||!this.editor.canEdit(robot)||!this.editor.canEdit(obj))return false;
  const related=this.entries(robot).includes(obj);
  if(!related)return false;
  if(storage.type==='bag'){/* An item may be taken out of an equipped bag. */}
  delete obj.userData.storage;obj.visible=true;
  const forward=new THREE.Vector3(Math.sin(robot.rotation.y),0,Math.cos(robot.rotation.y));
  obj.position.copy(robot.position).addScaledVector(forward,.65);
  // Respect the object's pivot, including offset procedural mesh geometries.
  obj.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3().setFromObject(obj);
  if(!bounds.isEmpty())obj.position.y+=robot.position.y-bounds.min.y;
  obj.userData.physics={...obj.userData.physics,mode:'dynamic'};
  this.editor.physics.sync(obj);this.editor.physics.applyEditedPose?.(obj);this.editor.queueSave(obj);
  this.render();return true;
 }
 transfer(robot,obj){
  if(!this.entries(robot).includes(obj)||!this.editor.canEdit(obj))return false;
  const current=cleanStorage(obj.userData.storage),cfg=cleanInventory(obj.userData.inventory);
  if(!current||current.type==='worn')return false;
  if(current.type==='pocket'){
   const bag=this.bagFor(robot);if(!bag){this.editor.toast?.('Wear a backpack before moving this item');return false;}
   if(this.entries(robot).filter(o=>o.userData.storage?.type==='bag'&&o.userData.storage.bagId===stableId(bag)).length>=24)return false;
   obj.userData.storage={type:'bag',bagId:stableId(bag)};
  }else{
   if(cfg.size==='bag'){this.editor.toast?.('This item is too large for a pocket');return false;}
   if(this.entries(robot).filter(o=>o.userData.storage?.type==='pocket').length>=12)return false;
   obj.userData.storage={type:'pocket',holderId:stableId(robot)};
  }
  this.editor.queueSave(obj);this.render();return true;
 }
 moveBag(robot,obj){
  const storage=cleanStorage(obj.userData.storage);
  if(storage?.type!=='worn'||storage.holderId!==stableId(robot)||!this.editor.canEdit(obj))return false;
  const free=this.slot(robot,storage.slot==='front'?'back':'front');
  if(!free||free===storage.slot)return false;
  obj.userData.storage={...storage,slot:free};this.editor.queueSave(obj);this.render();return true;
 }
 use(robot,obj){
  if(!this.entries(robot).includes(obj)||!this.editor.canEdit(obj))return false;
  const cfg=cleanInventory(obj.userData.inventory);
  if(!cfg.consumable){this.editor.toast?.(`${obj.name}: no configured use action`);return false;}
  if(cfg.category==='backpack'&&this.editor.items.some(o=>o.userData.storage?.bagId===stableId(obj))){this.editor.toast?.('Empty backpack before consuming it');return false;}
  // Real scene identity is removed: consumption is not temporary invisibility.
  this.editor.physics.remove(stableId(obj));this.editor.items=this.editor.items.filter(o=>o!==obj);
  if(this.editor.selected===obj){this.editor.selected=null;const panel=document.getElementById('propertiesPanel');if(panel)panel.hidden=true;}
  obj.removeFromParent();this.editor.persistRemoval(stableId(obj));this.editor.disposeObject?.(obj);
  this.editor.toast?.(`${cfg.category==='food'?'Ate':'Used'} ${obj.name}`);this.render();return true;
 }
 show(robot){if(!robot||robot.userData.editorKind!=='robot')return;this.activeRobot=robot;const panel=document.getElementById('robotInventoryPanel');if(panel)panel.hidden=false;this.render();}
 render(){
  const panel=document.getElementById('robotInventoryPanel');if(!panel||panel.hidden)return;
  const robot=this.activeRobot;
  if(!robot||!this.editor.items.includes(robot)){panel.hidden=true;return;}
  const title=document.getElementById('inventoryRobotName');if(title)title.textContent=robot.name;
  for(const tab of panel.querySelectorAll('[data-inventory-tab]')){
   tab.classList.toggle('active',tab.dataset.inventoryTab===this.tab);
   tab.setAttribute('aria-selected',String(tab.dataset.inventoryTab===this.tab));
  }
  const rows=document.getElementById('robotInventoryItems');rows.replaceChildren();
  const items=this.entries(robot).filter(obj=>{
   const storage=obj.userData.storage;
   return this.tab==='pocket'?storage.type==='pocket':this.tab==='wearable'?storage.type==='worn':storage.type==='bag';
  });
  if(!items.length){const empty=document.createElement('p');empty.className='small-note';empty.textContent='No items in this category';rows.append(empty);return;}
  for(const item of items){
   const line=document.createElement('div');line.className='robot-inventory-item';
   const info=document.createElement('div');const name=document.createElement('strong');name.textContent=item.name;
   const detail=document.createElement('small');detail.textContent=cleanInventory(item.userData.inventory).category+(item.userData.storage?.slot?' · '+item.userData.storage.slot:'');info.append(name,detail);line.append(info);
   const action=(text,fn)=>{const button=document.createElement('button');button.type='button';button.textContent=text;button.disabled=!this.editor.canEdit(item)||!this.editor.canEdit(robot);button.onclick=()=>fn.call(this,robot,item);line.append(button);};
   if(item.userData.storage?.type==='worn')action('Front / Back',this.moveBag);
   else action(item.userData.storage.type==='pocket'?'To bag':'To pocket',this.transfer);
   if(cleanInventory(item.userData.inventory).consumable)action(cleanInventory(item.userData.inventory).category==='food'?'Eat':'Use',this.use);
   action('Drop',this.drop);rows.append(line);
  }
 }
 bind(){
  const panel=document.getElementById('robotInventoryPanel');if(!panel)return;
  panel.querySelector('[data-inventory-close]')?.addEventListener('click',()=>panel.hidden=true);
  for(const button of panel.querySelectorAll('[data-inventory-tab]'))button.addEventListener('click',()=>{this.tab=button.dataset.inventoryTab;this.render();});
  document.getElementById('robotInventoryOpen')?.addEventListener('click',()=>this.show(this.editor.controlledRobot()||this.editor.robot()));
 }
}
