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
  else {image.classList.add('realm-card-empty');image.textContent='3D';}
  const title=document.createElement('strong');title.textContent=room.title;
  const hint=document.createElement('span');hint.textContent=active===room.id?'Current realm':'Open realm';
  card.append(image,title,hint);grid.append(card);
 }
 return grid;
}
