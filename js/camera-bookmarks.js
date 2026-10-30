// Per-user, per-realm camera bookmark gallery. All writes require authenticated backend.
const $=id=>document.getElementById(id);
const validID=id=>/^[a-f0-9-]{36}$/.test(String(id||''));
const isoDate=date=>new Date(date||Date.now()).toLocaleString();
function saveFile(name,data){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function initCameraBookmarks({world,api,room,getRooms,uploadFile,post,toast,switchRoom}){
 const panel=$('cameraBookmarksPanel'),grid=$('cameraBookmarkList'),realm=$('cameraBookmarkRealm');let records=[],urls=[];
 const clearImages=()=>{for(const url of urls)URL.revokeObjectURL(url);urls=[];};
 const fetchRecords=async()=>{const out=await api.req('/api/bookmarks');records=out.bookmarks||[];return records;};
 const populate=()=>{const rooms=getRooms();const current=realm.value||room();realm.replaceChildren(...rooms.map(r=>new Option(r.title||r.name||r.id,r.id)));realm.value=rooms.some(r=>r.id===current)?current:room();};
 const travel=async record=>{
  const target=record.room||record.room_id;
  if(target!==room())await switchRoom(target);
  world.setCameraFollowMode?.('free');
  world.camera.position.fromArray(record.pose.position);world.controls.target.fromArray(record.pose.target);
  world.camera.lookAt(world.controls.target);world.controls.update();
  panel.hidden=true;toast('Teleported to bookmark · '+record.title);
 };
 const render=async()=>{
  clearImages();grid.replaceChildren();const filtered=records.filter(r=>r.room===realm.value);
  if(!filtered.length){grid.textContent='No bookmarks for this realm.';return;}
  for(const record of filtered){
   const card=document.createElement('article');card.className='camera-bookmark-card';
   const image=document.createElement('img');image.alt='Camera view for '+record.title;image.loading='lazy';
   api.mediaBlobInfo(record.media_id).then(info=>{if(card.isConnected){image.src=info.url;urls.push(info.url);}else URL.revokeObjectURL(info.url);}).catch(()=>{image.alt='Screenshot unavailable';});
   const heading=document.createElement('strong');heading.textContent=record.title;
   const date=document.createElement('small');date.textContent=isoDate(record.created);
   const actions=document.createElement('div');actions.className='bookmark-actions';
   const go=document.createElement('button');go.type='button';go.textContent='Teleport';go.onclick=()=>travel(record).catch(e=>toast(e.message));
   const share=document.createElement('button');share.type='button';share.textContent='Share in chat';share.onclick=async()=>{try{await post({text:`Camera bookmark: ${record.title} #bookmark=${record.id}`,media:[record.media_id],room:record.room});toast('Bookmark posted to chat');}catch(e){toast(e.message);}};
   const del=document.createElement('button');del.type='button';del.textContent='Delete';del.onclick=async()=>{if(!confirm(`Delete bookmark “${record.title}”?`))return;await api.req('/api/bookmarks/'+record.id,{method:'DELETE'});await refresh();};
   actions.append(go,share,del);card.append(image,heading,date,actions);grid.append(card);
  }
 };
 const refresh=async()=>{await fetchRecords();populate();await render();};
 const open=async()=>{panel.hidden=false;try{await refresh();}catch(e){toast(e.message);}};
 $('bookmarksToolButton').onclick=open;$('cameraBookmarksClose').onclick=()=>{panel.hidden=true;clearImages();};
 realm.onchange=render;
 const captureBookmark=async({quick=false}={})=>{
  if(!api.auth())return toast('Sign in to save camera bookmarks');
  if(world.renderer.xr?.isPresenting)return toast('Capture a desktop view outside XR mode');
  const title=quick?`View · ${new Date().toLocaleString()}`:prompt('Bookmark title',`View · ${new Date().toLocaleTimeString()}`);if(!title?.trim())return;
  try{const pose={position:world.camera.position.toArray(),target:world.controls.target.toArray()};
   world.renderer.render(world.scene,world.camera);
   const blob=await new Promise((resolve,reject)=>world.renderer.domElement.toBlob(b=>b?resolve(b):reject(Error('Camera screenshot failed')),'image/jpeg',0.85));
   const media=await uploadFile(new File([blob],`camera-bookmark-${Date.now()}.jpg`,{type:'image/jpeg'}));
   await api.req('/api/bookmarks',{method:'POST',body:JSON.stringify({room:room(),title:title.trim(),media_id:media.id,pose})});
   realm.value=room();await refresh();toast('Saved camera bookmark');
  }catch(e){toast(e.message);}
 };
 $('cameraBookmarkCapture').onclick=()=>captureBookmark();
 $('cameraBookmarkQuick').onclick=()=>captureBookmark({quick:true});
 document.addEventListener('keydown',event=>{if(event.altKey&&event.metaKey&&event.code==='KeyS'){event.preventDefault();captureBookmark({quick:true});}});
 $('cameraBookmarkExport').onclick=()=>saveFile('solvi-bookmarks-'+new Date().toISOString().slice(0,10)+'.json',{format:'solvi-camera-bookmarks-v1',bookmarks:records});
 $('cameraBookmarkImport').onchange=async event=>{const file=event.target.files?.[0];event.target.value='';if(!file)return;
  try{const data=JSON.parse(await file.text());if(data.format!=='solvi-camera-bookmarks-v1'||!Array.isArray(data.bookmarks))throw Error('Unsupported bookmark JSON');
   let imported=0;for(const r of data.bookmarks.slice(0,100)){
    if(!r.media_id||!r.pose||!r.room)continue;
    try{await api.req('/api/bookmarks',{method:'POST',body:JSON.stringify({room:r.room,title:r.title,media_id:r.media_id,pose:r.pose})});imported++;}catch{}
   }await refresh();toast(`Imported ${imported} bookmark(s). Screenshots must still exist under this user.`);
  }catch(e){toast(e.message);}
 };
 $('cameraBookmarkClear').onclick=async()=>{const which=realm.value;const title=realm.selectedOptions[0]?.textContent||which;
  if(!confirm(`Remove ALL your camera bookmarks in “${title}”? This cannot be undone.`))return;
  await api.req('/api/bookmarks?room='+encodeURIComponent(which),{method:'DELETE'});await refresh();};
 window.addEventListener('solvi:bookmark-teleport',async event=>{const id=event.detail?.id;if(!validID(id))return;try{const result=await api.req('/api/bookmarks/'+id);await travel(result.bookmark);}catch(e){toast(e.message);}});
 window.addEventListener('solvi:room-changed',()=>{if(!panel.hidden)refresh().catch(()=>{});});
 if(location.hash.startsWith('#bookmark='))window.addEventListener('solvi:scene-ready',()=>window.dispatchEvent(new CustomEvent('solvi:bookmark-teleport',{detail:{id:location.hash.slice(10)}})),{once:true});
 return {open,refresh};
}
