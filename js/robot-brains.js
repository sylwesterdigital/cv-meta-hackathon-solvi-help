import {captureRobotView} from './robots.js';
const $=id=>document.getElementById(id);
const fields={personality:'brainsPersonality',history:'brainsHistory',beliefs:'brainsBeliefs',triggers:'brainsTriggers',scenario:'brainsScenario'};
let activeRobot=null,frame=null,frameURL=null;
const cleanBrain=brain=>Object.fromEntries(Object.keys(fields).map(k=>[k,String(brain?.[k]||'')]));
const dollars=usage=>'US$'+Number(usage?.estimated_usd||0).toFixed(6)+' estimated';
function clearBoxes(){const canvas=$('brainsEyeOverlay');canvas.getContext('2d').clearRect(0,0,canvas.width,canvas.height);}
function showBoxes(boxes){
 const canvas=$('brainsEyeOverlay'),image=$('brainsEyeImage');
 canvas.width=image.naturalWidth||512;canvas.height=image.naturalHeight||512;
 const ctx=canvas.getContext('2d');ctx.clearRect(0,0,canvas.width,canvas.height);
 ctx.lineWidth=3;ctx.strokeStyle='#6effb3';ctx.fillStyle='#6effb3';ctx.font='bold 17px sans-serif';
 for(const box of boxes||[]){
  const scaleX=canvas.width/box.width,scaleY=canvas.height/box.height;
  const x=box.x1*scaleX,y=box.y1*scaleY,w=(box.x2-box.x1)*scaleX,h=(box.y2-box.y1)*scaleY;
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)continue;
  ctx.strokeRect(x,y,w,h);ctx.fillText('Object '+box.id,Math.max(3,x),Math.max(19,y-5));
 }
}
export function initRobotBrains(world,api,getRoom,toast){
 const panel=$('robotBrainsPanel');
 $('closeRobotBrains').onclick=()=>{panel.hidden=true;};
 async function refreshMemory(){
   if(!api.online||!api.auth()||!activeRobot)return;
   try{const data=await api.req('/api/robots/memory?room='+encodeURIComponent(getRoom())+'&id='+encodeURIComponent(activeRobot.userData.editorId));
     $('brainsMemory').textContent=data.memories?.map(m=>`${m.created}: ${m.event}`).join('\n')||'No recorded experiences yet. Use @'+activeRobot.name.split(' ')[0]+' in world chat.';
   }catch(e){$('brainsMemory').textContent=e.message;}
 }
 function open(){
   const robot=window.solviEditor?.robot();if(!robot){toast('Select a robot in Objects first.');return;}
   activeRobot=robot;frame=null;
   if(frameURL)URL.revokeObjectURL(frameURL);frameURL=null;
   $('brainsEyeStage').hidden=true;$('brainsEyeImage').hidden=true;$('brainsEyeImage').removeAttribute('src');clearBoxes();
   $('brainsHeading').textContent=robot.name+' · Brains';
   const brain=cleanBrain(robot.userData.robotBrain);
   for(const [key,id] of Object.entries(fields)){$(id).value=brain[key];$(id).disabled=!window.solviEditor.canEdit(robot);}
   $('saveRobotBrains').disabled=!window.solviEditor.canEdit(robot);
   $('brainsVisionResult').textContent='Capture eyes, then Describe scene with Muse Spark or Find object with SAM 3.1.';
   panel.hidden=false;refreshMemory();
 }
 window.addEventListener('solvi:open-brains',open);
 $('saveRobotBrains').onclick=()=>{
   if(!activeRobot||!window.solviEditor.canEdit(activeRobot)){toast('Robot is read-only');return;}
   const before=window.solviEditor.snapshot(activeRobot);
   activeRobot.userData.robotBrain=Object.fromEntries(Object.entries(fields).map(([k,id])=>[k,$(id).value.trim()]));
   window.solviEditor.recordEdit(before,window.solviEditor.snapshot(activeRobot));
   window.solviEditor.queueSave(activeRobot);
   toast(activeRobot.name+' identity saved');
 };
 $('suggestBrainsScenario').onclick=async()=>{
   if(!activeRobot||!window.solviEditor.canEdit(activeRobot)){toast('Robot is read-only');return;}
   $('brainsVisionResult').textContent='Generating a fictional learning scenario…';
   try{const data=await api.req('/api/robots/scenario',{method:'POST',body:JSON.stringify({room:getRoom(),id:activeRobot.userData.editorId})});
     $('brainsScenario').value=data.scenario||'';
     $('brainsVisionResult').textContent='Suggested scenario is editable. Press Save identity to preserve it. '+dollars(data.usage);
   }catch(e){$('brainsVisionResult').textContent='Scenario error: '+e.message;}
 };
 $('captureBrainsEye').onclick=async()=>{
   if(!activeRobot){toast('No robot selected');return;}
   $('brainsVisionResult').textContent='Capturing head camera…';
   try{const blob=await captureRobotView(world,activeRobot);if(!blob)throw Error('Head camera returned no image');
     if(frameURL)URL.revokeObjectURL(frameURL);frameURL=URL.createObjectURL(blob);frame=blob;
     $('brainsEyeImage').onload=()=>{const image=$('brainsEyeImage');const canvas=$('brainsEyeOverlay');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;clearBoxes();};
     $('brainsEyeImage').src=frameURL;$('brainsEyeImage').hidden=false;$('brainsEyeStage').hidden=false;
     $('brainsVisionResult').textContent='JPEG screenshot captured locally. No AI request sent yet. Choose one action to send the frame and visible prompt to Meta.';
   }catch(error){$('brainsVisionResult').textContent=error.message;}
 };
 async function inspect(mode){
   if(!frame){$('brainsVisionResult').textContent='Capture eyes first.';return;}
   if(!api.online||!api.auth()){$('brainsVisionResult').textContent='Online login required for Meta vision';return;}
   const prompt=mode==='segment'?$('brainsPrompt').value.trim():$('brainsVisionQuestion').value.trim();
   if(!prompt){$('brainsVisionResult').textContent='Enter a prompt first.';return;}
   const model=mode==='segment'?'SAM 3.1':'Muse Spark 1.3';
   const imageElement=$('brainsEyeImage');
   $('brainsVisionResult').textContent=`Sending ${imageElement.naturalWidth||512} × ${imageElement.naturalHeight||512} JPEG to ${model}.\nPrompt: ${prompt}\nAwaiting model response…`;
   $('analyzeBrainsEye').disabled=true;$('describeBrainsEye').disabled=true;
   try{
     const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(frame);});
     const response=await api.req('/api/ai/vision',{method:'POST',body:JSON.stringify({image,prompt,mode})});
     const requestSummary=`Model: ${response.request?.model||model}\nPrompt: ${response.request?.prompt||prompt}\nImage: ${imageElement.naturalWidth||512} × ${imageElement.naturalHeight||512} JPEG (${response.request?.image?.bytes||frame.size} bytes)\nStorage: Meta store=false\nUsage: ${dollars(response.usage)}${response.usage?.input_tokens!=null?' · input '+response.usage.input_tokens+' tokens · output '+response.usage.output_tokens+' tokens':''}`;
     if(mode==='describe'){
       clearBoxes();
       $('brainsVisionResult').textContent=requestSummary+'\n\nSCENE ANALYSIS\n'+(response.description||'Muse Spark returned no text. Try a shorter question.');
     }else{
       const count=response.result?.match_count||0;
       showBoxes(response.result?.boxes||[]);
       const explanation=response.result?.no_matches?'No objects matched this noun phrase. Try robot, chair, cube, person, or another concrete object visible in the screenshot.':response.result?.parse_warning?'SAM returned data but the box format was not recognised. The raw mask stream is not displayed.':`${count} object(s) found. Bounding boxes are drawn on the screenshot; detailed pixel masks are not yet displayed.`;
       $('brainsVisionResult').textContent=requestSummary+'\n\nSEGMENTATION\n'+explanation+'\n'+(response.result?.boxes||[]).map(b=>`#${b.id}: (${Math.round(b.x1)}, ${Math.round(b.y1)}) – (${Math.round(b.x2)}, ${Math.round(b.y2)})${b.confidence==null?'':' · score '+b.confidence}`).join('\n');
     }
   }catch(error){$('brainsVisionResult').textContent=model+' request failed: '+error.message;}
   finally{$('analyzeBrainsEye').disabled=false;$('describeBrainsEye').disabled=false;}
 }
 $('analyzeBrainsEye').onclick=()=>inspect('segment');
 $('describeBrainsEye').onclick=()=>inspect('describe');
 window.addEventListener('solvi:room-changed',()=>{panel.hidden=true;activeRobot=null;frame=null;});
}
