// v0.2.209: owner-authorised, browser-only idle life. Inference is NOT invoked
// every six seconds; Meta visual perception and social initiative retain their
// existing billing/cooldown paths. This module executes real checked routes.
import {lifeCanStart,lifeCandidates,lifeResult,LIFE_TICK_MS} from './robot-life-core.js';
import {emitBrainTrace,rememberRobotObservationFrame} from './robot-brains.js';
import {captureRobotView} from './robots.js';
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
  life.history=life.history.slice(-20);
  life.nextAt=Date.now()+(result.moved?6000:22000);
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
  if(peer&&bot.userData.robotBrain?.initiative&&peer!==bot&&editor.canEdit(bot)&&
     Math.hypot(peer.position.x-bot.position.x,peer.position.z-bot.position.z)<=4&&
     Date.now()-(life.contacts.get(peer.userData.editorId)||0)>600000){
   life.contacts.set(peer.userData.editorId,Date.now());
   try{await postDiscussion(bot,peer,`I explored near ${peer.name}. What have you actually discovered or tried here? Suggest one safe experiment we can verify.`);
     trace(bot,'PEER CONTACT',`Asked ${peer.name} about a concrete observation or experiment; no work was assigned without permission.`);
   }catch(error){trace(bot,'CONTACT UNAVAILABLE',error.message);}
  }
 }
 const handler=e=>{
  const event=e.detail||{},bot=editor.items.find(o=>o.userData.editorId===event.robotId);
  const life=bot&&state.get(event.robotId);
  if(life?.active?.taskId===event.taskId&&['arrived','partial','blocked','failed','stopped'].includes(event.status))void completed(bot,life,event);
 };
 window.addEventListener('solvi:robot-task-update',handler);
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
     life.active={taskId,candidate,start,room:roomId,started:Date.now()};
     life.nextAt=Date.now()+22000;
     trace(bot,'DECIDED',`Exploring ${candidate.targetName}; ${Math.hypot(candidate.point.x-start.x,candidate.point.z-start.z).toFixed(1)}m route requested, not yet completed.`);
     return;
    }
    // Existing routeRobot emits a blocked event synchronously. No active
    // mission is set until successful route planning.
    bot.userData.robotMission=null;
    life.history.push({targetId:candidate.targetId,point:candidate.point,status:'blocked'});
   }
   life.history=life.history.slice(-20);life.nextAt=Date.now()+22000;
   trace(bot,'BLOCKED','No reachable novel destination from the current surroundings; retrying after a pause.');
  }catch(error){life.nextAt=Date.now()+30000;trace(bot,'UNAVAILABLE',error.message);}
  finally{busy=false;}
 }
 // A stale local route is only forgotten if the actual mission has ended;
 // otherwise a long trip must never be overwritten by an idle life cycle.
 const recover=()=>{for(const [id,life] of state){if(!life.active)continue;
  const bot=editor.items.find(o=>o.userData.editorId===id);
  if(!bot||bot.userData.robotMission?.taskId!==life.active.taskId){life.active=null;life.nextAt=Date.now()+30000;}
 }};
 const timer=setInterval(()=>{recover();void tick();},LIFE_TICK_MS);
 window.addEventListener('solvi:room-changed',clear);
 window.addEventListener('solvi:session-lost',clear);
 window.addEventListener('pagehide',()=>{clearInterval(timer);clear();window.removeEventListener('solvi:robot-task-update',handler);});
 return {tick,clear};
}
