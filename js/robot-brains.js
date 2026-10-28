import {captureRobotView} from './robots.js';
const $=id=>document.getElementById(id);
const fields={personality:'brainsPersonality',history:'brainsHistory',beliefs:'brainsBeliefs',triggers:'brainsTriggers',scenario:'brainsScenario'};
let activeRobot=null,frame=null,frameURL=null;
const cleanBrain=brain=>Object.fromEntries(Object.keys(fields).map(k=>[k,String(brain?.[k]||'')]));
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
   $('brainsEyeImage').hidden=true;$('brainsEyeImage').removeAttribute('src');
   $('brainsHeading').textContent=robot.name+' · Brains';
   const brain=cleanBrain(robot.userData.robotBrain);
   for(const [key,id] of Object.entries(fields)){$(id).value=brain[key];$(id).disabled=!window.solviEditor.canEdit(robot);}
   $('saveRobotBrains').disabled=!window.solviEditor.canEdit(robot);
   $('brainsVisionResult').textContent="Capture the head camera to inspect the robot's surroundings.";
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
     $('brainsVisionResult').textContent='Suggested scenario is editable. Press Save identity to preserve it. Estimated cost US$'+Number(data.usage?.estimated_usd||0).toFixed(6);
   }catch(e){$('brainsVisionResult').textContent='Scenario error: '+e.message;}
 };
 $('captureBrainsEye').onclick=async()=>{
   if(!activeRobot){toast('No robot selected');return;}
   $('brainsVisionResult').textContent='Capturing head camera…';
   try{const blob=await captureRobotView(world,activeRobot);if(!blob)throw Error('Head camera returned no image');
     if(frameURL)URL.revokeObjectURL(frameURL);frameURL=URL.createObjectURL(blob);frame=blob;
     $('brainsEyeImage').src=frameURL;$('brainsEyeImage').hidden=false;
     $('brainsVisionResult').textContent='Frame ready. SAM 3.1 can segment the named object with a configured Meta key.';
   }catch(error){$('brainsVisionResult').textContent=error.message;}
 };
 $('analyzeBrainsEye').onclick=async()=>{
   if(!frame){$('brainsVisionResult').textContent='Capture eyes first.';return;}
   if(!api.online||!api.auth()){$('brainsVisionResult').textContent='Online login required for SAM 3.1';return;}
   $('brainsVisionResult').textContent='Asking SAM 3.1 for the segmentation…';
   try{const image=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(frame);});
     const response=await api.req('/api/ai/vision',{method:'POST',body:JSON.stringify({image,prompt:$('brainsPrompt').value.trim()})});
     $('brainsVisionResult').textContent=JSON.stringify({result:response.result,usage:response.usage,note:response.note},null,2);
   }catch(error){$('brainsVisionResult').textContent='SAM error: '+error.message;}
 };
 window.addEventListener('solvi:room-changed',()=>{panel.hidden=true;activeRobot=null;});
}
