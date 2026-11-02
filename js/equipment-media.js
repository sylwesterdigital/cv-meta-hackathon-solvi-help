import * as THREE from 'three';
// Reuse the authenticated media-blob API, storing only a reference in scene JSON.
const handles=new WeakMap();
export function disposeEquipmentMedia(group){const state=handles.get(group);if(!state)return;handles.delete(group);state.video?.pause();if(state.video){state.video.removeAttribute('src');state.video.load();}state.texture?.dispose();if(state.url)URL.revokeObjectURL(state.url);}
export function syncEquipmentMedia(group,editor){const p=group?.userData?.furniture,screen=group?.getObjectByName?.('equipmentScreen');const prior=handles.get(group);if(prior?.screen===screen&&prior?.id===p?.mediaId&&prior?.powered===p?.powered)return;disposeEquipmentMedia(group);if(!screen||!p?.powered||!p.mediaId||!group.parent)return;const media=editor?.items?.find(o=>o.userData.editorKind==='media'&&o.userData.media?.id===p.mediaId)?.userData.media;if(!media||!/^image\/|^video\//.test(media.mime))return;
 const state={screen,id:p.mediaId,powered:p.powered,url:null,video:null,texture:null};handles.set(group,state);
 window.solviAPI?.mediaBlobInfo?.(p.mediaId).then(async ({url})=>{if(handles.get(group)!==state||!group.parent){URL.revokeObjectURL(url);return;}state.url=url;
  if(media.mime.startsWith('image/')){state.texture=await new THREE.TextureLoader().loadAsync(url);if(handles.get(group)!==state){state.texture?.dispose();return;}}
  else{const v=document.createElement('video');v.src=url;v.muted=true;v.playsInline=true;v.loop=true;v.preload='metadata';state.video=v;state.texture=new THREE.VideoTexture(v);v.play().catch(()=>{});}
  state.texture.colorSpace=THREE.SRGBColorSpace;screen.material.map=state.texture;screen.material.color.set('#ffffff');screen.material.needsUpdate=true;
 }).catch(error=>{if(handles.get(group)===state){disposeEquipmentMedia(group);console.warn('Display source unavailable',p.mediaId,error);}});
}
