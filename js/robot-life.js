import {characterPolicy} from './robot-character-core.js';
// v0.2.210: owner-authorised, browser-only idle life and long-route renewals. Inference is NOT invoked
// every six seconds; Meta visual perception and social initiative retain their
// existing billing/cooldown paths. This module executes real checked routes.
import {lifeCanStart,lifeCandidates,lifeResult,LIFE_TICK_MS} from './robot-life-core.js';
import {emitBrainTrace,rememberRobotObservationFrame} from './robot-brains.js';
import {captureRobotView,interruptRobotMission} from './robots.js';
import {canMeetRobot} from './robot-social-navigation.js';
export function initRobotLife({editor,api,room,canRun,workOrderActive=()=>false,postDiscussion}){
 const state=new Map();let cursor=0,busy=false;
 const current=bot=>state.get(bot.userData.editorId)||{step:0,history:[],nextAt:0,active:null,contacts:new Map()};
 const trace=(bot,event,text)=>emitBrainTrace(bot.userData.editorId,bot.name,'LIFE · '+event,text);
 function clear(){state.clear();cursor=0;}
 async function completed(bot,life,status){
  if(life.active?.taskId!==status.taskId)return;
  const mission=life.active;life.active=null;
  const result=lifeResult(status.status,mission.start,bot.position);
  life.history.push({targetId:mission.candidate.targetId,point:mission.candidate.point,status:result.status});
  life.history=life.history.slice(-60);
  const character=bot.userData.robotBrain?.character;const preference=character?characterPolicy(character):null;
  life.nextAt=Date.now()+Math.round((result.moved?6000:22000)*(preference?.decisionDelayFactor||1));
  const detail=`${result.status} · ${result.metres}m actual displacement · ${mission.candidate.targetName}`;
  trace(bot,result.moved?'TRAVELLED':'ROUTE RESULT',detail);
  // Owner-reported movement is expressly labelled as such; the server does
  // not mistake a client event for independent camera evidence.
  try{await api.req('/api/robots/life/record',{method:'POST',body:JSON.stringify({
   room:mission.room,robot_id:bot.userData.editorId,task_id:mission.taskId,
   target_id:mission.candidate.targetId,status:result.status,metres:result.metres})});}
  catch(error){trace(bot,'MEMORY UNAVAILABLE',error.message);}
  if(!result.moved||result.status!=='arrived'||!canRun()||room()!==mission.room||!lifeCanStart(bot))return;
  // Optional local JPEG, NOT a Meta interpretation. Meta perception runs on
  // its separate bounded 2-minute schedule.
  if(life.step%3===0){try{
   const frame=await captureRobotView(editor.world,bot,{yawOffset:0});
   if(frame?.size)rememberRobotObservationFrame(bot.userData.editorId,frame,'Life arrival · raw head-camera frame (not model-analysed)');
  }catch{ /* camera failure never blocks exploration */ }}
  const peer=editor.items.find(o=>o.userData.editorId===mission.candidate.targetId&&o.userData.editorKind==='robot');
  const workReceipt=bot.userData.robotLastVerifiedWork;
  const nearPeer=peer&&canMeetRobot({x:bot.position.x,y:bot.position.y,z:bot.position.z},
    {x:peer.position.x,y:peer.position.y,z:peer.position.z},
    editor.navigationObstacles(bot).filter(o=>o.kind!=='robot'));
  // Random exploration and a generic "what have you discovered?" should not
  // create endless AI conversations. Contact requires a real project receipt.
  if(nearPeer&&workReceipt?.status==='completed'&&workReceipt?.detail&&Date.now()-Number(workReceipt.at||0)<600000&&
     bot.userData.robotBrain?.initiative&&peer!==bot&&editor.canEdit(bot)&&
     Date.now()-(life.contacts.get(peer.userData.editorId)||0)>5400000){
   life.contacts.set(peer.userData.editorId,Date.now());
   try{await postDiscussion(bot,peer,`I completed a verified project step: ${String(workReceipt.detail).slice(0,160)}. Please check whether your assigned construction task needs this result.`);
     trace(bot,'PEER CONTACT',`Shared an actual project receipt with ${peer.name}; not a proximity-only greeting.`);
   }catch(error){trace(bot,'CONTACT UNAVAILABLE',error.message);}
  }
 }
 const handler=e=>{
  const event=e.detail||{},bot=editor.items.find(o=>o.userData.editorId===event.robotId);
  const life=bot&&state.get(event.robotId);
  if(life?.active?.taskId===event.taskId&&['arrived','partial','blocked','failed','stopped'].includes(event.status))void completed(bot,life,event);
 };
 window.addEventListener('solvi:robot-task-update',handler);
 // Major physical bends are a chance to collect new evidence. This is a
 // bounded raw-head-camera sweep at the ACTUAL detour point, not a paid model
 // interpretation, fabricated sighting, or permission to change the scene.
 const checkpointHandler=e=>{
  const event=e.detail||{},bot=editor.items.find(o=>o.userData.editorId===event.robotId);
  const life=bot&&state.get(event.robotId);
  if(!bot||!life?.active||event.taskId!==life.active.taskId||!canRun()||room()!==life.active.room)return;
  const mission=life.active;
  if((mission.scans||0)>=2||!editor.canEdit(bot))return;
  mission.scans=(mission.scans||0)+1;
  trace(bot,'BARRIER CHECKPOINT',`Reached verified detour at (${bot.position.x.toFixed(1)}, ${bot.position.z.toFixed(1)}); ${event.remainingMeters}m remain to the SAME target. Local head-camera sweep, then continue navigation.`);
  void (async()=>{
   let forward=null;
   for(const yaw of [-55,0,55]){
    if(!canRun()||room()!==mission.room||bot.userData.robotMission?.taskId!==mission.taskId)break;
    try{const frame=await captureRobotView(editor.world,bot,{yawOffset:yaw*Math.PI/180,pitchDegrees:-12});
     if(frame?.size){rememberRobotObservationFrame(event.robotId,frame,
       `Barrier checkpoint · raw JPEG · relative head yaw ${yaw}° · not Meta-analysed`);
      if(yaw===0)forward=frame;}
    }catch(error){trace(bot,'ROUTE SCAN UNAVAILABLE',error.message);break;}
   }
   // Reuse the server's existing 120-second perception reservation, per-user
   // cooldown and daily budget. A checkpoint is prioritised, not an uncapped
   // new Meta call. Model text NEVER directly drives navigation or scene edits.
   if(!forward||bot.userData.robotBrain?.initiativeVision===false||!canRun()||room()!==mission.room||
       bot.userData.robotMission?.taskId!==mission.taskId)return;
   try{
    const permit=await api.req('/api/robots/perception/start',{method:'POST',body:JSON.stringify({room:mission.room,robot_id:event.robotId})});
    if(!permit.ready)return;
    if(!canRun()||room()!==mission.room||bot.userData.robotMission?.taskId!==mission.taskId)return;
    const form=new FormData();form.append('room',mission.room);form.append('robot_id',event.robotId);
    form.append('token',permit.token);form.append('life_task_id',mission.taskId);
    form.append('life_target_id',mission.candidate.targetId||'');
    form.append('frame',forward,'fence-checkpoint.jpg');
    const observation=await api.req('/api/robots/perception/complete',{method:'POST',body:form});
    if(observation.observed){bot.userData.lastCameraObservation={text:observation.observation,at:observation.observed_at};
     trace(bot,'META BARRIER OBSERVATION',`${observation.observation} · model usage ~US$${Number(observation.usage?.estimated_usd||0).toFixed(6)} · navigation remains geometry-checked`);
     if(observation.inference)trace(bot,'PERCEPTION MODEL I/O (text + frame reference)',observation.inference);
    }
   }catch(error){trace(bot,'META ROUTE SCAN UNAVAILABLE',error.message);}
  })();
 };
 window.addEventListener('solvi:robot-route-checkpoint',checkpointHandler);
 async function tick(){
  if(busy||!canRun()||editor.world?.renderer?.xr?.isPresenting)return;
  const robots=editor.items.filter(o=>lifeCanStart(o,{controlled:editor.controlledRobot?.()===o,workOrder:workOrderActive(o.userData.editorId)})&&editor.canEdit(o));
  if(!robots.length)return;
  const bot=robots[cursor++%robots.length],id=bot.userData.editorId;
  const life=current(bot);state.set(id,life);
  if(life.active||Date.now()<life.nextAt)return;
  busy=true;const roomId=room();
  try{
   const grant=await api.req('/api/robots/life/lease',{method:'POST',body:JSON.stringify({room:roomId,robot_id:id})});
   if(!grant.granted){life.nextAt=Date.now()+Math.max(6000,Number(grant.retry_after_seconds||12)*1000);return;}
   if(!canRun()||room()!==roomId||!editor.items.includes(bot)||!editor.canEdit(bot)||
      !lifeCanStart(bot,{controlled:editor.controlledRobot?.()===bot,workOrder:workOrderActive(id)}))return;
   const candidates=lifeCandidates(bot,editor.items,life.history,life.step++);
   for(const candidate of candidates.slice(0,5)){
    if(!canRun()||room()!==roomId||!lifeCanStart(bot,{workOrder:workOrderActive(id)}))break;
    // The scene's real collision-aware route planner is mandatory. Never set
    // avatar position or teleport on failed paths.
    const taskId='life-'+grant.token;
    bot.userData.robotMission={kind:'life',taskId,targetName:candidate.targetName};
    const start={x:bot.position.x,z:bot.position.z};
    if(editor.routeRobot(bot,candidate.point)){
     life.active={taskId,candidate,start,room:roomId,started:Date.now(),renewAt:Date.now()+10000,renewing:false};
     life.nextAt=Date.now()+22000;
     trace(bot,'DECIDED',`Exploring ${candidate.targetName}; ${Math.hypot(candidate.point.x-start.x,candidate.point.z-start.z).toFixed(1)}m route requested, not yet completed.`);
     return;
    }
    // Existing routeRobot emits a blocked event synchronously. No active
    // mission is set until successful route planning.
    bot.userData.robotMission=null;
    life.history.push({targetId:candidate.targetId,point:candidate.point,status:'blocked'});
   }
   life.history=life.history.slice(-60);life.nextAt=Date.now()+Math.round(22000*(bot.userData.robotBrain?.character?characterPolicy(bot.userData.robotBrain.character).decisionDelayFactor:1));
   trace(bot,'BLOCKED','No reachable novel destination from the current surroundings; retrying after a pause.');
  }catch(error){life.nextAt=Date.now()+30000;trace(bot,'UNAVAILABLE',error.message);}
  finally{busy=false;}
 }
 // A stale local route is only forgotten if the actual mission has ended;
 // otherwise a long trip must never be overwritten by an idle life cycle.
 async function renew(bot,life,mission){
  mission.renewing=true;
  try{
   const response=await api.req('/api/robots/life/lease',{method:'POST',body:JSON.stringify({
    room:mission.room,robot_id:bot.userData.editorId,renew:true,task_id:mission.taskId})});
   if(response.granted!==true)throw Error(response.reason||'Life route lease was not renewed');
   if(life.active===mission)mission.renewAt=Date.now()+10000;
  }catch(error){
   if(life.active!==mission)return;
   // A lost/denied lease is not permission for another client to keep walking.
   // Never interrupt a later human mission in this asynchronous callback.
   if(bot.userData.robotMission?.taskId===mission.taskId)interruptRobotMission(bot);
   life.active=null;life.nextAt=Date.now()+30000;
   trace(bot,'LEASE EXPIRED',`${error.message}; stopped autonomous travel without claiming arrival.`);
  }finally{mission.renewing=false;}
 }
 const recover=()=>{for(const [id,life] of state){if(!life.active)continue;
  const bot=editor.items.find(o=>o.userData.editorId===id);
  if(!bot||bot.userData.robotMission?.taskId!==life.active.taskId){life.active=null;life.nextAt=Date.now()+30000;continue;}
  if(canRun()&&room()===life.active.room&&Date.now()>life.active.renewAt&&!life.active.renewing)
   void renew(bot,life,life.active);
 }};
 const timer=setInterval(()=>{recover();void tick();},LIFE_TICK_MS);
 window.addEventListener('solvi:room-changed',clear);
 window.addEventListener('solvi:session-lost',clear);
 window.addEventListener('pagehide',()=>{clearInterval(timer);clear();window.removeEventListener('solvi:robot-task-update',handler);window.removeEventListener('solvi:robot-route-checkpoint',checkpointHandler);});
 return {tick,clear};
}
