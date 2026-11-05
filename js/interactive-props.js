// v0.2.193 Common persistent state and bounded refrigerator storage geometry.
export const STATEFUL_PROPS=Object.freeze(['fridge','laptop']);
export const FRIDGE_ITEM_TYPES=Object.freeze(['can','bottle','box']);
export const PROP_STATES=Object.freeze({fridge:['closed','open'],laptop:['closed','open'],printer:['idle','printing'],trackpad:['trackpad','mouse','stylus']});
export function isToggleProp(variant){return STATEFUL_PROPS.includes(variant);}
export function nextPropOpen(variant,current){return isToggleProp(variant)?!Boolean(current):Boolean(current);}
export function cleanDeviceMode(value){return ['trackpad','mouse','stylus'].includes(value)?value:'trackpad';}
export function fridgeLayout(p={}){
 const width=Math.max(.4,Math.min(3,Number(p.width)||.85)),depth=Math.max(.36,Math.min(2,Number(p.depth)||.68)),height=Math.max(.8,Math.min(4,Number(p.height)||1.85));
 const shelves=Math.max(1,Math.min(5,Math.round(Number(p.shelves)||3)));
 const usableW=Math.max(.25,width-.12),usableD=Math.max(.18,depth-.17),usableH=height-.16;
 const columns=Math.max(1,Math.min(4,Math.floor(usableW/.38)));
 const rows=Math.max(1,Math.min(2,Math.floor(usableD/.34)));
 const layers=shelves+1;
 const slotWidth=usableW/columns,slotDepth=usableD/rows,slotHeight=usableH/layers;
 return {columns,rows,layers,capacity:columns*rows*layers,slotWidth,slotDepth,slotHeight,width,depth,height,shelves};
}
export function fridgeSlotPose(p,slot){
 const layout=fridgeLayout(p);if(!Number.isInteger(slot)||slot<0||slot>=layout.capacity)return null;
 const col=slot%layout.columns,row=Math.floor(slot/layout.columns)%layout.rows,layer=Math.floor(slot/(layout.columns*layout.rows));
 return {x:-layout.width/2+.06+(col+.5)*layout.slotWidth,
  y:.08+layer*layout.slotHeight+.017,
  z:-layout.depth/2+.06+(row+.5)*layout.slotDepth,
  width:layout.slotWidth*.90,depth:layout.slotDepth*.90,height:layout.slotHeight*.88};
}
export function canStoreInFridge(fridge,item,occupied=[]){
 if(fridge?.variant!=='fridge'||!FRIDGE_ITEM_TYPES.includes(item?.variant))return -1;
 const layout=fridgeLayout(fridge);
 const iw=Number(item.width)||0,id=Number(item.depth)||0,ih=Number(item.height)||0;
 if(iw>layout.slotWidth*.9||id>layout.slotDepth*.9||ih>layout.slotHeight*.88)return -1;
 const taken=new Set(occupied.filter(n=>Number.isInteger(n)));
 for(let slot=0;slot<layout.capacity;slot++)if(!taken.has(slot))return slot;
 return -1;
}
export function propInteractionOf(mesh){
 let node=mesh;for(let steps=0;node&&steps<8;steps++,node=node.parent){if(node.userData?.propInteraction)return node.userData.propInteraction;}
 return null;
}
