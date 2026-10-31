import {compactAudioPlayer} from './compact-audio-player.js';
import {compactMediaPlayer} from './compact-media-player.js';
// Secure, authenticated chat-attachment presentation. Blob URLs never expose session tokens.
let menuDelegateReady=false;
function ensureMenuDelegate(){
 if(menuDelegateReady)return;
 menuDelegateReady=true;
 document.addEventListener('pointerdown',event=>{
  document.querySelectorAll('.chat-attachment-menu:not([hidden])').forEach(menu=>{
   if(!menu.parentElement?.contains(event.target))menu.hidden=true;
  });
 });
}

export function attachmentKind(mime=''){
 const type=String(mime).split(';')[0].toLowerCase();
 if(['image/png','image/jpeg','image/gif','image/webp'].includes(type))return 'image';
 if(type.startsWith('audio/'))return 'audio';
 if(type.startsWith('video/'))return 'video';
 if(type==='application/pdf')return 'pdf';
 if(type==='text/plain')return 'text';
 return 'file';
}
export function attachmentName(name,kind='file'){
 const sanitized=String(name||'').replace(/[\x00-\x1f\x7f<>]/g,'').trim().slice(0,120);
 return sanitized||({image:'Image',audio:'Audio recording',video:'Video',pdf:'PDF document',text:'Text file'}[kind]||'Attachment');
}
export function renderChatAttachment(slot,{id,url,mime,name,blob},openViewer,actions={}){
 const kind=attachmentKind(mime),label=attachmentName(name,kind);
 slot.className='chat-attachment chat-attachment-'+kind;
 slot.replaceChildren();
 const title=document.createElement('small');title.className='chat-attachment-title';title.textContent=label;
 const download=document.createElement('a');download.href=url;download.download=label;download.textContent='↓';download.title='Download';download.setAttribute('aria-label','Download '+label);download.className='chat-attachment-save';
 const menuButton=document.createElement('button');menuButton.type='button';menuButton.className='chat-attachment-more';menuButton.textContent='⋯';menuButton.setAttribute('aria-label','More actions for '+label);
 const menu=document.createElement('div');menu.className='chat-attachment-menu';menu.hidden=true;
 const toggleMenu=event=>{event?.stopPropagation?.();menu.hidden=!menu.hidden;};
 menuButton.onclick=toggleMenu;
 const menuSave=document.createElement('a');menuSave.href=url||'#';menuSave.download=label;menuSave.textContent='Download';menuSave.className='chat-attachment-menu-item';menu.append(menuSave);
 const downloadFull=async(event)=>{
  if(url)return;
  event.preventDefault();
  if(!id||!globalThis.solviAPI?.mediaBlobInfo)return;
  try{
   const result=await globalThis.solviAPI.mediaBlobInfo(id);
   const anchor=document.createElement('a');anchor.href=result.url;anchor.download=label;anchor.style.display='none';document.body.append(anchor);anchor.click();anchor.remove();
   setTimeout(()=>URL.revokeObjectURL(result.url),15000);
  }catch(error){const status=slot.querySelector('.chat-player-status');if(status){status.hidden=false;status.textContent='Download unavailable';}}
 };
 download.onclick=downloadFull;menuSave.onclick=downloadFull;
 if((kind==='image'||kind==='video'||kind==='audio')&&typeof actions.addToScene==='function'){const add=document.createElement('button');add.type='button';add.textContent='Add to scene';add.className='chat-attachment-menu-item';add.onclick=event=>{event.stopPropagation();menu.hidden=true;actions.addToScene({id,url,mime,name:label,blob,kind});};menu.append(add);}
 ensureMenuDelegate();
 if(kind==='image'){
  const button=document.createElement('button');button.type='button';button.className='chat-image-open';button.setAttribute('aria-label','Enlarge image '+label);
  const img=document.createElement('img');img.src=url;img.alt=label;img.loading='lazy';img.decoding='async';button.append(img);
  button.onclick=()=>openViewer({kind,url,label});slot.append(button,title,menuButton,menu,download);
 }else if(kind==='audio'||kind==='video'){
  const actionsRow=document.createElement('div');actionsRow.className='chat-attachment-actions';
  download.textContent='↓';download.title='Download';actionsRow.append(download);
  if(typeof actions.deleteMedia==='function'){
   const remove=document.createElement('button');remove.type='button';remove.className='chat-attachment-delete';remove.textContent='×';remove.title='Delete attachment';remove.setAttribute('aria-label','Delete attachment');
   remove.onclick=()=>actions.deleteMedia({id,url,mime,name:label,kind},slot);actionsRow.append(remove);
  }
  const player=kind==='audio'?compactAudioPlayer({url,id,label}):compactMediaPlayer({url,id,label,kind:'video'});
  slot.append(player,actionsRow,menuButton,menu);
 }else if(kind==='pdf'){
  const button=document.createElement('button');button.type='button';button.textContent='Read PDF';button.className='chat-read-file';button.onclick=()=>openViewer({kind,url,label});
  slot.append(menuButton,menu,title,button,download);
 }else if(kind==='text'){
  const details=document.createElement('details');const summary=document.createElement('summary');summary.textContent='Read text';
  const pre=document.createElement('pre');pre.textContent='Loading text…';details.append(summary,pre);
  // Text is never interpreted as HTML, JavaScript, Markdown or a command.
  details.addEventListener('toggle',()=>{if(details.open&&pre.textContent==='Loading text…')blob.text().then(text=>{pre.textContent=text.slice(0,100000);}).catch(()=>{pre.textContent='Unable to read text';});});
  slot.append(menuButton,menu,title,details,download);
 }else{slot.append(menuButton,menu,title,download);}
}
export function ensureChatMediaViewer(){
 let overlay=document.getElementById('chatMediaViewer');
 if(overlay)return overlay;
 overlay=document.createElement('div');overlay.id='chatMediaViewer';overlay.className='chat-media-viewer';overlay.hidden=true;
 overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-label','Attachment viewer');
 const bar=document.createElement('div');bar.className='chat-media-viewer-bar';
 const heading=document.createElement('strong');heading.className='chat-media-viewer-heading';
 const close=document.createElement('button');close.type='button';close.className='chat-media-viewer-close';close.textContent='Close';
 const content=document.createElement('div');content.className='chat-media-viewer-content';
 bar.append(heading,close);overlay.append(bar,content);document.body.append(overlay);
 const dismiss=()=>{overlay.hidden=true;content.replaceChildren();document.removeEventListener('keydown',onEscape);};
 const onEscape=e=>{if(e.key==='Escape')dismiss();};
 close.onclick=dismiss;overlay.addEventListener('click',e=>{if(e.target===overlay)dismiss();});
 overlay.showFile=({kind,url,label})=>{
  heading.textContent=label;content.replaceChildren();
  if(kind==='image'){
   const img=document.createElement('img');img.src=url;img.alt=label;img.className='chat-media-large';content.append(img);
  }else if(kind==='pdf'){
   const frame=document.createElement('iframe');frame.src=url;frame.title=label;frame.setAttribute('sandbox','allow-downloads');content.append(frame);
   const link=document.createElement('a');link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='Open PDF in browser (if preview unavailable)';content.append(link);
  }
  overlay.hidden=false;document.addEventListener('keydown',onEscape);
  close.focus();
 };
 overlay.dismiss=dismiss;
 return overlay;
}
