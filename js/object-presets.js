import {canPreset,presetEntry} from './object-preset-data.js';
import {makeFurniture} from './primitive-properties.js';
import * as THREE from 'three';
import {textEntry,confirmAction} from './app-dialogs.js';

const $=id=>document.getElementById(id);
// Renders an actual object thumbnail without moving the scene camera or the source mesh.
// This rendering is transient and has no scene or realm side effects.
export function capturePresetThumbnail(editor,source){
 const renderer=editor.world.renderer;
 if(!renderer?.setRenderTarget||!source)return '';
 const width=256,height=180,target=new THREE.WebGLRenderTarget(width,height,{depthBuffer:true});
 const scene=new THREE.Scene();scene.background=new THREE.Color('#243241');
 const clone=source.clone(true);clone.position.set(0,0,0);clone.rotation.set(0,0,0);scene.add(clone);
 scene.add(new THREE.HemisphereLight(0xffffff,0x637387,2.2));
 const key=new THREE.DirectionalLight('#ffffff',3);key.position.set(5,8,7);scene.add(key);
 const fill=new THREE.DirectionalLight('#a0caff',1.1);fill.position.set(-4,3,-5);scene.add(fill);
 const bounds=new THREE.Box3().setFromObject(clone);
 if(bounds.isEmpty()){target.dispose();return '';}
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 // Orthographic fit uses *projected corners*, not a guessed sphere around world geometry.
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,1000);
 camera.position.copy(center).add(new THREE.Vector3(1.6,1.2,2.2).normalize().multiplyScalar(Math.max(5,size.length()*2)));
 camera.lookAt(center);camera.updateMatrixWorld(true);
 // Symmetric camera frustum centered on the object, with consistent padding.
 // Avoid off-center projected AABBs when the source mesh has nested offsets.
 const radius=Math.max(.15,size.length()*.5);
 const halfH=Math.max(radius*1.48,radius*1.48*height/width);
 const halfW=halfH*width/height;
 camera.left=-halfW;camera.right=halfW;camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
 const oldTarget=renderer.getRenderTarget();const oldScissor=renderer.getScissorTest?.();const oldXR=renderer.xr?.enabled;const oldViewport=renderer.getViewport?.(new THREE.Vector4());
 try{
  if(renderer.xr)renderer.xr.enabled=false;
  renderer.setRenderTarget(target);renderer.setScissorTest?.(false);renderer.setViewport(0,0,width,height);renderer.clear?.(true,true,true);renderer.render(scene,camera);
  const data=new Uint8Array(width*height*4);renderer.readRenderTargetPixels(target,0,0,width,height,data);
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const context=canvas.getContext('2d');const image=context.createImageData(width,height);
  for(let row=0;row<height;row++)image.data.set(data.subarray(row*width*4,(row+1)*width*4),(height-1-row)*width*4);
  context.putImageData(image,0,0);
  return canvas.toDataURL('image/webp',.75);
 }catch{return '';}
 finally{renderer.setRenderTarget(oldTarget);if(oldScissor!==undefined)renderer.setScissorTest(oldScissor);if(oldViewport)renderer.setViewport(oldViewport);if(renderer.xr)renderer.xr.enabled=oldXR;target.dispose();}
}

export function setupObjectPresets(editor){
 const backdrop=$('objectPresetsBackdrop'),grid=$('objectPresetsGrid'),search=$('objectPresetsSearch'),tabs=$('objectPresetsCategories'),status=$('objectPresetsStatus');
 let records=[],category='All',requestId=0;const thumbnailCache=new Map();
 const thumbnailFor=preset=>{
  if(preset.payload?.kind!=='furniture')return preset.thumbnail||'';
  const key=JSON.stringify([preset.id,preset.payload.furniture]);
  if(thumbnailCache.has(key))return thumbnailCache.get(key);
  let thumbnail=preset.thumbnail||'';
  try{const transient=makeFurniture(preset.payload.furniture);const capture=capturePresetThumbnail(editor,transient);
   if(capture)thumbnail=capture;transient.traverse(o=>{o.geometry?.dispose?.();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose?.());else o.material?.dispose?.();});}
  catch(error){console.warn('Preset preview fallback',error);}
  thumbnailCache.set(key,thumbnail);return thumbnail;
 };

 const note=value=>{status.textContent=value;};
 const close=()=>{backdrop.hidden=true;};
 const categories=['All','Furniture','Props','Geometry','Architecture'];
 function render(){
  tabs.replaceChildren();for(const c of categories){const button=document.createElement('button');button.type='button';button.textContent=c;button.setAttribute('aria-selected',String(category===c));button.onclick=()=>{category=c;render();};tabs.append(button);}
  const q=search.value.trim().toLocaleLowerCase();const shown=records.filter(p=>(category==='All'||p.category===category)&&p.name.toLocaleLowerCase().includes(q));
  grid.replaceChildren();if(!shown.length){const empty=document.createElement('p');empty.textContent=records.length?'No matching presets.':'No presets yet. Configure a procedural object, then choose “Save as preset” in Properties.';grid.append(empty);}
  for(const preset of shown){
   const item=document.createElement('article');item.className='object-preset-card';item.setAttribute('role','listitem');
   const preview=document.createElement('button');preview.type='button';preview.className='object-preset-image';preview.title='Add '+preset.name;
   const thumbnail=thumbnailFor(preset);if(/^data:image\/(webp|png|jpeg);base64,/.test(thumbnail)){const img=document.createElement('img');img.src=thumbnail;img.alt=preset.name+' preview';img.loading='lazy';preview.append(img);}else{const icon=document.createElement('span');icon.className='object-preset-placeholder';icon.textContent='▱';preview.append(icon);}
   const heading=document.createElement('strong');heading.textContent=preset.name;heading.title=preset.name;
   const meta=document.createElement('small');meta.textContent=(preset.payload?.furniture?.variant||preset.kind)+' · '+preset.category;
   const actions=document.createElement('div');actions.className='object-preset-actions';
   const add=document.createElement('button');add.type='button';add.textContent='Add';
   const create=()=>{
    const entry=presetEntry(preset.payload);if(!entry)return note('This preset is not supported.');entry.name=preset.name;
    if(!editor.addFromPreset(entry)){note('This object could not be added.');return;}
    close();editor.toast('Added preset · '+preset.name);
   };
   add.onclick=create;preview.onclick=create;
   const del=document.createElement('button');del.type='button';del.textContent='Delete';del.title='Delete '+preset.name;
   del.onclick=async()=>{if(!await confirmAction('Delete preset “'+preset.name+'”? This does not delete objects already added to scenes.',{title:'Delete preset',confirmLabel:'Delete',danger:true}))return;
    try{await window.solviAPI.req('/api/object-presets/'+encodeURIComponent(preset.id),{method:'DELETE'});records=records.filter(row=>row.id!==preset.id);render();note('Preset deleted.');}catch(e){note('Could not delete preset: '+e.message);}
   };
   actions.append(del);item.append(preview,heading,meta,actions);grid.append(item);
  }
  note(shown.length+' presets shown · '+records.length+' saved');
 }
 async function refresh(){const token=++requestId;
  if(!window.solviAPI?.online){records=[];render();note('Sign in to see account-saved presets.');return;}
  try{const response=await window.solviAPI.req('/api/object-presets');if(token!==requestId)return;records=response.presets||[];render();}catch(error){note('Could not load presets: '+error.message);}
 }
 async function open(){category='All';search.value='';backdrop.hidden=false;await refresh();}
 async function save(){const obj=editor.selected,entry=editor.snapshot(obj);if(!editor.canEdit(obj)||!canPreset(entry))return;
  const title=(await textEntry('Save object preset',obj.name||'My preset',{message:'Give this configuration a searchable name.'}))?.trim().slice(0,90);if(!title)return;
  const payload=presetEntry(entry);const thumbnail=capturePresetThumbnail(editor,obj);
  try{await window.solviAPI.req('/api/object-presets',{method:'POST',body:JSON.stringify({name:title,payload,thumbnail})});editor.toast('Preset saved · '+title);}
  catch(e){editor.toast('Preset could not be saved: '+e.message);}
 }
 $('objectPresetsClose').onclick=close;backdrop.addEventListener('pointerdown',e=>{if(e.target===backdrop)close();});
 search.oninput=render;
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!backdrop.hidden)close();});
 $('saveObjectPreset').onclick=save;
 return {open,save,refresh};
}
