import * as THREE from 'three';
import {portalActivation,pairedPortal} from './portal-core.js';
import {validTeleport} from './xr-navigation.js';
import {portalPulse} from './portal-geometry.js';
const temp=new THREE.Vector3();
const allowed=new Set(['robot','cube','sphere','cylinder','torus','model','text','stairs','plane','surface','curve','points','wall','media']);
let audioContext;
function chime(){try{audioContext??=new (window.AudioContext||window.webkitAudioContext)();if(audioContext.state==='suspended')audioContext.resume();const t=audioContext.currentTime;for(const [i,frequency] of [420,630,840].entries()){const o=audioContext.createOscillator(),g=audioContext.createGain();o.type='sine';o.frequency.value=frequency;g.gain.setValueAtTime(.0001,t+i*.09);g.gain.exponentialRampToValueAtTime(.035,t+i*.09+.015);g.gain.exponentialRampToValueAtTime(.0001,t+i*.09+.24);o.connect(g).connect(audioContext.destination);o.start(t+i*.09);o.stop(t+i*.09+.25);}}catch{}}
export function tickPortals(editor,dt){
 if(!Number.isFinite(dt)||dt<=0)return;
 const now=performance.now(),portals=editor.items.filter(o=>o.userData.editorKind==='portal');
 for(const source of portals){
  const cfg=source.userData.portal,other=pairedPortal(portals,source);
  if(cfg?.role!=='entry'||!other)continue;
  source.updateMatrixWorld(true);other.updateMatrixWorld(true);
  let active=false;
  for(const item of editor.items){
   if(!allowed.has(item.userData.editorKind)||item.userData.media?.mount||item===source||item===other||!editor.physics?.owns(item))continue;
   if(item.userData.portalBlockedUntil>now)continue;
   const local=source.worldToLocal(temp.copy(item.position)).clone();
   const inside=portalActivation(local,cfg,item.userData.editorKind);
   const state=item.userData.portalTransit;
   if(!inside){if(state?.source===source.userData.editorId)item.userData.portalTransit=null;continue;}
   if(cfg.mode==='button'&&!source.userData.portalArmedUntil)continue;
   if(cfg.mode==='button'&&source.userData.portalArmedUntil<now)continue;
   if(!state||state.source!==source.userData.editorId)item.userData.portalTransit={source:source.userData.editorId,since:now};
   const pending=item.userData.portalTransit;
   active=true;
   if(now-pending.since<cfg.delay*1000)continue;
   // Arrival outside the exit trigger volume with rotated facing direction.
   const forward=new THREE.Vector3(0,0,-1).applyQuaternion(other.quaternion);
   const exit=other.localToWorld(new THREE.Vector3(0,Math.max(.05,Math.min(.5,local.y)),0)).addScaledVector(forward,Math.max(.95,other.userData.portal.depth+.72));
   item.position.copy(exit);
   item.rotation.y+=other.rotation.y-source.rotation.y;
   item.userData.portalBlockedUntil=now+2200;item.userData.portalTransit=null;
   const body=editor.physics?.bodies?.get(item.userData.editorId);
   if(body){const pos={x:exit.x,y:exit.y,z:exit.z};body.setTranslation(pos,true);body.setRotation?.({x:item.quaternion.x,y:item.quaternion.y,z:item.quaternion.z,w:item.quaternion.w},true);if(item.userData.editorKind==='robot')body.setNextKinematicTranslation?.(pos);else{body.setLinvel?.({x:0,y:0,z:0},true);body.setAngvel?.({x:0,y:0,z:0},true);}}
   if(item.userData.editorKind==='robot'){
    item.userData.robotGoal=null;item.userData.robotMission=null;
    item.userData.robotVelocity=0;item.userData.robotLateral=0;item.userData.robotSteer=0;
    editor.remoteCorrections?.delete(item.userData.editorId);
   }
   if(cfg.sound)chime();
   editor.queueSave(item);
  }
  // The visitor's XR headset or freely moving desktop camera is not an editor object.
  // Only a viewer physically inside the real doorway can trigger this path.
  const vr=editor.world?.renderer?.xr?.isPresenting===true;
  const viewer=vr?editor.world.renderer.xr.getCamera():editor.world?.camera;
  const free=vr||editor.world?.cameraFollowMode==='free';
  if(viewer&&free){
   const location=viewer.getWorldPosition(new THREE.Vector3());
   const local=source.worldToLocal(location.clone());
   const key=source.userData.editorId;
   const prior=editor.world.portalViewerTransit;
   if(!portalActivation(local,cfg,'viewer')){if(prior?.source===key)editor.world.portalViewerTransit=null;}
   else if((editor.world.portalViewerBlockedUntil||0)<=now&&
    (cfg.mode==='auto'||(source.userData.portalArmedUntil||0)>now)){
    if(!prior||prior.source!==key)editor.world.portalViewerTransit={source:key,since:now};
    active=true;
    if(now-editor.world.portalViewerTransit.since>=cfg.delay*1000){
     const forward=new THREE.Vector3(0,0,-1).applyQuaternion(other.quaternion);
     const destination=other.getWorldPosition(new THREE.Vector3()).addScaledVector(forward,Math.max(.95,other.userData.portal.depth+.72));
     const maxExtent=Math.max(16,editor.world.environment?.floorSize/2-1||16);
     if(validTeleport(destination.x,destination.z,maxExtent)){
      if(vr)editor.world.teleportTo(destination);
      else{const shift=destination.sub(location);editor.world.camera.position.add(shift);editor.world.controls.target.add(shift);editor.world.controls.update();}
      editor.world.portalViewerBlockedUntil=now+2200;editor.world.portalViewerTransit=null;
      if(cfg.sound)chime();
     }
    }
   }
  }
  const glow=active ? .65 : (source.userData.portalArmedUntil||0)>now ? .35 : 0;
  portalPulse(source,glow);
  portalPulse(other,glow);
 }
}
export function activatePortalButton(editor,button){
 let source=button;
 while(source&&!source.userData?.editorKind)source=source.parent;
 if(source?.userData?.editorKind!=='portal'||source.userData.portal?.role!=='entry'||source.userData.portal?.mode!=='button' )return false;
 if(!pairedPortal(editor.items,source))return false;
 source.userData.portalArmedUntil=performance.now()+Math.max(6500,source.userData.portal.delay*1000+3500);
 if(source.userData.portal.sound)chime();
 portalPulse(source,1);return true;
}
