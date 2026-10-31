import {confirmAction} from './app-dialogs.js';
import * as THREE from 'three';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {loadSceneAsset} from './scene-models.js';
import {visibleAssets,validAssetFile,validAssetURL} from './asset-library.js';
import {renderModelThumbnail} from './preview-renderer.js';
import {downloadLibrarySelection,deleteLibrarySelection,selectionPrompt} from './library-management.js';
const $=id=>document.getElementById(id);
export function setupAssetGallery(editor){
 const backdrop=$('assetGalleryBackdrop'),grid=$('assetGalleryGrid'),status=$('assetGalleryStatus');
 const edit=$('assetGalleryEdit'),bulk=$('assetGalleryBulk'),selectedCount=$('assetGallerySelected');
 let collection=[],replacing=null,renderSerial=0,observer=null,previewQueue=Promise.resolve(),editing=false,page=0;
 const PAGE_SIZE=12;
 const selected=new Set();
 const filtered=()=>visibleAssets(collection,$('assetGallerySearch').value);
 const selection=()=>filtered().filter(a=>selected.has(a.id));
 const pageItems=()=>filtered().slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 const updatePage=()=>{const total=filtered().length;page=Math.min(page,Math.max(0,Math.ceil(total/PAGE_SIZE)-1));const label=$('assetGalleryPageLabel');if(label)label.textContent=total?`Page ${page+1} / ${Math.ceil(total/PAGE_SIZE)} · ${total} assets`:'No assets';$('assetGalleryPrev').disabled=page===0;$('assetGalleryNext').disabled=(page+1)*PAGE_SIZE>=total;};
 const updateActions=()=>{selectedCount.textContent=selection().length+' selected';bulk.hidden=!editing;edit.textContent=editing?'Done':'Edit';edit.setAttribute('aria-pressed',String(editing));$('assetGalleryDelete').disabled=!selection().length;$('assetGalleryExport').disabled=!selection().length;};
 function close(){backdrop.hidden=true;renderSerial++;observer?.disconnect();observer=null;replacing=null;editing=false;selected.clear();updateActions();}
 $('closeAssetGallery').onclick=close;
 backdrop.addEventListener('pointerdown',event=>{if(event.target===backdrop)close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!backdrop.hidden){event.stopPropagation();close();}});
 async function preview(canvas,asset,serial){
  try{
   const source=await loadSceneAsset(asset.url);
   if(serial!==renderSerial||!canvas.isConnected)return;
   const model=cloneSkeleton(source);const bounds=new THREE.Box3().setFromObject(model);
   if(bounds.isEmpty())throw Error('Empty 3D model');
   const dimensions=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());model.position.sub(center);
   const scene=new THREE.Scene();scene.add(model);
   scene.add(new THREE.HemisphereLight(0xffffff,0x53687f,2.6));
   const key=new THREE.DirectionalLight(0xffffff,2);key.position.set(3,6,6);scene.add(key);
   const aspect=3/4,camera=new THREE.PerspectiveCamera(34,aspect,.01,100000);
   const vertical=Math.tan(camera.fov*Math.PI/360),horizontal=vertical*aspect;
   const distance=Math.max(dimensions.y/(2*vertical),dimensions.x/(2*horizontal),.1)*1.35+dimensions.z*.65;
   camera.position.set(distance*.27,dimensions.y*.09,distance);camera.lookAt(0,0,0);
   const thumbnail=renderModelThumbnail(scene,camera,300,400);
   if(serial===renderSerial&&canvas.isConnected){const img=new Image();img.alt='';img.src=thumbnail;canvas.replaceWith(img);}
  }catch(error){if(serial===renderSerial&&canvas.isConnected){canvas.parentElement.textContent='Preview unavailable';canvas.parentElement.title=String(error.message||error);}}
 }
 function render(){
  updatePage();const serial=++renderSerial;observer?.disconnect();observer=null;grid.replaceChildren();
  if(typeof IntersectionObserver==='function')observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer?.unobserve(entry.target);const asset=entry.target._asset,canvas=entry.target.querySelector('canvas');if(canvas&&asset)previewQueue=previewQueue.catch(()=>{}).then(()=>serial===renderSerial?preview(canvas,asset,serial):undefined);}}, {root:grid,rootMargin:'100px'});
  const models=pageItems();
  if(!models.length){const empty=document.createElement('p');empty.textContent=collection.length?'No matching assets.':'No 3D assets uploaded yet.';grid.append(empty);updateActions();return;}
  for(const asset of models){
   const item=document.createElement('div');item.className='library-item';item.setAttribute('role','listitem');item._asset=asset;
   const card=document.createElement('button');card.type='button';card.className='asset-card';card.title=asset.label;
   const previewNode=document.createElement('span');previewNode.className='asset-preview';const canvas=document.createElement('canvas');canvas.width=300;canvas.height=400;previewNode.append(canvas);
   const label=document.createElement('strong');label.textContent=asset.label;
   const meta=document.createElement('small');meta.textContent=`${String(asset.format||'3D').toUpperCase()} · ${Number(asset.bytes||0)/1024/1024>=.01?(Number(asset.bytes||0)/1024/1024).toFixed(1)+' MB':'small'}`;
   card.append(previewNode,label,meta);
   const check=document.createElement('input');check.type='checkbox';check.className='library-check';check.setAttribute('aria-label','Select '+asset.label);check.checked=selected.has(asset.id);check.hidden=!editing;
   check.addEventListener('change',()=>{if(check.checked)selected.add(asset.id);else selected.delete(asset.id);item.classList.toggle('selected',check.checked);updateActions();});
   item.append(card,check);grid.append(item);
   card.onclick=async()=>{
    if(editing){check.checked=!check.checked;check.dispatchEvent(new Event('change'));return;}
    if(!validAssetURL(asset.url))return;
    if(replacing){if(!editor.items.includes(replacing)||!editor.canEdit(replacing)){status.textContent='The object cannot be edited. Select it again.';return;}
     if(!(replacing.userData.editorKind==='media'?await editor.replaceSpeakerModel(replacing,asset):await editor.replaceSceneModel(replacing,asset)))return;
    }else{
     try{await loadSceneAsset(asset.url);}catch(error){status.textContent='Asset unavailable: '+error.message;return;}
     const model=editor.add('model',false);if(!model)return;model.name=asset.label;
     if(!await editor.replaceSceneModel(model,asset)){editor.select(model);editor.remove();return;}
    }
    close();
   };
   if(observer){item._asset=asset;observer.observe(item);}else previewQueue=previewQueue.catch(()=>{}).then(()=>serial===renderSerial?preview(canvas,asset,serial):undefined);
  }
  updateActions();
 }
 async function refresh(){
  if(!window.solviAPI?.online){status.textContent='Connect to the shared server to load uploaded assets.';collection=[];render();return;}
  try{status.textContent='Loading models…';const response=await window.solviAPI.req('/api/scene/models');collection=visibleAssets(response.models||[]);page=0;render();status.textContent=`${collection.length} available models · GLB / FBX · Select to ${replacing?'replace the object':'add to scene'}.`;
  }catch(error){collection=[];render();status.textContent='Cannot load assets: '+error.message;}
 }
 async function open({replace=null}={}){
  replacing=['model','media'].includes(replace?.userData?.editorKind)&&editor.canEdit(replace)?replace:null;
  $('assetGalleryTitle').textContent=replacing?'Select visual model · '+replacing.name:'3D Assets';
  $('assetGallerySearch').value='';page=0;backdrop.hidden=false;editing=false;selected.clear();updateActions();await refresh();
 }
 edit.onclick=()=>{editing=!editing;selected.clear();render();};
 $('assetGallerySelectAll').onclick=()=>{for(const asset of pageItems())selected.add(asset.id);render();};
 $('assetGalleryPrev').onclick=()=>{if(page>0){page--;render();}};
 $('assetGalleryNext').onclick=()=>{if((page+1)*PAGE_SIZE<filtered().length){page++;render();}};
 $('assetGalleryExport').onclick=async()=>{try{status.textContent='Preparing selected assets…';await downloadLibrarySelection('models',selection());status.textContent='Asset ZIP downloaded.';}catch(error){status.textContent='Export failed: '+error.message;}};
 $('assetGalleryDelete').onclick=async()=>{
  const chosen=selection();if(!chosen.length||!await confirmAction(selectionPrompt(chosen,'models'),{title:'Delete assets permanently',confirmLabel:'Delete selected',danger:true}))return;
  try{
   if(chosen.some(asset=>asset.canManage!==true)&&!window.solviIsAdmin?.())throw Error('Only the uploader or administrator can delete a model. Unlock administrator access in Profile, then retry.');
   await deleteLibrarySelection('models',chosen);collection=collection.filter(asset=>!selected.has(asset.id));selected.clear();render();status.textContent='Selected unused assets deleted.';
  }catch(error){status.textContent='Delete failed: '+error.message;}
 };
 async function upload(file,{replace}={}){
  const cap=Math.min(20,Math.max(.1,Number(localStorage.getItem('solvi-model-upload-limit')||5)));
  if(!validAssetFile(file,cap)){status.textContent=`Choose a GLB / FBX under ${cap} MiB.`;editor.toast?.(status.textContent);return false;}
  if(!window.solviAPI?.online){status.textContent='Upload requires the shared server.';editor.toast?.(status.textContent);return false;}
  if(replace&&(!editor.items.includes(replace)||!editor.canEdit(replace))){editor.toast?.('No permission to replace this object');return false;}
  try{
   status.textContent='Uploading '+file.name+'…';const form=new FormData();form.append('model',file);
   const result=await window.solviAPI.req('/api/scene/models',{method:'POST',body:form});
   if(!validAssetURL(result.model?.url))throw Error('Invalid model returned by server');
   if(replace){if(!(replace.userData.editorKind==='media'?await editor.replaceSpeakerModel(replace,result.model):await editor.replaceSceneModel(replace,result.model)))return false;}else if(replacing){if(!(replacing.userData.editorKind==='media'?await editor.replaceSpeakerModel(replacing,result.model):await editor.replaceSceneModel(replacing,result.model)))return false;}
   collection.unshift(result.model);if(!backdrop.hidden)render();status.textContent='Uploaded: '+result.model.label;
   if(backdrop.hidden)editor.toast?.('3D asset uploaded · '+result.model.label);return true;
  }catch(error){status.textContent='Upload failed: '+error.message;editor.toast?.(status.textContent);return false;}
 }
 window.addEventListener('solvi:admin-changed',()=>{if(!backdrop.hidden)void refresh();});
 $('assetsButton').onclick=()=>open();$('refreshAssetGallery').onclick=refresh;
 $('assetGallerySearch').addEventListener('input',()=>{page=0;selected.clear();render();});
 $('assetGalleryUpload').onchange=async e=>{const file=e.target.files?.[0];e.target.value='';if(file)await upload(file);};
 return {open,refresh,upload};
}
