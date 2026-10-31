// Source selection for a face-mounted media frame. Authenticated uploads and
// saved bookmark screenshots use the same persisted media IDs as chat media.
const $=id=>document.getElementById(id);
const accepted=/^(image|audio|video)\//;
let camera=null,recorder=null,recorded=[],recordingType='',recordingTimer=0;
function status(message){$('surfaceSourceStatus').textContent=message;}
function mountAsset(editor,asset){
 const mount=editor.pendingSurfaceMount;
 const target=editor.items.find(o=>o.userData.editorId===mount?.target);
 if(!target||!editor.canEdit(target))throw Error('The selected surface is no longer editable');
 const obj=editor.addSceneMedia(asset,{backing:'white',shape:'speaker',loop:false,mount});
 if(asset.mime?.startsWith('video/')){obj.userData.media.stream='hls';editor.queueSave(obj);}
 editor.closeSurfaceMediaPicker();
 return obj;
}
function createCard(editor,asset,caption){
 const button=document.createElement('button');button.type='button';button.className='chat-media-card';
 const name=document.createElement('span');name.className='chat-media-name';name.textContent=caption||asset.name||'Media';
 const thumb=document.createElement('span');thumb.className='chat-media-thumb';
 thumb.textContent=asset.mime?.startsWith('audio/')?'Audio':asset.mime?.startsWith('video/')?'Video':'Image';
 button.append(thumb,name);
 button.onclick=()=>{try{mountAsset(editor,asset);}catch(e){status(e.message);}};
 if(asset.id&&asset.mime?.startsWith('image/'))window.solviAPI.mediaBlobInfo(asset.id).then(info=>{
  if(!button.isConnected){URL.revokeObjectURL(info.url);return;}
  editor.mediaPickerURLs.push(info.url);const image=document.createElement('img');image.src=info.url;image.alt='';image.loading='lazy';thumb.replaceChildren(image);
 }).catch(()=>{});
 return button;
}
export function stopSurfaceCamera(){
 if(recorder?.state==='recording'){recorder.onstop=null;recorder.stop();}recorder=null;
 clearTimeout(recordingTimer);recordingTimer=0;
 camera?.getTracks().forEach(track=>track.stop());camera=null;
 const preview=$('surfaceCameraPreview');if(preview){preview.pause();preview.srcObject=null;preview.hidden=true;}
 if($('surfaceRecordButton'))$('surfaceRecordButton').textContent='Record clip';
}
export async function chooseSurfaceSource(editor,mode){
 for(const tab of document.querySelectorAll('[data-surface-source]'))tab.setAttribute('aria-pressed',String(tab.dataset.surfaceSource===mode));
 const chat=mode==='chat';$('chatMediaSearch').hidden=!chat;$('chatMediaStatus').hidden=!chat;$('chatMediaResults').hidden=!chat;
 $('surfaceOtherSources').hidden=chat;
 $('surfaceBookmarkList').hidden=mode!=='bookmarks';$('surfaceCameraControls').hidden=mode!=='camera';
 if(mode!=='camera')stopSurfaceCamera();
 if(mode==='bookmarks'){
  const grid=$('surfaceBookmarkList');grid.replaceChildren();status('Loading saved camera bookmarks…');
  try{
   const out=await window.solviAPI.req('/api/bookmarks');if($('chatMediaPicker').hidden||$('surfaceBookmarkList').hidden)return;
   const bookmarks=(out.bookmarks||[]).filter(b=>b.room===(window.solviRoom||'main')&&b.media_id);
   status(bookmarks.length?`${bookmarks.length} saved camera views`:'No camera bookmarks in this realm');
   for(const bookmark of bookmarks)grid.append(createCard(editor,{id:bookmark.media_id,mime:'image/jpeg',name:bookmark.title},bookmark.title));
  }catch(e){status('Bookmarks unavailable: '+e.message);}
 }else if(mode==='camera')status('Open the webcam, then capture a photo or record a short clip.');
}
async function uploadAndMount(editor,file){
 if(!file||!accepted.test(file.type))throw Error('Choose an image, video or audio file');
 status('Uploading '+file.name+'…');const asset=await window.solviUploadMedia(file);
 mountAsset(editor,asset);
}
export function setupSurfaceSources(editor){
 document.querySelectorAll('[data-surface-source]').forEach(button=>button.onclick=()=>chooseSurfaceSource(editor,button.dataset.surfaceSource));
 $('surfaceUploadFile').onchange=async e=>{
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  try{await uploadAndMount(editor,file);}catch(error){status(error.message);}
 };
 $('surfaceOpenCamera').onclick=async()=>{
  stopSurfaceCamera();try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error('Camera requires HTTPS and permission');
   const options={video:{width:{ideal:960},height:{ideal:540}},audio:true};
   try{camera=await navigator.mediaDevices.getUserMedia(options);}catch{camera=await navigator.mediaDevices.getUserMedia({...options,audio:false});}
   const view=$('surfaceCameraPreview');view.hidden=false;view.srcObject=camera;view.muted=true;view.playsInline=true;
   await view.play();status('Live camera preview · capture or record');
  }catch(e){stopSurfaceCamera();status('Webcam unavailable: '+e.message);}
 };
 $('surfaceCapturePhoto').onclick=async()=>{
  try{
   const video=$('surfaceCameraPreview');if(!camera||!video.videoWidth)throw Error('Open the camera first');
   const canvas=document.createElement('canvas');canvas.width=video.videoWidth;canvas.height=video.videoHeight;
   canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));if(!blob)throw Error('Screenshot failed');
   await uploadAndMount(editor,new File([blob],`webcam-${Date.now()}.jpg`,{type:'image/jpeg'}));
  }catch(e){status(e.message);}
 };
 $('surfaceRecordButton').onclick=()=>{
  if(recorder?.state==='recording'){recorder.stop();return;}
  try{
   if(!camera)throw Error('Open camera first');
   if(typeof MediaRecorder==='undefined')throw Error('Webcam video recording is unavailable');
   const mime=['video/webm;codecs=vp8,opus','video/webm','video/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
   if(!mime)throw Error('No supported video recorder');recorded=[];recordingType=mime;
   recorder=new MediaRecorder(camera,{mimeType:mime});
   recorder.ondataavailable=e=>{if(e.data.size)recorded.push(e.data);};
   recorder.onstop=async()=>{
    clearTimeout(recordingTimer);$('surfaceRecordButton').textContent='Record clip';
    try{const type=recordingType.split(';')[0],blob=new Blob(recorded,{type});
     if(!blob.size)throw Error('Recording is empty');
     await uploadAndMount(editor,new File([blob],`webcam-${Date.now()}.${type==='video/mp4'?'mp4':'webm'}`,{type}));
    }catch(e){status(e.message);}
   };
   recorder.start(500);$('surfaceRecordButton').textContent='Stop recording';status('Recording webcam · 30 second maximum');
   recordingTimer=setTimeout(()=>{if(recorder?.state==='recording')recorder.stop();},30000);
  }catch(e){status(e.message);}
 };
}
