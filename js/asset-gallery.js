import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {loadSceneAsset} from './scene-models.js';
import {visibleAssets,validAssetFile,validAssetURL} from './asset-library.js';
import {renderModelThumbnail} from './preview-renderer.js';
const $=id=>document.getElementById(id);

export function setupAssetGallery(editor){
 const backdrop=$('assetGalleryBackdrop'),grid=$('assetGalleryGrid'),status=$('assetGalleryStatus');
 let collection=[],replacing=null,renderSerial=0,observer=null,previewQueue=Promise.resolve();
 function close(){backdrop.hidden=true;renderSerial++;observer?.disconnect();observer=null;replacing=null;}
 $('closeAssetGallery').onclick=close;
 backdrop.addEventListener('pointerdown',event=>{if(event.target===backdrop)close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!backdrop.hidden){event.stopPropagation();close();}});
 async function preview(canvas,asset,serial){
  try{
   const source=await loadSceneAsset(asset.url);
   if(serial!==renderSerial||!canvas.isConnected)return;
   const model=cloneSkeleton(source);const bounds=new THREE.Box3().setFromObject(model);
   if(bounds.isEmpty())throw Error('Empty 3D model');
   const dimensions=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
   model.position.sub(center);
   const scene=new THREE.Scene();scene.add(model);
   scene.add(new THREE.HemisphereLight(0xffffff,0x53687f,2.6));
   const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(3,6,6);scene.add(key);
   const camera=new THREE.PerspectiveCamera(36,1.35,.01,100000);
   const dist=Math.max(dimensions.x,dimensions.y,dimensions.z,.01)*2.3;
   camera.position.set(dist*.65,dist*.35,dist*1.15);camera.lookAt(0,0,0);
   const thumbnail=renderModelThumbnail(scene,camera,176,132);
   if(serial===renderSerial&&canvas.isConnected){const img=new Image();img.alt='';img.src=thumbnail;canvas.replaceWith(img);}
  }catch(error){if(serial===renderSerial&&canvas.isConnected){canvas.parentElement.textContent='Preview unavailable';canvas.parentElement.title=String(error.message||error);}}

 }
 function render(){
  const serial=++renderSerial;observer?.disconnect();observer=null;grid.replaceChildren();
  if(typeof IntersectionObserver==='function')observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer?.unobserve(entry.target);const asset=entry.target._asset,canvas=entry.target.querySelector('canvas');if(canvas&&asset)previewQueue=previewQueue.catch(()=>{}).then(()=>serial===renderSerial?preview(canvas,asset,serial):undefined);}}, {root:grid,rootMargin:'100px'});
  const models=visibleAssets(collection,$('assetGallerySearch').value);
  if(!models.length){const empty=document.createElement('p');empty.textContent=collection.length?'No matching assets.':'No 3D assets uploaded yet.';grid.append(empty);return;}
  for(const asset of models){
   const card=document.createElement('button');card.type='button';card.className='asset-card';card.setAttribute('role','listitem');card.title=asset.label;
   const previewNode=document.createElement('span');previewNode.className='asset-preview';const canvas=document.createElement('canvas');canvas.width=176;canvas.height=132;previewNode.append(canvas);
   const label=document.createElement('strong');label.textContent=asset.label;
   const meta=document.createElement('small');meta.textContent=`${String(asset.format||'3D').toUpperCase()} · ${Number(asset.bytes||0)/1024/1024>=.01?(Number(asset.bytes||0)/1024/1024).toFixed(1)+' MB':'small'}`;
   card.append(previewNode,label,meta);grid.append(card);
   card.onclick=async()=>{
    if(!validAssetURL(asset.url))return;
    if(replacing){if(!editor.items.includes(replacing)||!editor.canEdit(replacing)){status.textContent='The object cannot be edited. Select it again.';return;}
     if(!await editor.replaceSceneModel(replacing,asset))return;
    }else{
     try{await loadSceneAsset(asset.url);}catch(error){status.textContent='Asset unavailable: '+error.message;return;}
     const model=editor.add('model',false);if(!model)return;model.name=asset.label;
     if(!await editor.replaceSceneModel(model,asset)){editor.select(model);editor.remove();return;}
    }
    close();
   };
   if(observer){card._asset=asset;observer.observe(card);}else previewQueue=previewQueue.catch(()=>{}).then(()=>serial===renderSerial?preview(canvas,asset,serial):undefined);
  }
 }
 async function refresh(){
  if(!window.solviAPI?.online){status.textContent='Connect to the shared server to load uploaded assets.';collection=[];render();return;}
  try{status.textContent='Loading models…';const response=await window.solviAPI.req('/api/scene/models');collection=visibleAssets(response.models||[]);render();status.textContent=`${collection.length} available models · GLB / FBX · Select to ${replacing?'replace the object':'add to scene'}.`;
  }catch(error){collection=[];render();status.textContent='Cannot load assets: '+error.message;}
 }
 async function open({replace=null}={}){
  replacing=replace?.userData.editorKind==='model'&&editor.canEdit(replace)?replace:null;
  $('assetGalleryTitle').textContent=replacing?'Replace 3D model · '+replacing.name:'3D Assets';
  $('assetGallerySearch').value='';backdrop.hidden=false;await refresh();
 }
 async function upload(file,{replace}={}){
  const cap=Math.min(20,Math.max(.1,Number(localStorage.getItem('solvi-model-upload-limit')||5)));
  if(!validAssetFile(file,cap)){status.textContent=`Choose a GLB / FBX under ${cap} MiB.`;editor.toast?.(status.textContent);return false;}
  if(!window.solviAPI?.online){status.textContent='Upload requires the shared server.';editor.toast?.(status.textContent);return false;}
  if(replace&&(!editor.items.includes(replace)||!editor.canEdit(replace))){editor.toast?.('No permission to replace this object');return false;}
  try{
   status.textContent='Uploading '+file.name+'…';
   const form=new FormData();form.append('model',file);
   const result=await window.solviAPI.req('/api/scene/models',{method:'POST',body:form});
   if(!validAssetURL(result.model?.url))throw Error('Invalid model returned by server');
   if(replace){if(!await editor.replaceSceneModel(replace,result.model))return false;}else if(replacing){if(!await editor.replaceSceneModel(replacing,result.model))return false;}
   collection.unshift(result.model);
   if(!backdrop.hidden)render();
   status.textContent='Uploaded: '+result.model.label;
   if(backdrop.hidden)editor.toast?.('3D asset uploaded · '+result.model.label);
   return true;
  }catch(error){status.textContent='Upload failed: '+error.message;editor.toast?.(status.textContent);return false;}
 }
 $('assetsButton').onclick=()=>open();
 $('refreshAssetGallery').onclick=refresh;
 $('assetGallerySearch').addEventListener('input',render);
 $('assetGalleryUpload').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await upload(file);};
 return {open,refresh,upload};
}
