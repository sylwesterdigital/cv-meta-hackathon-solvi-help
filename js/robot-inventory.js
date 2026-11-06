// Scene-backed inventory: objects keep stable IDs and their bag relationship.
// A bag's contents refer to its ID, not to the avatar wearing it. Dropping the
// bag therefore never extracts/destroys its contents.
import * as THREE from 'three';
import {pickableTarget,canBePickable} from './object-carry.js';
import {capturePresetThumbnail} from './object-presets.js';
import {makeFurniture} from './primitive-properties.js';
import {fridgeSlotPose} from './interactive-props.js';
import {applyEditMode,isEditMode} from './edit-mode.js';
import {HANDS,isToolObject,updateHeldPose,cleanToolGripProfile} from './held-equipment.js';
import {TOOL_ACTIVITIES,cleanToolAnimationName} from './tool-activities.js';

export const INVENTORY_CATEGORIES=Object.freeze(['world','general','key','money','phone','notepad','tool','food','backpack','jetpack','parachute','wearable']);
export const INVENTORY_SIZES=Object.freeze(['pocket','bag']);
export const ATTACH_BONES=Object.freeze(['auto','spine','spine1','spine2','spine3','chest','head','hips','leftShoulder','rightShoulder']);
export function cleanWearAttachment(raw){
 const o=raw&&typeof raw==='object'?raw:{};
 const vector=(value,max)=>[0,1,2].map(i=>{const n=Number(Array.isArray(value)?value[i]:0);return Number.isFinite(n)?Math.max(-max,Math.min(max,n)):0;});
 return {bone:ATTACH_BONES.includes(o.bone)?o.bone:'auto',followRotation:o.followRotation!==false,
  position:vector(o.position,2),rotation:vector(o.rotation,720)};
}

export function cleanInventory(raw){
 if(!raw||typeof raw!=='object')return {category:'world',size:'pocket',consumable:false};
 const category=INVENTORY_CATEGORIES.includes(raw.category)?raw.category:'world';
 return {...{category,size:INVENTORY_SIZES.includes(raw.size)?raw.size:'pocket',consumable:raw.consumable===true},...(raw.attachment?{attachment:cleanWearAttachment(raw.attachment)}:{}),
  ...(raw.actionClip?{actionClip:cleanToolAnimationName(raw.actionClip)}:{}),
  ...(raw.grip&&typeof raw.grip==='object'&&['left','right'].some(h=>raw.grip[h])?{grip:Object.fromEntries(['left','right'].filter(h=>raw.grip[h]).map(h=>[h,cleanToolGripProfile(raw.grip[h])]))}:{})};
}
export function cleanStorage(raw){
 if(!raw||typeof raw!=='object')return null;
 if(!['pocket','bag','worn','container','held'].includes(raw.type))return null;
 const id=/^[A-Za-z0-9_-]{8,80}$/;
 if(raw.type==='container')return typeof raw.containerId==='string'&&id.test(raw.containerId)&&Number.isInteger(raw.slot)&&raw.slot>=0&&raw.slot<48?{type:'container',containerId:raw.containerId,slot:raw.slot}:null;
 if(raw.type==='held')return Object.keys(raw).length===3&&typeof raw.holderId==='string'&&id.test(raw.holderId)&&HANDS.includes(raw.hand)?{type:'held',holderId:raw.holderId,hand:raw.hand}:null;
 if(raw.type==='bag')return typeof raw.bagId==='string'&&id.test(raw.bagId)?{type:'bag',bagId:raw.bagId}:null;
 if(typeof raw.holderId!=='string'||!id.test(raw.holderId))return null;
 return raw.type==='worn'&&['front','back'].includes(raw.slot)?{type:'worn',holderId:raw.holderId,slot:raw.slot}:
  raw.type==='pocket'?{type:'pocket',holderId:raw.holderId}:null;
}
export function inventoryLocation(obj){return cleanStorage(obj?.userData?.storage)?.type||'ground';}
export function bodyBackBone(robot,chosen='auto'){
 const visual=robot?.children?.find(c=>c.userData?.robotVisual);
 let best=null,score=-1;
 const terms={spine:/spine(?!\d)/,spine1:/spine1/,spine2:/spine2/,spine3:/spine3/,chest:/chest/,head:/head/,hips:/hips|pelvis/,leftShoulder:/leftshoulder|lshoulder/,rightShoulder:/rightshoulder|rshoulder/};
 visual?.traverse?.(bone=>{
  if(!bone.isBone)return;
  const n=String(bone.name).toLowerCase().replace(/[^a-z0-9]/g,'');
  const exact=terms[chosen]?.test(n);
  const value=chosen==='auto'?(/spine2|upperchest|chestupper/.test(n)?100:/spine3|chest/.test(n)?90:/spine1/.test(n)?65:/spine/.test(n)?45:0):(exact?100:0);
  if(value>score){score=value;best=bone;}
 });
 return score>0?best:null;
}
function stableId(o){return String(o?.userData?.editorId||'');}
export class RobotInventory{
 constructor(editor){this.editor=editor;this.activeRobot=null;this.tab='held';this.previewCache=new Map();this.portraitToken=0;}
 owned(robot,obj){return this.editor.canEdit(robot)&&this.editor.canEdit(obj)&&obj.userData?.pickable===true&&canBePickable(obj.userData.editorKind);}
 entries(robot){
  if(!robot)return [];
  const id=stableId(robot),items=this.editor.items;
  const bags=items.filter(o=>cleanInventory(o.userData?.inventory).category==='backpack'&&o.userData?.storage?.type==='worn'&&o.userData.storage.holderId===id);
  const bagIds=new Set(bags.map(stableId));
  if(robot.userData.backpackEnabled===true)bagIds.add(id);
  return items.filter(o=>o.userData?.storage?.holderId===id||o.userData?.storage?.type==='bag'&&bagIds.has(o.userData.storage.bagId));
 }
 slot(robot,preferred='back'){
  const used=this.entries(robot).filter(o=>o.userData.storage?.type==='worn').map(o=>o.userData.storage.slot);
  return [preferred,preferred==='back'?'front':'back'].find(slot=>!used.includes(slot))||null;
 }
 bagFor(robot){return this.entries(robot).find(o=>o.userData.storage?.type==='worn'&&cleanInventory(o.userData.inventory).category==='backpack')||(robot.userData.backpackEnabled===true?robot:null);}
 backpackReady(robot){return Boolean(this.bagFor(robot));}
 setAvatarBackpack(robot,enabled){
  if(!robot||!this.editor.canEdit(robot))return false;
  if(!enabled&&this.editor.items.some(o=>o.userData?.storage?.type==='bag'&&o.userData.storage.bagId===stableId(robot))){this.editor.toast?.('Empty the avatar backpack before disabling it');return false;}
  robot.userData.backpackEnabled=enabled===true;this.editor.queueSave(robot);this.render();
  this.editor.toast?.(enabled?'Avatar backpack is ready for storage':'Avatar backpack storage disabled');return true;
 }
 heldFor(robot,hand='right'){return this.entries(robot).find(o=>o.userData.storage?.type==='held'&&o.userData.storage.hand===hand)||null;}
 freeHand(robot,preferred='right'){return [preferred,preferred==='right'?'left':'right'].find(hand=>!this.heldFor(robot,hand))||null;}
 hold(robot,obj,preferred='right'){
  if(!this.owned(robot,obj)||!HANDS.includes(preferred)||robot.userData.robotCarry)return false;
  const storage=cleanStorage(obj.userData.storage);
  if(storage&&!this.entries(robot).includes(obj))return false;
  if(storage?.type==='worn'||storage?.type==='container')return false;
  const hand=this.freeHand(robot,preferred);if(!hand){this.editor.toast?.('Both hands are occupied');return false;}
  let cfg=cleanInventory(obj.userData.inventory);
  const drinkVariant=obj.userData.furniture?.variant;
  if(cfg.category==='world'&&['can','bottle'].includes(drinkVariant)){
   cfg=cleanInventory({category:'food',size:'pocket',consumable:!/^Empty /i.test(obj.name)});obj.userData.inventory=cfg;
  }
  if(cfg.category==='world'||['backpack','wearable','jetpack','parachute'].includes(cfg.category))return false;
  obj.userData.storage={type:'held',holderId:stableId(robot),hand};
  this.applyState(obj);updateHeldPose(robot,obj,hand);this.editor.queueSave(obj);this.render();
  this.editor.toast?.(`${obj.name} held in ${hand} hand`);return true;
 }
 stowToBag(robot,obj){
  if(!this.owned(robot,obj)||!this.entries(robot).includes(obj)||obj.userData.storage?.type!=='held')return false;
  const bag=this.bagFor(robot);
  if(!bag){this.editor.toast?.('No functional backpack. Open B → Backpack to activate the avatar backpack.');return false;}
  if(!this.editor.canEdit(bag)){this.editor.toast?.('Backpack belongs to another participant');return false;}
  if(this.entries(robot).filter(o=>o.userData.storage?.type==='bag'&&o.userData.storage.bagId===stableId(bag)).length>=24){this.editor.toast?.('Backpack is full');return false;}
  obj.userData.storage={type:'bag',bagId:stableId(bag)};this.applyState(obj);this.editor.queueSave(obj);this.render();
  this.editor.toast?.(`${obj.name} → backpack`);return true;
 }
 stow(robot,obj){
  if(!this.owned(robot,obj)||!this.entries(robot).includes(obj)||obj.userData.storage?.type!=='held')return false;
  const cfg=cleanInventory(obj.userData.inventory),id=stableId(robot);let storage=null;
  if(cfg.size==='pocket'&&this.entries(robot).filter(o=>o.userData.storage?.type==='pocket').length<12)storage={type:'pocket',holderId:id};
  else {const bag=this.bagFor(robot);if(bag&&this.entries(robot).filter(o=>o.userData.storage?.type==='bag'&&o.userData.storage.bagId===stableId(bag)).length<24)storage={type:'bag',bagId:stableId(bag)};}
  if(!storage){this.editor.toast?.('No storage fits this item. Keep holding it or drop it.');return false;}
  obj.userData.storage=storage;this.applyState(obj);this.editor.queueSave(obj);this.render();return true;
 }
 collect(robot,obj){
  if(!this.owned(robot,obj)||obj.userData.storage||robot.userData.robotCarry)return false;
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
 toggleBackpack(robot){
  if(!robot||robot.userData.editorKind!=='robot'||!this.editor.canEdit(robot))return false;
  const carry=robot.userData.robotCarry;
  if(carry){const held=this.editor.items.find(o=>stableId(o)===carry.objectId);
   if(held&&cleanInventory(held.userData.inventory).category==='backpack')return this.editor.carry?.drop?.(robot)===true;
   return false;
  }
  const nearby=pickableTarget(robot,this.editor.items);
  if(nearby&&cleanInventory(nearby.userData.inventory).category==='backpack')return this.collect(robot,nearby);
  const worn=this.entries(robot).filter(o=>o.userData.storage?.type==='worn'&&cleanInventory(o.userData.inventory).category==='backpack');
  const bag=worn.find(o=>o.userData.storage.slot==='back')||worn[0];
  return bag?this.drop(robot,bag):false;
 }
 promoteCarriedDrink(robot){
  const carried=robot?.userData?.robotCarry;
  if(!carried?.objectId)return null;
  const obj=this.editor.items.find(o=>stableId(o)===carried.objectId);
  if(!obj||!['can','bottle'].includes(obj.userData?.furniture?.variant)||!this.owned(robot,obj))return null;
  // Release the legacy transient hand state through its normal multiplayer
  // path before using the persistent Held/Backpack protocol.
  if(!this.editor.carry?.drop?.(robot))return null;
  if(!this.hold(robot,obj))return null;
  return obj;
 }
 pickupNearest(robot){
  const obj=pickableTarget(robot,this.editor.items);
  return obj&&cleanInventory(obj.userData.inventory).category!=='world'?(isToolObject(obj)||cleanInventory(obj.userData.inventory).category==='food'?this.hold(robot,obj):this.collect(robot,obj)):false;
 }
 applyState(obj){
  const storage=cleanStorage(obj.userData?.storage);
  if(!storage){obj.visible=true;return;}
  // Stored items are not physical scene obstacles while pocketed or carried.
  this.editor.physics?.remove?.(stableId(obj));
  obj.visible=storage.type==='worn'||storage.type==='held'||storage.type==='container'&&this.placeInContainer(obj,storage);
 }
 reconcile(){
  const ids=new Map(this.editor.items.map(o=>[stableId(o),o]));
  const claimedHands=new Set();
  for(const obj of this.editor.items){
   const storage=cleanStorage(obj.userData?.storage);if(!storage)continue;
   if(storage.type==='held'){const slot=storage.holderId+':'+storage.hand;if(claimedHands.has(slot)){
    // Unexpected duplicate in a bulk/legacy scene: don't publish a destructive guess.
    obj.visible=false;this.editor.sceneDiagnostic?.('equipment-hand-conflict',{id:stableId(obj),holderId:storage.holderId,hand:storage.hand});continue;
   }claimedHands.add(slot);}
   const ref=storage.type==='bag'?ids.get(storage.bagId):storage.type==='container'?ids.get(storage.containerId):ids.get(storage.holderId);
   const valid=ref&&(storage.type==='bag'?(cleanInventory(ref.userData?.inventory).category==='backpack'||ref.userData?.editorKind==='robot'&&ref.userData.backpackEnabled===true):storage.type==='container'?ref.userData?.furniture?.variant==='bin'&&storage.slot<24||ref.userData?.furniture?.variant==='fridge'&&Boolean(fridgeSlotPose(ref.userData.furniture,storage.slot)):ref.userData?.editorKind==='robot');
   if(!valid&&(['held','bag'].includes(storage.type)||storage.type==='container'&&!ref)){obj.visible=false;continue;} // Delta ordering: never erase an equipment claim while its owner is loading.
   if(!valid){delete obj.userData.storage;obj.visible=true;this.editor.physics?.sync?.(obj);this.editor.queueSave?.(obj);}
   else this.applyState(obj);
  }
 }
 wearablePose(robot,obj){
  const settings=cleanWearAttachment(obj.userData.inventory?.attachment);
  const bone=bodyBackBone(robot,settings.bone);
  robot.updateWorldMatrix(true,true);
  const slot=obj.userData.storage.slot;
  const reference=bone||robot;
  const bonePos=bone?bone.getWorldPosition(new THREE.Vector3()):robot.localToWorld(new THREE.Vector3(0,1.3,0));
  const boneRotation=bone?bone.getWorldQuaternion(new THREE.Quaternion()):robot.getWorldQuaternion(new THREE.Quaternion());
  const rootRotation=robot.getWorldQuaternion(new THREE.Quaternion());
  const follow=settings.followRotation?boneRotation:rootRotation;
  // Configurable bone-space translation, including front/back slot offset.
  const offset=new THREE.Vector3(settings.position[0],settings.position[1]-.2,settings.position[2]+(slot==='front'?.24:-.26));
  const worldPos=bonePos.add(offset.applyQuaternion(follow));
  const angles=settings.rotation.map(THREE.MathUtils.degToRad);
  const yawDefault=slot==='back'?90:-90; // Backpack should lie along the spine, rather than sideways.
  const rotation=new THREE.Quaternion().setFromEuler(new THREE.Euler(angles[0],angles[1]+THREE.MathUtils.degToRad(yawDefault),angles[2],'XYZ'));
  const parent=obj.parent?.getWorldQuaternion?.(new THREE.Quaternion())||new THREE.Quaternion();
  obj.quaternion.copy(parent.invert().multiply(follow).multiply(rotation));
  obj.position.copy(obj.parent?.worldToLocal?.(worldPos.clone())||worldPos);
 }
 placeInContainer(obj,storage){
  const container=this.editor.items.find(o=>stableId(o)===storage.containerId&&['fridge','bin'].includes(o.userData?.furniture?.variant));
  if(!container)return false;
  if(container.userData.furniture.variant==='bin')return false; // Empty cans are stored invisibly inside the opaque bin.
  const slot=fridgeSlotPose(container.userData.furniture,storage.slot);if(!slot)return false;
  container.updateWorldMatrix(true,false);
  const pos=container.localToWorld(new THREE.Vector3(slot.x,slot.y,slot.z));
  obj.position.copy(obj.parent?.worldToLocal?.(pos)||pos);
  return container.userData.furniture.open===true;
 }
 releaseContainer(container){
  if(!['fridge','bin'].includes(container?.userData?.furniture?.variant))return;
  for(const obj of this.editor.items){if(obj.userData?.storage?.type!=='container'||obj.userData.storage.containerId!==stableId(container))continue;
   delete obj.userData.storage;obj.visible=true;
   const pos=container.localToWorld(new THREE.Vector3(0,.3,container.userData.furniture.depth/2+.5));
   obj.position.copy(obj.parent?.worldToLocal?.(pos)||pos);this.editor.physics?.sync?.(obj);this.editor.queueSave?.(obj);
  }
 }
 tick(){
  for(const obj of this.editor.items){const storage=cleanStorage(obj.userData?.storage);if(!storage)continue;
   if(storage.type==='held'){
    const robot=this.editor.items.find(r=>stableId(r)===storage.holderId&&r.userData.editorKind==='robot');
    obj.visible=robot?updateHeldPose(robot,obj,storage.hand):false;
   }else if(storage.type==='worn'){
    const robot=this.editor.items.find(r=>stableId(r)===storage.holderId&&r.userData.editorKind==='robot');
    if(robot){obj.visible=true;this.wearablePose(robot,obj);}else obj.visible=false;
   }else if(storage.type==='container')obj.visible=this.placeInContainer(obj,storage);
   else obj.visible=false;
  }
 }
 storeInBin(robot,obj,bin){
  if(!robot||!obj||!bin||bin.userData?.furniture?.variant!=='bin'||
   !this.editor.canEdit(robot)||!this.editor.canEdit(obj)||!this.editor.canEdit(bin)||
   !this.owned(robot,obj)||obj.userData.storage?.type!=='held'||obj.userData.storage.holderId!==stableId(robot)||
   !(['can','bottle'].includes(obj.userData.furniture?.variant)&&obj.userData.inventory?.consumable===false||
     obj.userData.furniture?.variant==='box'&&cleanInventory(obj.userData.inventory).category==='general'&&obj.userData.inventory?.consumable===false))return false;
  // Do not let a renamed oversized box become hidden inside a normal small bin.
  if(obj.userData.furniture?.variant==='box'){
   const bounds=new THREE.Box3().setFromObject(obj);const size=bounds.getSize(new THREE.Vector3());
   if(size.lengthSq()===0||Math.max(size.x,size.y,size.z)>1.55)return false;
  }
  const count=this.editor.items.filter(o=>o.userData.storage?.type==='container'&&o.userData.storage.containerId===stableId(bin));
  if(count.length>=24)return false;
  const occupied=new Set(count.map(o=>o.userData.storage.slot));
  const slot=Array.from({length:24},(_,i)=>i).find(i=>!occupied.has(i));
  if(slot===undefined)return false;
  obj.userData.storage={type:'container',containerId:stableId(bin),slot};
  this.applyState(obj);this.editor.queueSave(obj);this.render();return true;
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
  if(current.type==='held')return this.stow(robot,obj);
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
 drink(robot,obj){
  const variant=obj?.userData?.furniture?.variant;
  if(!['can','bottle'].includes(variant)||!this.owned(robot,obj)||obj.userData.storage?.type!=='held'||obj.userData.storage.holderId!==stableId(robot))return false;
  if(!cleanInventory(obj.userData.inventory).consumable){this.editor.toast?.(`${obj.name} is empty`);return false;}
  // Drink the contents, do not delete the physical can/bottle. It can still be dropped or recycled.
  obj.userData.inventory=cleanInventory({...obj.userData.inventory,category:'food',consumable:false});
  obj.name='Empty '+(variant==='can'?'Can':'Bottle');
  this.editor.queueSave(obj);this.render();
  this.editor.toast?.(`Drank ${variant}. Empty ${variant} remains in hand (I to drop, Shift+I to bag).`);return true;
 }
 useHeldItem(robot,obj){
  if(obj?.userData?.furniture&&['can','bottle'].includes(obj.userData.furniture.variant))return this.drink(robot,obj);
  return this.useHeldTool(robot,obj);
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
 swapHand(robot,obj){
  if(!this.owned(robot,obj)||!this.entries(robot).includes(obj)||obj.userData.storage?.type!=='held')return false;
  const next=obj.userData.storage.hand==='left'?'right':'left';
  if(this.heldFor(robot,next)){
   this.editor.toast?.(`${next} hand is already occupied`);return false;
  }
  obj.userData.storage={...obj.userData.storage,hand:next};
  updateHeldPose(robot,obj,next);
  this.editor.queueSave(obj);this.render();
  this.editor.toast?.(`${obj.name} switched to ${next} hand`);return true;
 }
 configureGrip(robot,obj){
  if(!this.owned(robot,obj)||!isToolObject(obj))return false;
  // Grip authoring belongs to the editor, even when opened from Explore inventory.
  if(!isEditMode())applyEditMode(true,{persist:true});
  this.editor.toolGripEditingHand=obj.userData.storage?.hand==='left'?'left':'right';
  this.editor.select(obj);
  // Keep the inventory open while calibrating: no forced reopen with B.
  const details=document.getElementById('toolGripDetails');
  if(details){details.open=true;const advanced=document.getElementById('toolGripAdvanced');if(advanced)advanced.open=false;details.scrollIntoView?.({block:'nearest',behavior:'smooth'});}
  return true;
 }
 aimHeldTool(robot,obj){
  if(!this.owned(robot,obj)||obj.userData.storage?.type!=='held'||obj.userData.storage.holderId!==stableId(robot)||obj.userData.furniture?.variant!=='shovel')return false;
  return this.editor.aimHeldTool?.(robot,obj)===true;
 }
 useHeldTool(robot,obj){
  if(!this.owned(robot,obj)||obj.userData.storage?.type!=='held'||obj.userData.storage.holderId!==stableId(robot))return false;
  return this.editor.performToolUse?.(robot,obj)===true;
 }
 show(robot){if(!robot||robot.userData.editorKind!=='robot')return;this.activeRobot=robot;const panel=document.getElementById('robotInventoryPanel');if(panel)panel.hidden=false;this.render();}
 updatePortrait(robot){
  const frame=document.getElementById('inventoryRobotPortrait');if(!frame)return;
  frame.textContent=(robot.name||'R').slice(0,1).toUpperCase();
  const portrait=robot.userData.robotBrain?.portrait,token=++this.portraitToken;
  if(!portrait||!window.solviAPI?.mediaBlob)return;
  const cached=this.editor.robotPortraitCache?.get(portrait);
  const promise=cached||window.solviAPI.mediaBlob(portrait).catch(()=>null);
  if(!cached)this.editor.robotPortraitCache?.set(portrait,promise);
  Promise.resolve(promise).then(url=>{
   if(!url||token!==this.portraitToken||this.activeRobot!==robot||!frame.isConnected)return;
   const image=document.createElement('img');image.src=url;image.alt='';frame.replaceChildren(image);
  });
 }
 itemThumbnail(item){
  const id=stableId(item),kind=item.userData.editorKind;
  const key=id+':'+JSON.stringify(item.userData.furniture||{});
  if(this.previewCache.has(key))return this.previewCache.get(key);
  let source=null,image='';
  try{
   if(kind==='furniture')source=makeFurniture(item.userData.furniture||{});
   else if(item.isObject3D)source=item;
   if(source)image=capturePresetThumbnail(this.editor,source);
  }catch(error){console.warn('Inventory thumbnail unavailable',error);}
  finally{if(source&&source!==item){source.traverse(o=>{o.geometry?.dispose?.();for(const mat of Array.isArray(o.material)?o.material:[o.material])mat?.dispose?.();});}}
  this.previewCache.set(key,image);return image;
 }
 render(){
  const panel=document.getElementById('robotInventoryPanel');if(!panel||panel.hidden)return;
  const robot=this.activeRobot;
  if(!robot||!this.editor.items.includes(robot)){panel.hidden=true;return;}
  const title=document.getElementById('inventoryRobotName');if(title)title.textContent=robot.name;this.updatePortrait(robot);
  for(const tab of panel.querySelectorAll('[data-inventory-tab]')){
   tab.classList.toggle('active',tab.dataset.inventoryTab===this.tab);
   tab.setAttribute('aria-selected',String(tab.dataset.inventoryTab===this.tab));
  }
  // Emergency-access controls are independent of the card image and scroll area.
  for(const hand of ['right','left']){
   const button=document.getElementById(hand==='right'?'inventoryDropRight':'inventoryDropLeft');
   if(!button)continue;
   const held=this.heldFor(robot,hand);
   button.hidden=this.tab!=='held'||!held;
   button.disabled=!held||!this.editor.canEdit(robot)||!this.editor.canEdit(held);
   button.textContent=held?`Drop ${held.name} (${hand}) · I`:`Drop ${hand}-hand tool · I`;
  }
  const firstHeld=this.heldFor(robot,'right')||this.heldFor(robot,'left');
  const storeBtn=document.getElementById('inventoryStowBag');
  if(storeBtn){storeBtn.hidden=this.tab!=='held'||!firstHeld;storeBtn.disabled=!this.editor.canEdit(robot)||!this.editor.canEdit(firstHeld);}
  const avatarBagBtn=document.getElementById('inventoryAvatarBackpack');
  if(avatarBagBtn){const worn=this.entries(robot).some(o=>o.userData.storage?.type==='worn'&&cleanInventory(o.userData.inventory).category==='backpack');avatarBagBtn.hidden=this.tab!=='bag'||worn;avatarBagBtn.disabled=!this.editor.canEdit(robot);avatarBagBtn.textContent=robot.userData.backpackEnabled?'Disable avatar backpack':'Enable avatar backpack';}
  const hint=document.getElementById('inventoryActionHint');
  if(hint)hint.textContent=this.tab==='held'?'I · pick up / drop   Shift+I · backpack   U · use / drink   B · close':this.tab==='bag'?(this.backpackReady(robot)?'Backpack ready · Shift+I stores an item held in hand':'Visible avatar outfit is not automatically storage. Enable avatar backpack here.'):'I · hold / drop   B · close';
  const rows=document.getElementById('robotInventoryItems');rows.replaceChildren();
  const items=this.entries(robot).filter(obj=>{
   const storage=obj.userData.storage;
   return this.tab==='held'?storage.type==='held':this.tab==='pocket'?storage.type==='pocket':this.tab==='wearable'?storage.type==='worn':storage.type==='bag';
  });
  if(!items.length){const empty=document.createElement('p');empty.className='small-note';empty.textContent=this.tab==='bag'?(this.backpackReady(robot)?'Backpack empty':'No active backpack storage'):'No items in this category';rows.append(empty);return;}
  for(const item of items){
   const line=document.createElement('article');line.className='robot-inventory-item';line.setAttribute('role','listitem');if(item.userData.storage?.type==='held')line.classList.add('is-held');
   const picture=document.createElement('div');picture.className='inventory-item-thumb';
   const thumbnail=this.itemThumbnail(item);
   if(thumbnail){const img=document.createElement('img');img.src=thumbnail;img.alt='';picture.append(img);}
   else{const type=document.createElement('span');type.textContent=cleanInventory(item.userData.inventory).category.slice(0,1).toUpperCase();picture.append(type);}
   line.append(picture);
   const info=document.createElement('div');const name=document.createElement('strong');name.textContent=item.name;
   const detail=document.createElement('small');detail.textContent=cleanInventory(item.userData.inventory).category+(item.userData.storage?.slot?' · '+item.userData.storage.slot:'');info.className='inventory-item-info';info.append(name,detail);line.append(info);const actions=document.createElement('div');actions.className='inventory-item-actions';line.append(actions);
   const action=(text,fn)=>{const button=document.createElement('button');button.type='button';button.textContent=text;button.disabled=!this.editor.canEdit(item)||!this.editor.canEdit(robot);button.onclick=()=>fn.call(this,robot,item);actions.append(button);};
   if(item.userData.storage?.type==='worn'){action('Front / Back',this.moveBag);action('Take off',this.drop);}
   else if(item.userData.storage?.type==='held'){action('Store',this.stow);action('To backpack · Shift+I',this.stowToBag);if(isToolObject(item))action('Grip',this.configureGrip);action('Switch hand',this.swapHand);}
   else {action('Hold',this.hold);action(item.userData.storage.type==='pocket'?'To bag':'To pocket',this.transfer);}
   if(item.userData.storage?.type==='held'&&isToolObject(item)){
    const variant=item.userData.furniture?.variant,activity=TOOL_ACTIVITIES[variant];
    action(variant==='shovel'?'Dig · U':activity?.label||'Use · U',this.useHeldTool);
    if(variant==='shovel')action('Aim · click',this.aimHeldTool);
   }
   if(item.userData.storage?.type==='held'&&['can','bottle'].includes(item.userData.furniture?.variant))action(cleanInventory(item.userData.inventory).consumable?'Drink · U':'Empty',this.drink);
   else if(cleanInventory(item.userData.inventory).consumable)action(cleanInventory(item.userData.inventory).category==='food'?'Eat':'Use',this.use);
   if(item.userData.storage?.type!=='held')action('Drop',this.drop); // Held has one explicit Drop action above this list.
   rows.append(line);
  }
 }
 bind(){
  const panel=document.getElementById('robotInventoryPanel');if(!panel)return;
  panel.querySelector('[data-inventory-close]')?.addEventListener('click',()=>panel.hidden=true);
  for(const button of panel.querySelectorAll('[data-inventory-tab]'))button.addEventListener('click',()=>{this.tab=button.dataset.inventoryTab;this.render();});
  document.getElementById('inventoryStowBag')?.addEventListener('click',()=>{const robot=this.activeRobot,held=robot&&(this.heldFor(robot,'right')||this.heldFor(robot,'left'));if(held)this.stowToBag(robot,held);});
  document.getElementById('inventoryAvatarBackpack')?.addEventListener('click',()=>{const robot=this.activeRobot;if(robot)this.setAvatarBackpack(robot,robot.userData.backpackEnabled!==true);});
  document.getElementById('inventoryHoldNearby')?.addEventListener('click',()=>{const robot=this.activeRobot;if(!robot)return;const object=pickableTarget(robot,this.editor.items);if(!object||!this.hold(robot,object))this.editor.toast?.('Face a nearby portable item and make sure a hand is free');});
  for(const hand of ['right','left'])document.getElementById(hand==='right'?'inventoryDropRight':'inventoryDropLeft')?.addEventListener('click',()=>{
   const robot=this.activeRobot,held=robot&&this.heldFor(robot,hand);
   if(!held){this.editor.toast?.(`No tool is held in the ${hand} hand`);this.render();return;}
   if(!this.drop(robot,held))this.editor.toast?.(`Could not drop ${held.name}. Check edit permission and scene connection.`);
  });
  document.getElementById('robotInventoryOpen')?.addEventListener('click',()=>this.show(this.editor.controlledRobot()||this.editor.robot()));
 }
}
