// The pair is two independent scene objects, linked by stable editor IDs.
export const PORTAL_MODES=['auto','button'];
export function cleanPortal(raw={}){
 const number=(key,def,min,max)=>{const x=Number(raw?.[key]);return Number.isFinite(x)?Math.max(min,Math.min(max,x)):def;};
 const color=(v,f)=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v)?v:f;
 const width=number('width',2.2,1.1,8),height=number('height',2.7,1.8,8);
 return {role:raw?.role==='exit'?'exit':'entry',partner:typeof raw?.partner==='string'&&/^[a-zA-Z0-9_-]{8,80}$/.test(raw.partner)?raw.partner:'',
 mode:PORTAL_MODES.includes(raw?.mode)?raw.mode:'auto',delay:number('delay',0,0,12),width,height,depth:number('depth',.3,.12,1.2),
 openingWidth:Math.min(number('openingWidth',1.45,.7,6),width-.15),openingHeight:Math.min(number('openingHeight',2.1,1.2,7),height-.12),color:color(raw?.color,'#499fe3'),texture:['none','concrete','bricks','metal','tiles'].includes(raw?.texture)?raw.texture:'none',opacity:number('opacity',1,.1,1),sound:raw?.sound!==false};
}
export function portalActivation(local,config,kind='robot'){
 if(!local||!config||!['x','y','z'].every(k=>Number.isFinite(local[k])))return false;
 const half=Math.min(config.openingWidth,config.width-.2)/2;
 const floor=kind==='robot'?-.16:-.35;
 return Math.abs(local.x)<half-.08&&local.y>floor&&local.y<Math.min(config.openingHeight,config.height-.12)&&Math.abs(local.z)<Math.max(.38,config.depth+.19);
}
export function portalDestination(entry,exit,point,offset=.85){
 // A forward step in the exit portal's local -Z direction avoids re-entry.
 const dx=(point?.x||0),dz=(point?.z||0);
 return {x:exit.x-Math.sin(exit.yaw)*offset+dx,y:exit.y,z:exit.z-Math.cos(exit.yaw)*offset+dz};
}
export function pairedPortal(objects,source){
 const cfg=source?.userData?.portal;
 if(!cfg?.partner)return null;
 const partner=objects.find(x=>x.userData?.editorId===cfg.partner&&x.userData?.editorKind==='portal');
 return partner?.userData?.portal?.partner===source.userData.editorId&&partner.userData.portal.role!==cfg.role?partner:null;
}
