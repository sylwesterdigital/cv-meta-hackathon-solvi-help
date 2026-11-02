import * as THREE from 'three';
import {syncSmartScreen,disposeSmartScreen,cleanChannels,hlsLibrary} from './smart-media-playlist.js';
// Reuse the authenticated media-blob API, storing only a reference in scene JSON.
const handles=new WeakMap();
const speakers=new WeakMap();
function stopSpeaker(group){const state=speakers.get(group);if(!state)return;
 speakers.delete(group);state.hls?.destroy?.();state.video?.pause?.();if(state.video){state.video.removeAttribute('src');state.video.load();}
 state.sound?.removeFromParent?.();}
export async function playEquipmentChannel(group,index=0,world=null){
 const cfg=group?.userData?.furniture;if(cfg?.variant!=='speaker'||!cfg.powered)return false;
 const channels=cleanChannels(cfg.channels),item=channels[index];if(!item)return false;
 stopSpeaker(group);const video=document.createElement('video');video.crossOrigin='anonymous';video.playsInline=true;video.muted=false;video.preload='auto';const state={video,index,hls:null,sound:null};speakers.set(group,state);
 try{
  if(/\.m3u8(?:$|[?#])/i.test(item.url)){
   if(video.canPlayType('application/vnd.apple.mpegurl'))video.src=item.url;
   else{const Hls=await hlsLibrary();if(speakers.get(group)!==state)return false;state.hls=new Hls({enableWorker:true});state.hls.loadSource(item.url);state.hls.attachMedia(video);}
  }else video.src=item.url;
  if(world?.audioListener){const sound=new THREE.PositionalAudio(world.audioListener);try{sound.setMediaElementSource(video);sound.setRefDistance(3);sound.setMaxDistance(22);sound.setRolloffFactor(.75);group.add(sound);state.sound=sound;}catch(error){console.warn('Speaker spatial audio fallback',error);}}
  await world?.audioListener?.context?.resume?.();await video.play();return true;
 }catch(e){console.warn('Speaker stream could not play: check remote CORS/codec',item.url,e);if(speakers.get(group)===state)stopSpeaker(group);return false;}
}
export function nextSpeakerChannel(group,world){const channels=cleanChannels(group?.userData?.furniture?.channels);if(!channels.length)return false;const now=speakers.get(group);const next=now?(now.index+1)%channels.length:0;void playEquipmentChannel(group,next,world);return true;}

export function disposeEquipmentMedia(group){stopSpeaker(group);disposeSmartScreen(group);const state=handles.get(group);if(!state)return;handles.delete(group);state.video?.pause();if(state.video){state.video.removeAttribute('src');state.video.load();}state.texture?.dispose();if(state.url)URL.revokeObjectURL(state.url);}
export function syncEquipmentMedia(group,editor){const p=group?.userData?.furniture,screen=group?.getObjectByName?.('equipmentScreen');const prior=handles.get(group);if(prior?.screen===screen&&prior?.id===p?.mediaId&&prior?.powered===p?.powered&&prior?.channels===JSON.stringify(p?.channels||[]))return;disposeEquipmentMedia(group);if(p?.variant==='speaker'&&p.powered&&group.parent){handles.set(group,{screen:null,id:p.mediaId,powered:p.powered,channels:JSON.stringify(p.channels||[])});return;}
 if(!screen||!p?.powered||!group.parent)return;
 if(syncSmartScreen(group,screen,p.channels,!p.mediaId)) {handles.set(group,{screen,id:p.mediaId,powered:p.powered,channels:JSON.stringify(p.channels||[])});return;}
 if(!p.mediaId)return;const media=editor?.items?.find(o=>o.userData.editorKind==='media'&&o.userData.media?.id===p.mediaId)?.userData.media;if(!media||!/^image\/|^video\//.test(media.mime))return;
 const state={screen,id:p.mediaId,powered:p.powered,url:null,video:null,texture:null};handles.set(group,state);
 window.solviAPI?.mediaBlobInfo?.(p.mediaId).then(async ({url})=>{if(handles.get(group)!==state||!group.parent){URL.revokeObjectURL(url);return;}state.url=url;
  if(media.mime.startsWith('image/')){state.texture=await new THREE.TextureLoader().loadAsync(url);if(handles.get(group)!==state){state.texture?.dispose();return;}}
  else{const v=document.createElement('video');v.src=url;v.muted=true;v.playsInline=true;v.loop=true;v.preload='metadata';state.video=v;state.texture=new THREE.VideoTexture(v);v.play().catch(()=>{});}
  state.texture.colorSpace=THREE.SRGBColorSpace;screen.material.map=state.texture;screen.material.color.set('#ffffff');screen.material.needsUpdate=true;
 }).catch(error=>{if(handles.get(group)===state){disposeEquipmentMedia(group);console.warn('Display source unavailable',p.mediaId,error);}});
}
