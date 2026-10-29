// Realm chooser: room snapshots are local browser previews, never uploaded without consent.
export const realmPreviewKey=id=>'solvi-realm-preview-v1-'+String(id||'main');
export function captureRealmPreview(room,canvas,storage=localStorage){
 if(!room||!canvas?.toDataURL)return false;
 try{const dst=document.createElement('canvas');dst.width=256;dst.height=144;
  const ctx=dst.getContext('2d');ctx.drawImage(canvas,0,0,dst.width,dst.height);
  storage.setItem(realmPreviewKey(room),dst.toDataURL('image/jpeg',.65));return true;
 }catch{return false;}
}
export function makeRealmCards(rooms,active,storage=localStorage){
 const grid=document.createElement('div');grid.className='realm-card-grid';
 for(const room of rooms){
  const card=document.createElement('button');card.type='button';card.className='realm-card';card.dataset.room=room.id;
  card.setAttribute('aria-pressed',String(active===room.id));
  const image=document.createElement('div');image.className='realm-card-image';
  const picture=storage.getItem(realmPreviewKey(room.id));
  if(picture?.startsWith('data:image/jpeg;base64,')){const img=document.createElement('img');img.src=picture;img.alt='Previously visited view of '+room.title;image.append(img);}
  else {image.classList.add('realm-card-empty');}
  const title=document.createElement('strong');title.className='realm-card-title';title.textContent=room.title;
  const faces=document.createElement('div');faces.className='realm-card-people';faces.setAttribute('aria-label',`${Number(room.participantCount||0)} participants`);
  const count=document.createElement('span');count.className='realm-card-count';count.textContent=String(Number(room.participantCount||0))+' here';faces.append(count);
  for(const user of (room.participants||[]).slice(0,5)){
   const avatar=document.createElement('span');avatar.className='realm-card-avatar';avatar.title=user.name||'Participant';
   if(typeof user.avatar==='string'&&(/^data:image\/(?:png|jpeg|webp);base64,/.test(user.avatar)||user.avatar.startsWith('/api/'))){const img=document.createElement('img');img.src=user.avatar;img.alt=user.name||'';avatar.append(img);}
   else avatar.textContent=(user.name||'?').slice(0,1).toUpperCase();faces.append(avatar);
  }
  image.append(title,faces);card.append(image);const tile=document.createElement('div');tile.className='realm-card-tile';tile.append(card);grid.append(tile);
  if(room.canManage){
   const controls=document.createElement('div');controls.className='realm-card-controls';
   const rename=document.createElement('button');rename.type='button';rename.className='realm-card-action';rename.dataset.action='rename';rename.dataset.room=room.id;rename.textContent='Rename';
   const remove=document.createElement('button');remove.type='button';remove.className='realm-card-action';remove.dataset.action='delete';remove.dataset.room=room.id;remove.textContent='Delete';remove.disabled=room.id==='main';
   controls.append(rename,remove);tile.append(controls);
   card.classList.add('realm-card-managed');
  }
 }
 return grid;
}
