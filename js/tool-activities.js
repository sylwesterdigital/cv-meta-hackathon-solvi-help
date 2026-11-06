// Explicit equipment actions. A tool can have an authored avatar clip without
// claiming that every animation changes world geometry. Excavation is a
// persistent, visible scene mark; the shared floor is not a deformable terrain.
export const TOOL_ACTIVITIES=Object.freeze({
 shovel:{label:'Dig',clips:['Digging','Dig','Shoveling','Shovelling','Digging Shovel']},
 axe:{label:'Chop animation',clips:['Chopping','Chop','Axe Swing','Swing Axe']},
 rake:{label:'Rake animation',clips:['Raking','Rake','Raking Leaves']},
 broom:{label:'Sweep animation',clips:['Sweeping','Sweep','Broom Sweep']},
 mop:{label:'Mop animation',clips:['Mopping','Mop','Mopping Floor']},
 saw:{label:'Saw animation',clips:['Sawing','Saw','Cutting Wood']},
 stick:{label:'Gesture animation',clips:['Holding','Pointing']}
});
export function cleanToolAnimationName(raw){return typeof raw==='string'&&raw.length<=100&&/^[\w .:-]*$/.test(raw)?raw:'';}
const clipBase=s=>String(s||'').replace(/__\d+$/,'').trim().toLowerCase().replace(/[\s_-]+/g,' ');
export function resolveToolAnimation(variant,available=[],selected=''){
 if(selected==='none')return null;
 const names=Array.isArray(available)?available.filter(n=>typeof n==='string'&&n.length<101):[];
 if(selected&&names.includes(selected))return selected;
 const aliases=TOOL_ACTIVITIES[variant]?.clips||[];
 for(const alias of aliases){const found=names.find(n=>clipBase(n)===clipBase(alias));if(found)return found;}
 for(const alias of aliases){const found=names.find(n=>clipBase(n).startsWith(clipBase(alias)+' '));if(found)return found;}
 return null;
}
export function digAheadPoint(robot,distance=1.05){
 const yaw=Number(robot?.rotation?.y),p=robot?.position;
 if(!p||![yaw,p.x,p.y,p.z].every(Number.isFinite))return null;
 return {x:p.x+Math.sin(yaw)*distance,y:0,z:p.z+Math.cos(yaw)*distance};
}
export function validDigTarget(robot,point,items=[],{maxDistance=2.8,radius=.48}={}){
 const position=robot?.position;
 if(!position||!point||![position.x,position.y,position.z,point.x,point.y,point.z].every(Number.isFinite))return {ok:false,reason:'Invalid ground position'};
 const distance=Math.hypot(position.x-point.x,position.z-point.z);
 if(distance<.55||distance>maxDistance||Math.abs(point.y)>1||Math.abs(position.y)>1.2)return {ok:false,reason:'Choose open ground between 0.55 and 2.8 metres from the avatar'};
 // Broad floor plates, walls, furniture and previous excavation marks are not
 // diggable. Use each object's physical bounding footprint, not its name alone.
 for(const item of items){
  if(item===robot||!item?.visible||item.userData?.storage)continue;
  const kind=item.userData?.editorKind,variant=item.userData?.furniture?.variant;
  if(['light','curve','text','points','portal'].includes(kind))continue;
  // Road and footpath surfaces also block excavation beneath them.
  const box=item.boundingBox||item.userData?.digBounds;
  if(!box||!box.min||!box.max)continue; // caller can inject Three.js world bounds
  if(box.max.y<point.y-.16||box.min.y>point.y+.32)continue;
  const dx=Math.max(box.min.x-point.x,0,point.x-box.max.x);
  const dz=Math.max(box.min.z-point.z,0,point.z-box.max.z);
  if(Math.hypot(dx,dz)<radius)return {ok:false,reason:`Ground is obstructed by ${String(item.name||'an object').slice(0,55)}`};
 }
 return {ok:true,point:{x:point.x,y:point.y,z:point.z}};
}
