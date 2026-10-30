// In-app destination chooser for dropped pictures and videos. No blocking browser prompts.
// The file remains local until an explicit action is selected.
export function chooseDroppedMediaAction(file){
 const dialog=document.getElementById('mediaDropDialog');
 if(!dialog)throw new Error('Media drop dialog is unavailable');
 if(dialog._cancelPrevious)dialog._cancelPrevious();
 const name=dialog.querySelector('#mediaDropFileName');
 const preview=dialog.querySelector('#mediaDropPreview');
 const chat=dialog.querySelector('#mediaDropChat');
 const scene=dialog.querySelector('#mediaDropScene');
 const cancel=dialog.querySelector('#mediaDropCancel');
 const dismiss=dialog.querySelector('#mediaDropDismiss');
 const backing=dialog.querySelector('#mediaDropBacking');
 const title=dialog.querySelector('#mediaDropTitle');
 const status=dialog.querySelector('#mediaDropFileKind');
 const type=String(file?.type||'');
 const video=type.startsWith('video/');
 const image=type.startsWith('image/');
 const audio=type.startsWith('audio/');
 const originalFocus=document.activeElement;
 name.textContent=String(file?.name||'Unnamed file').slice(0,140);
 status.textContent=(audio?'Spatial audio speaker':video?'Video screen':image?'Picture frame':'File attachment')+' · '+(file?.size/1048576).toFixed(2)+' MB';
 title.textContent='Where should this '+(audio?'audio file':video?'video':image?'image':'file')+' go?';
 backing.value=video?'black':'white';
 scene.disabled=!(image||video||audio);
 scene.hidden=!(image||video||audio);
 dialog.querySelector('#mediaDropSceneOptions').hidden=!(image||video||audio);
 dialog.querySelector('#mediaDropSpatialOptions').hidden=!audio;
 preview.replaceChildren();
 let url='';
 if(image||video||audio){
  url=URL.createObjectURL(file);
  const media=document.createElement(audio?'audio':(video?'video':'img'));
  media.src=url;
  if(video){media.muted=true;media.playsInline=true;media.controls=true;media.preload='metadata';}
  else if(audio){media.controls=true;media.preload='metadata';}
  else media.alt='Image preview';
  preview.append(media);
 }else{
  const placeholder=document.createElement('span');placeholder.className='media-drop-placeholder';placeholder.textContent='File';preview.append(placeholder);
 }
 dialog.hidden=false;
 return new Promise(resolve=>{
  let finished=false;
  const release=(result)=>{
   if(finished)return;
   finished=true;
   dialog.hidden=true;
   dialog._cancelPrevious=null;
   document.removeEventListener('keydown',onKeys,true);
   dialog.removeEventListener('click',onBackdrop);
   chat.removeEventListener('click',onChat);
   scene.removeEventListener('click',onScene);
   cancel.removeEventListener('click',onCancel);
   dismiss.removeEventListener('click',onCancel);
   preview.querySelector('video,audio')?.pause();
   preview.replaceChildren();
   if(url)URL.revokeObjectURL(url);
   if(originalFocus?.isConnected&&typeof originalFocus.focus==='function')originalFocus.focus();
   resolve(result);
  };
  const onChat=()=>release({mode:'chat'});
  // compatibility marker: release({mode:'scene',backing:backing.value})
  const onScene=()=>release({mode:'scene',backing:backing.value,group:dialog.querySelector('#mediaDropGroup')?.value||'',refDistance:Number(dialog.querySelector('#mediaDropRefDistance')?.value||4),maxDistance:Number(dialog.querySelector('#mediaDropMaxDistance')?.value||18),autoplayDistance:Number(dialog.querySelector('#mediaDropAutoplay')?.value||0),loop:dialog.querySelector('#mediaDropLoop')?.checked!==false,constantVolume:dialog.querySelector('#mediaDropConstant')?.checked===true});
  const onCancel=()=>release(null);
  const onBackdrop=event=>{if(event.target===dialog)release(null);};
  const onKeys=event=>{
   if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();release(null);return;}
   if(event.key!=='Tab')return;
   const controls=[...dialog.querySelectorAll('button:not([disabled]):not([hidden]),select:not([disabled])')].filter(n=>n.getClientRects().length);
   if(!controls.length)return;
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  };
  dialog._cancelPrevious=onCancel;
  chat.addEventListener('click',onChat);
  scene.addEventListener('click',onScene);
  cancel.addEventListener('click',onCancel);
  dismiss.addEventListener('click',onCancel);
  dialog.addEventListener('click',onBackdrop);
  document.addEventListener('keydown',onKeys,true);
  requestAnimationFrame(()=>{if(!finished)chat.focus();});
 });
}
