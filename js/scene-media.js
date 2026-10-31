import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {loadSceneAsset,isSceneModelURL} from './scene-models.js';

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
function ensureSpeakerDecor(mesh,orb=false){
  cleanupDecorations(mesh);
  const group=new THREE.Group();group.name='mediaSpeakerDecor';
  if(!orb){const shell=new THREE.Mesh(new THREE.BoxGeometry(0.96,1.12,0.08),new THREE.MeshStandardMaterial({color:'#121a23',roughness:.88,metalness:.12}));shell.position.z=0.041;group.add(shell);}
  const cone=(radius,y)=>{
    const outer=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,0.022,40),new THREE.MeshStandardMaterial({color:'#2a3440',roughness:.72,metalness:.18}));
    outer.rotation.x=Math.PI/2;outer.position.set(0,y,0.082);group.add(outer);
    const inner=new THREE.Mesh(new THREE.CylinderGeometry(radius*0.56,radius*0.16,0.03,40),new THREE.MeshStandardMaterial({color:'#56687a',roughness:.48,metalness:.24}));
    inner.rotation.x=Math.PI/2;inner.position.set(0,y,0.09);group.add(inner);
  };
  if(!orb){cone(0.26,0.24);cone(0.18,-0.21);}
  const rings=[];
  for(let i=0;i<3;i++){
    const ring=new THREE.Mesh(new THREE.RingGeometry(0.31+i*0.08,0.33+i*0.08,48),new THREE.MeshBasicMaterial({color:'#76efff',transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false}));
    ring.position.set(0,0.02,(orb?.48:.13)+i*0.005);group.add(ring);rings.push(ring);
  }
  mesh.add(group);mediaDecorations.set(mesh,group);
  return {group,rings};
}
async function hydrateSpeakerModel(mesh,modelURL){
  if(!isSceneModelURL(modelURL))return;
  const ticket=mesh.userData.mediaModelTicket;
  try{
    const asset=await loadSceneAsset(modelURL);
    if(ticket!==mesh.userData.mediaModelTicket||!mesh.parent)return;
    const clone=cloneSkeleton(asset);clone.name='audioSpeakerCustomModel';
    const bounds=new THREE.Box3().setFromObject(clone),size=bounds.getSize(new THREE.Vector3());
    if(!bounds.isEmpty()&&Math.max(size.x,size.y,size.z)>0){const factor=1.4/Math.max(size.x,size.y,size.z);clone.scale.multiplyScalar(factor);const center=bounds.getCenter(new THREE.Vector3());clone.position.set(-center.x*factor,-center.y*factor,-center.z*factor);}
    const prior=mesh.getObjectByName('audioSpeakerCustomModel');if(prior)mesh.remove(prior);
    mesh.add(clone);
    const decor=mediaDecorations.get(mesh);if(decor){for(const child of decor.children){if(child.geometry?.type!=='RingGeometry')child.visible=false;}}
    const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];for(const material of materials){if(material){material.transparent=true;material.opacity=0;material.needsUpdate=true;}}
  }catch(error){console.warn('Speaker model unavailable',modelURL,error);}
}
function disposeAsset(mesh){
  for(const name of ['mediaSourceLabel','mediaDateLabel','mediaCaptionLabel']){const old=mesh.getObjectByName(name);if(old){old.removeFromParent();old.material?.map?.dispose?.();old.material?.dispose?.();}}
  mesh.userData.mediaModelTicket=(mesh.userData.mediaModelTicket||0)+1;
  const model=mesh.getObjectByName('audioSpeakerCustomModel');if(model)mesh.remove(model);
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
    mesh.geometry=mesh.userData.media?.mount?new THREE.BoxGeometry(1,1,.06):new THREE.BoxGeometry(w*factor,h*factor,.06);
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
  const orb=media.shape==='orb'&&(sceneMediaKind(media.mime)==='audio'||sceneMediaKind(media.mime)==='video');
  if(orb){
    if(!mesh.geometry?.type?.includes('Sphere')){mesh.geometry?.dispose?.();mesh.geometry=new THREE.SphereGeometry(.42,24,18);}
    if(Array.isArray(mesh.material)){mesh.material.forEach(m=>m?.dispose?.());mesh.material=new THREE.MeshStandardMaterial({color:'#3c9bd2',roughness:.38,metalness:.12});}
  }
  const materials=orb?null:ensureMaterials(mesh,media.backing||'white',world?.scene?.environment||null);
  const front=orb?mesh.material:(materials[4]||materials[0]);
  front.color?.set?.(orb?(media.color||'#3c9bd2'):'#ffffff');
  for(const material of (Array.isArray(mesh.material)?mesh.material:[mesh.material])){if(material){material.transparent=false;material.opacity=1;}}
  front.map?.dispose?.();
  front.map=null;
  if(orb&&media.orbTexture&&media.orbTexture!=='none'){
   const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;const ctx=canvas.getContext('2d');
   const type=media.orbTexture;
   ctx.fillStyle='#88cee8';ctx.fillRect(0,0,256,256);
   if(type==='checker'){ctx.fillStyle='#25597a';for(let x=0;x<4;x++)for(let y=0;y<4;y++)if((x+y)%2)ctx.fillRect(x*64,y*64,64,64);}
   if(type==='stripes'){ctx.fillStyle='#26536e';for(let i=0;i<256;i+=32)ctx.fillRect(i,0,12,256);}
   if(type==='dots'){ctx.fillStyle='#214f69';for(let y=20;y<256;y+=48)for(let x=20;x<256;x+=48){ctx.beginPath();ctx.arc(x,y,11,0,Math.PI*2);ctx.fill();}}
   if(type==='gradient'){const gradient=ctx.createLinearGradient(0,0,256,256);gradient.addColorStop(0,'#80efff');gradient.addColorStop(1,'#12415f');ctx.fillStyle=gradient;ctx.fillRect(0,0,256,256);}
   front.map=new THREE.CanvasTexture(canvas);front.map.colorSpace=THREE.SRGBColorSpace;front.needsUpdate=true;
  }
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
    if(media.author&&world?.labelSprite){const tag=world.labelSprite(media.author,'#14374b');tag.position.set(0,.85,0);tag.scale.set(1.5,.25,1);tag.name='mediaSourceLabel';mesh.add(tag);const date=world.labelSprite(new Date(media.created||Date.now()).toLocaleString(),'#14374b');date.position.set(0,.66,0);date.scale.set(1.5,.22,1);date.name='mediaDateLabel';mesh.add(date);}
    const decor=ensureSpeakerDecor(mesh,orb);
    if(media.model)hydrateSpeakerModel(mesh,media.model);
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
  const mediaId=media.id;
  const stillCurrent=()=>mesh.userData.media?.id===mediaId&&!!mesh.parent;
  const direct=()=>window.solviAPI?.mediaBlobInfo(mediaId).then(info=>{
    if(!stillCurrent()){URL.revokeObjectURL(info.url);return;}
    assetURLs.set(mesh,info.url);video.src=info.url;
  }).catch(error=>console.warn('Media video load failed',mediaId,error));
  if(media.stream==='hls'&&video.canPlayType('application/vnd.apple.mpegurl')&&window.solviAPI?.req){
    window.solviAPI.req('/api/media/'+encodeURIComponent(mediaId)+'/hls-access').then(result=>{
      if(stillCurrent()&&result.url)video.src=result.url;
    }).catch(()=>direct());
  }else direct();
  video.addEventListener('loadedmetadata',()=>{if(mesh.parent)applyAspect(mesh,video.videoWidth,video.videoHeight);});
  const texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;
  if(!orb){front.map=texture;front.needsUpdate=true;mediaTextures.set(mesh,texture);}else{texture.dispose();ensureSpeakerDecor(mesh,true);}
  const sound=orb&&world?.audioListener?new THREE.PositionalAudio(world.audioListener):null;
  if(sound){try{sound.setMediaElementSource(video);mesh.add(sound);video.muted=false;}catch(error){console.warn('Video orb audio source failed',error);}}
  activeMediaObjects.set(mesh,{video,sound});
}

export function disposeSceneMedia(mesh){disposeAsset(mesh);const materials=Array.isArray(mesh?.material)?mesh.material:[mesh?.material];materials.forEach(material=>{material?.map?.dispose?.();material?.dispose?.();});mesh?.geometry?.dispose?.();}

export function setSceneMediaBacking(mesh,backing='white',world){
  if(!mesh?.userData?.media)return;
  mesh.userData.media.backing=['white','black','mirror'].includes(backing)?backing:'white';
  ensureMaterials(mesh,mesh.userData.media.backing,world?.scene?.environment||null);
  mesh.material[5].needsUpdate=true;
}
export function toggleSceneMediaPlayback(mesh){
  const current=activeMediaObjects.get(mesh);const mediaEl=current?.video||current?.audioEl;if(!mediaEl)return false;
  if(mediaEl.paused){current.sound?.context?.resume?.().catch(()=>{});mediaEl.play().catch(()=>{});return true;}
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

export function showSceneMediaCaptions(mesh,world,text,visible=true){
 if(!mesh)return;
 const existing=mesh.getObjectByName('mediaCaptionLabel');if(existing){existing.removeFromParent();existing.material?.map?.dispose?.();existing.material?.dispose?.();}
 if(!visible||!String(text).trim())return;
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=256;
 const ctx=canvas.getContext('2d');ctx.fillStyle='rgba(11,35,50,.90)';ctx.beginPath();ctx.roundRect(5,5,1014,246,27);ctx.fill();
 ctx.font='38px system-ui';ctx.fillStyle='#e9fcff';ctx.textBaseline='middle';
 const words=String(text).replace(/\s+/g,' ').trim().slice(0,330).split(' ');let lines=[],line='';
 for(const word of words){const candidate=line?line+' '+word:word;if(ctx.measureText(candidate).width>945&&line){lines.push(line);line=word;}else line=candidate;}
 if(line)lines.push(line);lines=lines.slice(0,4);
 lines.forEach((value,i)=>ctx.fillText(value,32,54+i*48,960));
 const texture=new THREE.CanvasTexture(canvas),material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});
 const sprite=new THREE.Sprite(material);sprite.name='mediaCaptionLabel';sprite.scale.set(3.3,.85,1);sprite.position.set(0,-.9,0);mesh.add(sprite);
}
