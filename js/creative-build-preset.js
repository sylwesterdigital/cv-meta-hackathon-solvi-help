// Portable collections of bounded procedural primitives. Saved scene IDs,
// robot identities and owners are never copied into a preset.
const TYPES=new Set(['cube','sphere','cylinder','plane','torus','amorphous']);
const KEYS=['kind','name','position','rotation','scale','color','texture','primitive','openings'];
const finite3=arr=>Array.isArray(arr)&&arr.length===3&&arr.every(x=>typeof x==='number'&&Number.isFinite(x));
export function validCreativePart(part){
 if(!part||typeof part!=='object'||Array.isArray(part)||Object.keys(part).some(k=>!KEYS.includes(k))||!TYPES.has(part.kind))return false;
 if(typeof part.name!=='string'||!part.name.length||part.name.length>100)return false;
 if(!finite3(part.position)||part.position.some(v=>Math.abs(v)>100))return false;
 if(!finite3(part.rotation)||part.rotation.some(v=>Math.abs(v)>1000))return false;
 if(!finite3(part.scale)||part.scale.some(v=>v<.001||v>1000))return false;
 if(typeof part.color!=='string'||!/^#[a-fA-F0-9]{6}$/.test(part.color))return false;
 if(part.texture!==undefined&&part.texture!=='none')return false;
 if(part.primitive!==undefined&&(!part.primitive||typeof part.primitive!=='object'||Array.isArray(part.primitive)))return false;
 if(part.openings!==undefined&&(!Array.isArray(part.openings)||part.kind!=='cube'))return false;
 return true;
}
export function validCreativeBuild(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload)||Object.keys(payload).some(k=>!['kind','parts'].includes(k))||payload.kind!=='creativeBuild')return false;
 return Array.isArray(payload.parts)&&payload.parts.length>=1&&payload.parts.length<=64&&payload.parts.every(validCreativePart)&&JSON.stringify(payload).length<=120000;
}
export function portableCreativeBuild(entries){
 if(!Array.isArray(entries)||entries.length<1||entries.length>64)return null;
 if(entries.some(e=>!e||!TYPES.has(e.kind)||e.texture==='custom'||e.texture&&e.texture!=='none'))return null;
 if(entries.some(e=>!finite3(e.position)||!finite3(e.rotation)||!finite3(e.scale)))return null;
 // Preserve relative X/Z arrangement and elevation, but normalize the ground.
 const origin=[entries.reduce((s,e)=>s+e.position[0],0)/entries.length,
  Math.min(...entries.map(e=>e.position[1])),
  entries.reduce((s,e)=>s+e.position[2],0)/entries.length];
 const parts=entries.map(e=>{
  const part={kind:e.kind,name:String(e.name||e.kind).slice(0,100),
   position:e.position.map((v,i)=>Number((v-origin[i]).toFixed(5))),
   rotation:[...e.rotation],scale:[...e.scale],color:e.color||'#b2bdc8',texture:'none'};
  if(e.primitive)part.primitive=structuredClone(e.primitive);
  if(e.kind==='cube'&&Array.isArray(e.openings)&&e.openings.length)part.openings=structuredClone(e.openings);
  return part;
 });
 const result={kind:'creativeBuild',parts};return validCreativeBuild(result)?result:null;
}
