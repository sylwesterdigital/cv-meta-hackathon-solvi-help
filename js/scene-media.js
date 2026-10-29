import * as THREE from 'three';

const loaders=new Map();
const activeMediaObjects=new WeakMap();
const mediaTextures=new WeakMap();
const assetURLs=new WeakMap();

export const sceneMediaKind=mime=>String(mime||'').startsWith('video/')?'video':String(mime||'').startsWith('image/')?'image':'file';

function frontMaterial(){
  return new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.7,metalness:.05});
}
function frameMaterial(){
  return new THREE.MeshStandardMaterial({color:'#1b2430',roughness:.85,metalness:.08});
}
function backMaterial(kind='white',env=null){
  if(kind==='mirror')return new THREE.MeshStandardMaterial({color:'#f8fbff',metalness:.96,roughness:.06,envMap:env||null});
  return new THREE.MeshStandardMaterial({color:kind==='black'?'#080b12':'#ffffff',roughness:.92,metalness:0});
}
function ensureMaterials(mesh,backing='white',env=null){
  if(Array.isArray(mesh.material)&&mesh.material.length===6){
    mesh.material[5]?.dispose?.();
    mesh.material[5]=backMaterial(backing,env);
    return mesh.material;
  }
  const materials=[frameMaterial(),frameMaterial(),frameMaterial(),frameMaterial(),frontMaterial(),backMaterial(backing,env)];
  mesh.material=materials;
  return materials;
}
function disposeAsset(mesh){
  const prior=activeMediaObjects.get(mesh);
  if(prior?.video){
    try{prior.video.pause();prior.video.removeAttribute('src');prior.video.load();}catch{}
  }
  const objectURL=assetURLs.get(mesh);if(objectURL)URL.revokeObjectURL(objectURL);assetURLs.delete(mesh);
  const tex=mediaTextures.get(mesh);
  tex?.dispose?.();
  mediaTextures.delete(mesh);
  activeMediaObjects.delete(mesh);
}
function applyAspect(mesh,width,height){
  const w=Number(width),h=Number(height);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return;
  // Size the geometry from actual source pixels, not the user's editable transform.
  // Normalise by the longest edge; never clamp the aspect ratio itself.
  if(mesh.userData.mediaWidth!==w||mesh.userData.mediaHeight!==h){
    const factor=2.8/Math.max(w,h);
    const previous=mesh.geometry;
    mesh.geometry=new THREE.BoxGeometry(w*factor,h*factor,.06);
    previous?.dispose?.();
    window.solviEditor?.physics?.sync?.(mesh);
  }
  mesh.userData.mediaAspect=w/h;
  mesh.userData.mediaWidth=w;
  mesh.userData.mediaHeight=h;
  if(mesh.userData.media){mesh.userData.media.width=w;mesh.userData.media.height=h;}
}
function mediaUrl(mid){return `/api/media/${encodeURIComponent(mid)}`;}
function hlsUrl(mid){return `/api/media/${encodeURIComponent(mid)}/stream.m3u8`;}
function playbackUrl(media){
  if(sceneMediaKind(media?.mime)!=='video')return mediaUrl(media?.id||'');
  const mode=media?.stream||'direct';
  if(mode==='hls'&&document.createElement('video').canPlayType('application/vnd.apple.mpegurl'))return hlsUrl(media.id);
  return mediaUrl(media?.id||'');
}

export function makeSceneMedia(){
  const geometry=new THREE.BoxGeometry(1,1,.06);
  const mesh=new THREE.Mesh(geometry,[frameMaterial(),frameMaterial(),frameMaterial(),frameMaterial(),frontMaterial(),backMaterial('white')]);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.name='Media surface';
  mesh.userData.editorKind='media';
  mesh.userData.editorId=crypto.randomUUID();
  mesh.userData.media={id:'',mime:'',name:'',backing:'white',stream:'direct',width:null,height:null};
  mesh.position.set(0,1.2,0);
  return mesh;
}

export function hydrateSceneMedia(mesh,world){
  if(!mesh?.userData?.media)return;
  const media=mesh.userData.media;
  disposeAsset(mesh);
  const materials=ensureMaterials(mesh,media.backing||'white',world?.scene?.environment||null);
  const front=materials[4]||materials[0];
  front.color?.set?.('#ffffff');
  front.transparent=false;
  const kind=sceneMediaKind(media.mime);
  if(!media.id||kind==='file')return;
  if(media.width&&media.height)applyAspect(mesh,media.width,media.height);
  if(kind==='image'){
    const id=media.id;
    window.solviAPI?.mediaBlobInfo(id).then(info=>{
      if(mesh.userData.media?.id!==id||!mesh.parent){URL.revokeObjectURL(info.url);return;}
      assetURLs.set(mesh,info.url);
      return new THREE.TextureLoader().loadAsync(info.url);
    }).then(texture=>{
      if(!texture||mesh.userData.media?.id!==id||!mesh.parent){texture?.dispose();return;}
      texture.colorSpace=THREE.SRGBColorSpace;
      texture.needsUpdate=true;
      const clone=texture.clone();clone.needsUpdate=true;
      front.map=clone;front.needsUpdate=true;mediaTextures.set(mesh,clone);
      const image=clone.image||texture.image;
      if(image?.width&&image?.height&&mesh.parent)applyAspect(mesh,image.width,image.height);
    }).catch(error=>console.warn('Media image load failed',media.id,error));
    return;
  }
  if(kind==='video'&&media.width&&media.height)applyAspect(mesh,media.width,media.height);
  const video=document.createElement('video');
  video.crossOrigin='anonymous';video.preload='metadata';video.playsInline=true;video.loop=true;video.muted=true;
  const mediaId=media.id;window.solviAPI?.mediaBlobInfo(mediaId).then(info=>{
    if(mesh.userData.media?.id!==mediaId||!mesh.parent){URL.revokeObjectURL(info.url);return;}
    assetURLs.set(mesh,info.url);video.src=info.url;
  }).catch(error=>console.warn('Media video load failed',mediaId,error));
  video.addEventListener('loadedmetadata',()=>{if(mesh.parent)applyAspect(mesh,video.videoWidth,video.videoHeight);});
  const texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;
  front.map=texture;front.needsUpdate=true;mediaTextures.set(mesh,texture);activeMediaObjects.set(mesh,{video});
}

export function disposeSceneMedia(mesh){disposeAsset(mesh);if(Array.isArray(mesh?.material))mesh.material.forEach(material=>{material.map?.dispose?.();material.dispose?.();});mesh?.geometry?.dispose?.();}

export function setSceneMediaBacking(mesh,backing='white',world){
  if(!mesh?.userData?.media)return;
  mesh.userData.media.backing=['white','black','mirror'].includes(backing)?backing:'white';
  ensureMaterials(mesh,mesh.userData.media.backing,world?.scene?.environment||null);
  mesh.material[5].needsUpdate=true;
}
export function toggleSceneMediaPlayback(mesh){
  const current=activeMediaObjects.get(mesh);if(!current?.video)return false;
  if(current.video.paused){current.video.play().catch(()=>{});return true;}
  current.video.pause();return false;
}
export function setSceneMediaMuted(mesh,muted=true){
  const current=activeMediaObjects.get(mesh);if(!current?.video)return;
  current.video.muted=!!muted;
}
export function sceneMediaMuted(mesh){return !!activeMediaObjects.get(mesh)?.video?.muted;}
export function sceneMediaPlaying(mesh){const video=activeMediaObjects.get(mesh)?.video;return !!(video&&!video.paused&&!video.ended);}
