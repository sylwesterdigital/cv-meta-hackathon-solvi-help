import {canPreset,presetEntry} from './object-preset-data.js';
import {makeFurniture,buildPrimitive} from './primitive-properties.js';
import {makeOfficeStairs} from './office-stairs.js';
import {makeOfficeWall} from './office-walls.js';
import {renderModelThumbnail} from './preview-renderer.js';
import * as THREE from 'three';
import {textEntry,confirmAction} from './app-dialogs.js';

const $=id=>document.getElementById(id);
// Renders an actual object thumbnail without moving the scene camera or the source mesh.
// This rendering is transient and has no scene or realm side effects.
// Offscreen framing is based on actual camera-space corners, not the world-space
// bounding sphere. This prevents tall, wide and offset procedural objects from
// being stranded in a thumbnail corner. The source and live scene are untouched.
export function presetProjectedFrustum(bounds,camera,width=384,height=256,padding=.105){
 const min=new THREE.Vector3(Infinity,Infinity,Infinity),max=new THREE.Vector3(-Infinity,-Infinity,-Infinity);
 for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
  const v=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);
  min.min(v);max.max(v);
 }
 const spanX=Math.max(.03,max.x-min.x),spanY=Math.max(.03,max.y-min.y),aspect=width/height;
 const halfH=Math.max(spanY/(2*(1-padding)),spanX/(2*aspect*(1-padding)));
 const halfW=halfH*aspect,centerX=(min.x+max.x)/2,centerY=(min.y+max.y)/2;
 return {left:centerX-halfW,right:centerX+halfW,top:centerY+halfH,bottom:centerY-halfH};
}
export function capturePresetThumbnail(editor,source){
 if(!source)return '';
 // The avatar and object galleries share one independent WebGL thumbnail context.
 // Never change the live world's viewport, render target, XR or camera state.
 const width=480,height=320,scene=new THREE.Scene();scene.background=new THREE.Color('#354759');
 const clone=source.clone(true);
 clone.visible=true;clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.scale.set(1,1,1);
 clone.traverse(node=>{if(node.isMesh)node.visible=true;});scene.add(clone);
 scene.add(new THREE.HemisphereLight(0xffffff,0x8399af,3.5));
 scene.add(new THREE.AmbientLight(0xffffff,.9));
 const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(-4,8,7);scene.add(key);
 const fill=new THREE.DirectionalLight(0xb5deff,2);fill.position.set(5,4,-5);scene.add(fill);
 scene.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(clone);
 if(bounds.isEmpty())return '';
 const size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const camera=new THREE.OrthographicCamera(-1,1,1,-1,.01,10000);
 const distance=Math.max(4,size.length()*3);
 camera.position.copy(center).add(new THREE.Vector3(1.5,1.15,1.75).normalize().multiplyScalar(distance));
 camera.lookAt(center);camera.updateMatrixWorld(true);
 Object.assign(camera,presetProjectedFrustum(bounds,camera,width,height,.14));camera.updateProjectionMatrix();
 try{return renderModelThumbnail(scene,camera,width,height,{type:'image/webp',quality:.91});}
 catch(error){console.warn('Preset thumbnail render unavailable',error);return '';}
}

// Build thumbnails from the saved configuration, not from an old crop captured
// while an editor gizmo or world camera was active.
function previewSource(preset){
 const data=preset.payload||{};
 if(data.kind==='furniture')return makeFurniture(data.furniture||{});
 if(data.kind==='stairs'&&data.stairs?.variant!=='lift')return makeOfficeStairs(data.stairs||{});
 if(data.kind==='wall')return makeOfficeWall(data.wall||{});
 if(['cube','sphere','cylinder','plane','torus'].includes(data.kind)){
  const geometry=buildPrimitive(data.kind,data.primitive||{});
  return geometry?new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({color:data.color||'#b2bdc8',roughness:.76})):null;
 }
 return null;
}
function releasePreviewSource(source){
 if(!source)return;const seen=new Set();source.traverse(o=>{
  if(o.geometry&&!seen.has(o.geometry)){o.geometry.dispose?.();seen.add(o.geometry);}
  for(const mat of Array.isArray(o.material)?o.material:[o.material])if(mat&&!seen.has(mat)){mat.dispose?.();seen.add(mat);}
 });
}

export function setupObjectPresets(editor){
 const backdrop=$('objectPresetsBackdrop'),grid=$('objectPresetsGrid'),search=$('objectPresetsSearch'),tabs=$('objectPresetsCategories'),status=$('objectPresetsStatus');
 let records=[],category='All',requestId=0;const thumbnailCache=new Map();
 const thumbnailFor=preset=>{
  const key=JSON.stringify([preset.id,preset.payload]);
  if(thumbnailCache.has(key))return thumbnailCache.get(key);
  let thumbnail=preset.thumbnail||'';
  let transient=null;
  try{
   transient=previewSource(preset);
   if(transient){const capture=capturePresetThumbnail(editor,transient);if(capture)thumbnail=capture;}
  }catch(error){console.warn('Preset preview fallback',error);}
  finally{releasePreviewSource(transient);}
  thumbnailCache.set(key,thumbnail);return thumbnail;
 };

 const note=value=>{status.textContent=value;};
 const close=()=>{backdrop.hidden=true;};
 const categories=['All','Furniture','Tools','Nature','Props','Geometry','Architecture'];
 function render(){
  tabs.replaceChildren();for(const c of categories){const button=document.createElement('button');button.type='button';button.textContent=c;button.setAttribute('aria-selected',String(category===c));button.onclick=()=>{category=c;render();};tabs.append(button);}
  const q=search.value.trim().toLocaleLowerCase();const shown=records.filter(p=>(category==='All'||p.category===category)&&p.name.toLocaleLowerCase().includes(q));
  grid.replaceChildren();if(!shown.length){const empty=document.createElement('p');empty.textContent=records.length?'No matching presets.':'No presets yet. Configure a procedural object, then choose “Save as preset” in Properties.';grid.append(empty);}
  for(const preset of shown){
   const item=document.createElement('article');item.className='object-preset-card';item.setAttribute('role','listitem');
   const preview=document.createElement('div');preview.className='object-preset-image';preview.setAttribute('role','button');preview.tabIndex=0;preview.title='Add '+preset.name;preview.setAttribute('aria-label','Add '+preset.name);
   const thumbnail=thumbnailFor(preset);if(/^data:image\/(webp|png|jpeg);base64,/.test(thumbnail)){const img=document.createElement('img');img.src=thumbnail;img.alt=preset.name+' preview';img.loading='lazy';preview.append(img);}else{const icon=document.createElement('span');icon.className='object-preset-placeholder';icon.textContent='▱';preview.append(icon);}
   const heading=document.createElement('strong');heading.textContent=preset.name;heading.title=preset.name;
   const meta=document.createElement('small');meta.textContent=(preset.payload?.furniture?.variant||preset.kind)+' · '+preset.category;
   const caption=document.createElement('div');caption.className='object-preset-caption';caption.append(heading,meta);
   const actions=document.createElement('div');actions.className='object-preset-actions';
   const create=()=>{
    const entry=presetEntry(preset.payload);if(!entry)return note('This preset is not supported.');entry.name=preset.name;
    if(!editor.addFromPreset(entry)){note('This object could not be added.');return;}
    close();editor.toast('Added preset · '+preset.name);
   };
   preview.onclick=create;preview.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();create();}};
   const del=document.createElement('button');del.type='button';del.className='object-preset-delete';del.title='Delete '+preset.name;del.setAttribute('aria-label','Delete '+preset.name);
   del.innerHTML='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 15H6L5 6m5 4v7m4-7v7"/></svg>';
   del.onclick=async()=>{if(!await confirmAction('Delete preset “'+preset.name+'”? This does not delete objects already added to scenes.',{title:'Delete preset',confirmLabel:'Delete',danger:true}))return;
    try{await window.solviAPI.req('/api/object-presets/'+encodeURIComponent(preset.id),{method:'DELETE'});records=records.filter(row=>row.id!==preset.id);render();note('Preset deleted.');}catch(e){note('Could not delete preset: '+e.message);}
   };
   actions.append(del);item.append(preview,caption,actions);grid.append(item);
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
