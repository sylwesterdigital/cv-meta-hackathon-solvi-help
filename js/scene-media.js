import * as THREE from 'three';

const loaders=new Map();
const activeMediaObjects=new WeakMap();
const mediaTextures=new WeakMap();
const assetURLs=new WeakMap();
const mediaDecorations=new WeakMap();
const activeMediaMeshes=new Set();

export const sceneMediaKind=mime=>String(mime||'').startsWith('video/')?'video':String(mime||'').startsWith('audio/')?'audio':String(mime||'').startsWith('image/')?'image':'file';

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
function cleanupDecorations(mesh){
  const group=mediaDecorations.get(mesh);
  if(!group)return;
  mesh.remove(group);
  group.traverse(node=>{node.geometry?.dispose?.();if(Array.isArray(node.material))node.material.forEach(m=>m?.dispose?.());else node.material?.dispose?.();});
  mediaDecorations.delete(mesh);
}
function ensureSpeakerDecor(mesh){
  cleanupDecorations(mesh);
  const group=new THREE.Group();group.name='mediaSpeakerDecor';
  const shell=new THREE.Mesh(new THREE.BoxGeometry(0.96,1.12,0.08),new THREE.MeshStandardMaterial({color:'#121a23',roughness:.88,metalness:.12}));
  shell.position.z=0.041;group.add(shell);
  const cone=(radius,y)=>{
    const outer=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,0.022,40),new THREE.MeshStandardMaterial({color:'#2a3440',roughness:.72,metalness:.18}));
    outer.rotation.x=Math.PI/2;outer.position.set(0,y,0.082);group.add(outer);
    const inner=new THREE.Mesh(new THREE.CylinderGeometry(radius*0.56,radius*0.16,0.03,40),new THREE.MeshStandardMaterial({color:'#56687a',roughness:.48,metalness:.24}));
    inner.rotation.x=Math.PI/2;inner.position.set(0,y,0.09);group.add(inner);
  };
  cone(0.26,0.24);cone(0.18,-0.21);
  const rings=[];
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.31+i*0.08,0.33+i*0.08,48),new THREE.MeshBasicMaterial({color:'#76efff',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
    ring.position.set(0,0.02,0.13+i*0.005);group.add(ring);rings.push(ring);
  }
  mesh.add(group);mediaDecorations.set(mesh,group);
  return {group,rings};
}
function disposeAsset(mesh){
  const prior=activeMediaObjects.get(mesh);
  if(prior?.video){try{prior.video.pause();prior.video.removeAttribute('src');prior.video.load();}catch{}}
  if(prior?.audioEl){try{prior.audioEl.pause();prior.audioEl.removeAttribute('src');prior.audioEl.load();}catch{}}
  if(prior?.sound&&prior.sound.parent)prior.sound.parent.remove(prior.sound);
  const objectURL=assetURLs.get(mesh);if(objectURL)URL.revokeObjectURL(objectURL);assetURLs.delete(mesh);
  const tex=mediaTextures.get(mesh);
  tex?.dispose?.();
  mediaTextures.delete(mesh);
  cleanupDecorations(mesh);
  activeMediaObjects.delete(mesh);
  activeMediaMeshes.delete(mesh);
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
function applyAudioSettings(current,media){
  if(!current?.audioEl)return;
  current.audioEl.loop=media?.loop!==false;
  current.audioEl.muted=media?.muted===true;
  if(current.sound){
    current.sound.setRefDistance(Math.max(0.5,Number(media?.refDistance)||4));
    current.sound.setMaxDistance(Math.max(1,Number(media?.maxDistance)||18));
    current.sound.setDistanceModel(media?.constantVolume?'linear':'inverse');
    current.sound.setRolloffFactor(media?.constantVolume?0:1);
    current.sound.setVolume(Number.isFinite(Number(media?.volume))?Math.max(0,Math.min(2,Number(media.volume))):1);
  }
}

export function makeSceneMedia(){
  const geometry=new THREE.BoxGeometry(1,1,.06);
  const mesh=new THREE.Mesh(geometry,[frameMaterial(),frameMaterial(),frameMaterial(),frameMaterial(),frontMaterial(),backMaterial('white')]);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.name='Media surface';
  mesh.userData.editorKind='media';
  mesh.userData.editorId=crypto.randomUUID();
  mesh.userData.media={id:'',mime:'',name:'',backing:'white',stream:'direct',width:null,height:null,loop:true,muted:false,refDistance:4,maxDistance:18,autoplayDistance:0,constantVolume:false,group:'',volume:1};
  mesh.position.set(0,1.2,0);
  return mesh;
}

export function hydrateSceneMedia(mesh,world){
  if(!mesh?.userData?.media)return;
  const media=mesh.userData.media;
  disposeAsset(mesh);
  activeMediaMeshes.add(mesh);
  const materials=ensureMaterials(mesh,media.backing||'white',world?.scene?.environment||null);
  const front=materials[4]||materials[0];
  front.color?.set?.('#ffffff');
  front.transparent=false;
  front.map?.dispose?.();
  front.map=null;
  const kind=sceneMediaKind(media.mime);
  if(!media.id||kind==='file')return;
  if(media.width&&media.height&&kind!=='audio')applyAspect(mesh,media.width,media.height);
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
  if(kind==='audio'){
    const decor=ensureSpeakerDecor(mesh);
    const audio=document.createElement('audio');
    audio.crossOrigin='anonymous';audio.preload='metadata';audio.playsInline=true;audio.loop=media.loop!==false;audio.muted=media.muted===true;
    const sound=world?.audioListener?new THREE.PositionalAudio(world.audioListener):null;
    if(sound){try{sound.setMediaElementSource(audio);}catch(error){console.warn('Audio source attachment failed',error);}mesh.add(sound);}
    const current={audioEl:audio,sound,rings:decor?.rings||[]};
    applyAudioSettings(current,media);
    const mediaId=media.id;window.solviAPI?.mediaBlobInfo(mediaId).then(info=>{
      if(mesh.userData.media?.id!==mediaId||!mesh.parent){URL.revokeObjectURL(info.url);return;}
      assetURLs.set(mesh,info.url);audio.src=info.url;
    }).catch(error=>console.warn('Media audio load failed',mediaId,error));
    activeMediaObjects.set(mesh,current);
    return;
  }
  if(kind==='video'&&media.width&&media.height)applyAspect(mesh,media.width,media.height);
  const video=document.createElement('video');
  video.crossOrigin='anonymous';video.preload='metadata';video.playsInline=true;video.loop=media.loop!==false;video.muted=media.muted!==false?true:false;
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
  const current=activeMediaObjects.get(mesh);const mediaEl=current?.video||current?.audioEl;if(!mediaEl)return false;
  if(mediaEl.paused){mediaEl.play().catch(()=>{});return true;}
  mediaEl.pause();return false;
}
export function setSceneMediaMuted(mesh,muted=true){
  const current=activeMediaObjects.get(mesh);const mediaEl=current?.video||current?.audioEl;if(!mediaEl)return;
  mediaEl.muted=!!muted;if(mesh?.userData?.media)mesh.userData.media.muted=!!muted;
}
export function setSceneMediaLoop(mesh,loop=true){
  const current=activeMediaObjects.get(mesh);const mediaEl=current?.video||current?.audioEl;if(mediaEl)mediaEl.loop=!!loop; if(mesh?.userData?.media)mesh.userData.media.loop=!!loop;
}
export function setSceneMediaSpatial(mesh,{refDistance,maxDistance,autoplayDistance,constantVolume,group,volume}={}){
  if(!mesh?.userData?.media)return;
  const media=mesh.userData.media;
  if(refDistance!==undefined)media.refDistance=Math.max(0.5,Number(refDistance)||4);
  if(maxDistance!==undefined)media.maxDistance=Math.max(1,Number(maxDistance)||18);
  if(autoplayDistance!==undefined)media.autoplayDistance=Math.max(0,Number(autoplayDistance)||0);
  if(constantVolume!==undefined)media.constantVolume=!!constantVolume;
  if(group!==undefined)media.group=String(group||'').slice(0,60);
  if(volume!==undefined)media.volume=Math.max(0,Math.min(2,Number(volume)||1));
  applyAudioSettings(activeMediaObjects.get(mesh),media);
}
export function syncSceneMediaGroup(mesh){
  const group=String(mesh?.userData?.media?.group||'').trim();if(!group)return 0;let count=0;
  activeMediaMeshes.forEach(candidate=>{
    if(candidate?.userData?.editorKind!=='media')return;
    if(String(candidate.userData.media?.group||'').trim()!==group)return;
    const current=activeMediaObjects.get(candidate);const mediaEl=current?.video||current?.audioEl;if(!mediaEl)return;
    try{mediaEl.currentTime=0;}catch{}
    mediaEl.play?.().catch(()=>{});count++;
  });
  return count;
}
export function sceneMediaMuted(mesh){const current=activeMediaObjects.get(mesh);return !!(current?.video?.muted||current?.audioEl?.muted);}
export function sceneMediaPlaying(mesh){const current=activeMediaObjects.get(mesh);const mediaEl=current?.video||current?.audioEl;return !!(mediaEl&&!mediaEl.paused&&!mediaEl.ended);}
export function updateSceneMedia(world,dt=0,time=performance.now()/1000){
  const camera=world?.camera;
  activeMediaMeshes.forEach(mesh=>{
    if(!mesh?.parent)return;
    const media=mesh.userData?.media||{};const current=activeMediaObjects.get(mesh);if(!current)return;
    const mediaEl=current.video||current.audioEl;
    if(current.audioEl&&camera){
      const distance=camera.getWorldPosition(new THREE.Vector3()).distanceTo(mesh.getWorldPosition(new THREE.Vector3()));
      const trigger=Math.max(0,Number(media.autoplayDistance)||0);
      if(trigger>0){if(distance<=trigger&&mediaEl.paused)mediaEl.play().catch(()=>{});else if(distance>trigger&&sceneMediaPlaying(mesh))mediaEl.pause();}
      const gain=sceneMediaPlaying(mesh)?1:0;
      (current.rings||[]).forEach((ring,index)=>{
        const phase=(time*1.2+index/3)%1;
        ring.material.opacity=gain*(1-phase)*0.32;
        ring.scale.setScalar(0.92+phase*(1.1+index*0.3));
      });
    }
  });
}
