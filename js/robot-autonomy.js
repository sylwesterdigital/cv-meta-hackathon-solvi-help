// v0.2.183: opt-in, in-tab robot operator. Never simulates keyboard events:
// the same checked editor/physics tools used by human keys are invoked directly.
import * as THREE from 'three';
import {captureRobotView,interruptRobotMission} from './robots.js';
import {takeSeat,standUp} from './robot-seating.js';
import {emitBrainTrace,rememberRobotObservationFrame,runRobotVisualSearch} from './robot-brains.js';
import {cleanAutonomyOrder,cleanAutonomyDecision,autonomyProximity,autonomyResult,AUTONOMY_FURNITURE} from './robot-autonomy-core.js';
import {confirmAction} from './app-dialogs.js';
import {houseBlueprint,houseGoal,operatorFailure,publicPresetIndex,ROBOT_TOOL_DESCRIPTIONS} from './robot-construction-api.js';
const $=id=>document.getElementById(id);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const MAX_TRAVEL=90;
export function initRobotAutonomy({editor,api,room,toast,postDiscussion}){
 const panel=$('robotRoutinePanel');if(!panel||!$('autonomyRobot'))return null;
 const runs=new Map(),created=new Map();
 let presets=[];const log=[];
 const emitLog=(robot,step,detail)=>{
  log.push(`[${new Date().toLocaleTimeString()}] ${robot?.name||'Robot'} · ${step}: ${String(detail).slice(0,3500)}`);
  if(log.length>300)log.shift();
  $('autonomyLog').textContent=log.join('\n\n')||'No work-order events in this browser.';
 };
 const trace=(robot,step,detail)=>{
  emitLog(robot,step,detail);return emitBrainTrace(robot.userData.editorId,robot.name,'AUTONOMY · '+step,detail);
 };
 const selectRoutinePage=name=>{
  for(const page of panel.querySelectorAll('[data-routine-page]'))page.hidden=page.dataset.routinePage!==name;
  for(const tab of panel.querySelectorAll('[data-routine-tab]'))tab.setAttribute('aria-selected',String(tab.dataset.routineTab===name));
 };
 panel.querySelectorAll('[data-routine-tab]').forEach(tab=>tab.addEventListener('click',()=>selectRoutinePage(tab.dataset.routineTab)));
 $('autonomyCopyLog').onclick=async()=>{
  const content=log.join('\n\n')||'No work-order events in this browser.';
  try{await navigator.clipboard.writeText(content);toast('Robot routine log copied');}
  catch(error){toast('Clipboard access failed: '+error.message);}
 };
 $('autonomyClearLog').onclick=()=>{log.length=0;$('autonomyLog').textContent='No work-order events in this browser.';};
 $('autonomyApiGuide').textContent='SOLVI robot tool API v1 · local scene mutations only after permission checks\n\n'+
  Object.entries(ROBOT_TOOL_DESCRIPTIONS).map(([name,description])=>name+' — '+description).join('\n\n')+
  '\n\nA plan contains exactly one validated action and real scene/preset IDs. House blueprints are bounded; model responses are never executable code. A model outage is not a successful task.';
 selectRoutinePage('work');
 async function refreshPresets(){
  if(!api.online||!api.auth()){presets=[];return [];}
  try{
   const answer=await api.req('/api/object-presets');
   presets=(answer.presets||[]).filter(p=>['wall','furniture'].includes(p.kind));
   const select=$('autonomyPreset'),previous=select.value;
   select.replaceChildren(new Option('Choose a saved architecture/furniture preset',''),
    ...presets.map(p=>new Option(p.name+' · '+p.kind,p.id)));
   if(presets.some(p=>p.id===previous))select.value=previous;
  }catch(error){presets=[];emitLog(null,'PRESETS FAILED',error.message);}
  return presets;
 }

 const robotFor=id=>editor.items.find(o=>o.userData.editorKind==='robot'&&o.userData.editorId===id);
 const objectFor=id=>editor.items.find(o=>o.userData.editorId===id);
 const usable=run=>!run.cancelled&&run.room===room()&&api.online&&api.auth()&&document.visibilityState==='visible'&&!editor.world.renderer.xr.isPresenting;
 function update(){
  const entries=[...runs.values()].map(r=>`${r.name}: ${r.order.mode} · ${r.busy?'working':r.last?.status||'ready'} · ${r.completed} cycle(s)`);
  $('autonomyStatus').textContent=entries.join(' | ')||'No autonomous work orders running.';
 }
 function refresh(){
  const robotSelect=$('autonomyRobot'),from=$('autonomySource'),to=$('autonomyDestination');
  const previous=[robotSelect.value,from.value,to.value];
  const bots=editor.items.filter(o=>o.userData.editorKind==='robot'&&editor.canEdit(o));
  const all=editor.items.filter(o=>o.visible&&!o.userData.temporaryCarryTest);
  robotSelect.replaceChildren(...bots.map(o=>new Option(o.name,o.userData.editorId)));
  from.replaceChildren(new Option('Select scene object',''),...all.map(o=>new Option(`${o.name} · ${o.userData.editorKind}`,o.userData.editorId)));
  to.replaceChildren(new Option('Select destination or colleague',''),...all.map(o=>new Option(`${o.name} · ${o.userData.editorKind}`,o.userData.editorId)));
  [robotSelect,from,to].forEach((select,i)=>{if(previous[i]&&[...select.options].some(o=>o.value===previous[i]))select.value=previous[i];});
  void refreshPresets();update();
 }
 function stop(id,reason='stopped'){
  const run=runs.get(id);if(!run)return;
  run.cancelled=true;clearInterval(run.timer);runs.delete(id);created.delete(id);
  const bot=robotFor(id);
  if(bot?.userData.robotMission?.taskId?.startsWith(run.token))interruptRobotMission(bot);
  if(bot)trace(bot,'STOP',reason);update();
 }
 function stopAll(){for(const id of [...runs.keys()])stop(id,'room, session or page closed');}
 function requireActive(run,bot){if(!usable(run)||!bot||!editor.items.includes(bot)||!editor.canEdit(bot))throw Error('Robot permissions, session or room changed');}
 async function moveTo(run,bot,target){
  requireActive(run,bot);if(!target||target===bot||!editor.items.includes(target))throw Error('Destination no longer exists');
  if(Math.hypot(bot.position.x-target.position.x,bot.position.z-target.position.z)>MAX_TRAVEL)throw Error(`Destination exceeds autonomous ${MAX_TRAVEL} m work-order limit`);
  if(bot.userData.robotSeated)standUp(bot,editor);
  const taskId=run.token+':'+(++run.step);let complete;
  const done=new Promise(resolve=>{complete=resolve;});
  const handler=e=>{if(e.detail?.robotId===run.id&&e.detail?.taskId===taskId)complete(e.detail.status);};
  window.addEventListener('solvi:robot-task-update',handler);
  try{
   trace(bot,'NAVIGATE',`Collision-checked route to ${target.name}; mission ${taskId}`);
   const accepted=editor.receiveRobotCommand({room:run.room,id:taskId,robot_id:run.id,kind:'go_to',target_id:target.userData.editorId,target_name:target.name});
   if(!accepted)throw Error(`No safe route to ${target.name}`);
   // Movement completion is an observed robot-task-update, not a model assertion.
   const deadline=Date.now()+Math.min(165000,Math.max(20000,Math.hypot(bot.position.x-target.position.x,bot.position.z-target.position.z)/1.1*2000+18000));
   let status;
   while(status===undefined&&Date.now()<deadline){
    requireActive(run,bot);
    status=await Promise.race([done.then(v=>({done:v})),wait(500).then(()=>({}))]).then(v=>v.done);
   }
   if(status!=='arrived')throw Error(status?`Route finished: ${status}`:'Route timed out');
   trace(bot,'ARRIVED',target.name);return true;
  }finally{window.removeEventListener('solvi:robot-task-update',handler);}
 }
 async function deliver(run,bot,target,destination){
  if(!target||!destination||target===destination||target===bot||destination===bot)throw Error('Choose distinct source object and destination');
  if(!target.userData.pickable||!editor.canEdit(target))throw Error(`${target.name} is not permitted and Pickable`);
  if(!editor.physics.enabled)throw Error('Enable room Physics before using the existing I-key pickup tool');
  if(bot.userData.robotCarry)throw Error('Robot already holds an object');
  await moveTo(run,bot,target);requireActive(run,bot);
  if(!autonomyProximity(bot,target,2.6))throw Error('Object not within verified pickup reach');
  // The same I-key mechanic requires the object in front of the avatar.
  const dx=target.position.x-bot.position.x,dz=target.position.z-bot.position.z;
  bot.rotation.y=Math.atan2(dx,dz);editor.queueSave(bot);
  if(!editor.carry.pickup(bot,false,target.userData.editorId))throw Error('Physical pickup rejected by existing carrying tool');
  trace(bot,'PICKUP',`Lifting ${target.name} with existing animation and collision rules`);
  const started=Date.now();
  while(bot.userData.robotCarry?.stage==='pickup'&&Date.now()-started<8000){requireActive(run,bot);await wait(125);}
  if(bot.userData.robotCarry?.objectId!==target.userData.editorId)throw Error('Object is no longer held');
  try{
   await moveTo(run,bot,destination);requireActive(run,bot);
   if(!editor.carry.drop(bot))throw Error('Existing I-key drop action failed');
   trace(bot,'DELIVERY',`${target.name} dropped beside ${destination.name}; saved by the normal scene tool`);
   return `Delivered ${target.name} to ${destination.name}`;
  }catch(error){
   // Never silently abandon cargo; leave it in the hand for manual recovery.
   trace(bot,'CARRY NEEDS HELP','Still holding '+target.name+': '+error.message);throw error;
  }
 }
 async function construct(run,bot,variant){
  if(!run.order.allowChanges)throw Error('Scene creation must be enabled in the work order');
  requireActive(run,bot);
  const item=editor.createRobotFurniture?.(bot,variant);
  if(!item)throw Error('No clear build location or this furniture type is unsupported');
  const set=created.get(run.id)||new Set();set.add(item.userData.editorId);created.set(run.id,set);
  trace(bot,'BUILD',`Constructed ${item.name} at a clear position; scene persisted using the human Add tool`);
  return item;
 }
 async function constructHouse(run,bot,input={}){
  if(!run.order.allowChanges)throw Error('House construction requires Allow scene changes');
  requireActive(run,bot);
  const spec=houseBlueprint(input);
  if(!run.house){
   const project=editor.createRobotHouse?.(bot,spec);
   if(!project)throw Error('No clear site for a house; move the robot to an open area and retry');
   run.house={...project,missing:spec.furnish?['bed','table','chair']:[],placed:[]};
   const owned=created.get(run.id)||new Set();
   owned.add(project.wall.userData.editorId);owned.add(project.floor.userData.editorId);created.set(run.id,owned);
   trace(bot,'CONSTRUCT HOUSE',`Created ${spec.width}×${spec.depth}m room shell, doorway, windows, roof and independent floor · verified scene IDs ${project.wall.userData.editorId}, ${project.floor.userData.editorId}`);
  }
  const project=run.house;
  if(!project.travelChecked){
   project.travelChecked=true;
   try{await moveTo(run,bot,project.wall);trace(bot,'WORK SITE REACHED','Robot physically navigated using A* and locomotion animations to inspect house exterior');}
   catch(error){project.inspectionFailed=error.message;trace(bot,'SITE VISIT UNFINISHED','House shell persisted but robot could not approach: '+error.message);}
  }
  const positions={bed:{x:project.center.x-project.spec.width*.24,z:project.center.z+project.spec.depth*.17},
   table:{x:project.center.x+project.spec.width*.23,z:project.center.z+project.spec.depth*.17},
   chair:{x:project.center.x+project.spec.width*.23,z:project.center.z-project.spec.depth*.17}};
  for(const variant of [...project.missing]){
   requireActive(run,bot);
   const furniture=editor.createRobotFurniture?.(bot,variant,{at:positions[variant]});
   if(!furniture){trace(bot,'FURNISH UNFINISHED',`${variant} could not fit; scene kept, no fictional completion`);continue;}
   const owned=created.get(run.id)||new Set();owned.add(furniture.userData.editorId);created.set(run.id,owned);
   project.missing=project.missing.filter(v=>v!==variant);project.placed.push(furniture.name);
   trace(bot,'FURNISH',`${variant} added inside the house · ${furniture.userData.editorId}`);
  }
  const count=project.placed.length;
  const status=project.missing.length||project.inspectionFailed?`PARTIAL: ${project.missing.length?'missing '+project.missing.join(', '):''}${project.inspectionFailed?'; site visit: '+project.inspectionFailed:''}`:'complete';
  return `House shell and floor built (${project.spec.width}×${project.spec.depth}m); ${count} furnishings placed; ${status}`;
 }
 async function usePreset(run,bot,presetId){
  if(!run.order.allowChanges)throw Error('Enable scene changes to place a saved preset');
  requireActive(run,bot);
  // Re-check account-scoped availability immediately before mutation.
  const available=await refreshPresets();requireActive(run,bot);
  const preset=available.find(p=>p.id===presetId);
  if(!preset)throw Error('Saved preset no longer exists or is not accessible to this profile');
  const item=editor.createRobotPreset?.(bot,preset);
  if(!item)throw Error('Preset geometry is unsafe, unsupported, or no collision-free placement is available');
  const owned=created.get(run.id)||new Set();owned.add(item.userData.editorId);created.set(run.id,owned);
  trace(bot,'PRESET',`Account preset ${preset.name} (${preset.kind}) placed as ${item.userData.editorId}`);
  return `Placed account preset ${preset.name}`;
 }
 async function remove(run,bot,target){
  const owned=created.get(run.id);
  if(!run.order.allowChanges||!owned?.has(target?.userData.editorId))throw Error('Robot may delete only items created by its current autonomous work session');
  requireActive(run,bot);
  if(!editor.removeRobotCreatedObject?.(bot,target))throw Error('Robot object removal was refused');
  owned.delete(target.userData.editorId);
  trace(bot,'REMOVE',`${target.name} removed; existing undo and scene persistence updated`);
  return `Removed robot-built ${target.name}`;
 }
 async function rest(run,bot,seat=null){
  requireActive(run,bot);
  seat=seat||editor.items.find(o=>o.userData.editorKind==='furniture'&&['chair','officeChair','stool','bed','armchair','sofa','sunbed','deckChair'].includes(o.userData.furniture?.variant)&&Math.hypot(o.position.x-bot.position.x,o.position.z-bot.position.z)<10);
  if(!seat&&run.order.allowChanges)seat=await construct(run,bot,'chair');
  if(!seat)throw Error('No available chair or bed, and building new furniture was not authorised');
  await moveTo(run,bot,seat);requireActive(run,bot);
  if(!takeSeat(bot,seat,editor))throw Error('Seat was occupied or had no valid sitting surface');
  trace(bot,'REST',`Sitting on ${seat.name}; animation/pose uses existing J-key seating tool`);
  const until=Date.now()+18000;
  while(Date.now()<until){requireActive(run,bot);await wait(600);}
  standUp(bot,editor);trace(bot,'REST COMPLETED',`Stood after resting on ${seat.name}`);
  return `Rested on ${seat.name}`;
 }
 async function scan(run,bot,question){
  if(!run.order.vision)return [];
  if(bot.userData.robotBrain?.initiativeVision===false)throw Error('Robot camera autonomy disabled in Brains');
  requireActive(run,bot);
  trace(bot,'360 CAMERA',`Capturing six genuine 512×512 head-eye JPEGs · ${question.slice(0,100)}`);
  const frames=[];
  for(let i=0;i<6;i++){
   requireActive(run,bot);
   const yaw=i*60;
   const blob=await captureRobotView(editor.world,bot,{yawOffset:yaw*Math.PI/180,pitchDegrees:-12});
   if(!blob?.size)throw Error('Head-camera render failed at '+yaw+'°');
   frames.push({yaw,blob});
   rememberRobotObservationFrame(run.id,blob,`Autonomous 360° camera · yaw ${yaw}° · source image ${i+1}/6`);
  }
  return frames;
 }
 async function decision(run,bot){
  const frames=await scan(run,bot,run.order.goal||'Inspect and decide a useful next action');
  requireActive(run,bot);
  const form=new FormData();form.append('room',run.room);form.append('robot_id',run.id);
  form.append('objective',run.order.goal||'Support other robots and maintain the room; rest when nothing requires attention.');
  form.append('last_result',run.last?JSON.stringify(run.last).slice(0,350):'');
  form.append('allow_changes',String(run.order.allowChanges));
  for(const {yaw,blob} of frames)form.append('views',blob,`eye-${yaw}.jpg`);
  trace(bot,'META PLANNING',`${frames.length} real camera frames → Meta Muse Spark; proposing ONE validated action, not performing it`);
  let answer;
  try{answer=await api.req('/api/robots/autonomy/plan',{method:'POST',body:form});}
  catch(error){
   run.metaFailure=error.message;trace(bot,'META FAILED',error.message);
   // This fallback is permitted only for an explicit house-building instruction
   // and authorised scene changes. All physical results remain verifiable.
   if(houseGoal(run.order.goal)&&run.order.allowChanges&&run.house&&!run.house.missing.length){
    trace(bot,'PROJECT CHECK','House previously built; no need to create a duplicate while Meta is unavailable');
    return {action:'idle',reason:'House already constructed; Meta unavailable to suggest another task'};
   }
   if(houseGoal(run.order.goal)&&run.order.allowChanges){
    trace(bot,'LOCAL RECOVERY','Meta failed; using the bounded, documented build_house tool, not inventing an LLM decision');
    return {action:'build_house',house:houseBlueprint(),reason:'Explicit house goal; deterministic fallback after Meta failure'};
   }
   throw error;
  }
  requireActive(run,bot);
  if(answer.vision_fallback)trace(bot,'VISION LIMIT','Meta rejected six-frame input; text-only retry succeeded, so no image perception is claimed');
  if(answer.validated===false){
   run.metaFailure=answer.decision?.reason||'Invalid model JSON';trace(bot,'MODEL OUTPUT REJECTED',answer.decision?.reason||'Unsupported planning output');
   if(houseGoal(run.order.goal)&&run.order.allowChanges&&run.house&&!run.house.missing.length)return {action:'idle',reason:'Project already built; no verified new task'};
   if(houseGoal(run.order.goal)&&run.order.allowChanges)return {action:'build_house',house:houseBlueprint(),reason:'Verified local house plan after invalid model JSON'};
   throw Error('Meta returned no valid action. Check the model response format and permitted robot tools.');
  }
  if(answer.decision?.action==='use_preset')await refreshPresets();
  const decision=cleanAutonomyDecision(answer.decision,editor.items.map(o=>({id:o.userData.editorId,kind:o.userData.editorKind})),run.id,publicPresetIndex(presets));
  if(!decision)throw Error('Model response had no valid scene-grounded action');
  trace(bot,'META PROPOSAL',`${decision.action}: ${decision.reason||'(no reason)'} · Meta usage ~US$${Number(answer.usage?.estimated_usd||0).toFixed(6)}`);
  return decision;
 }
 async function execute(run,bot,plan){
  const obj=objectFor(plan.target_id),dest=objectFor(plan.destination_id);
  if(plan.action==='idle')return 'No task available; safely idle';
  if(plan.action==='visit'){await moveTo(run,bot,obj);return `Visited ${obj.name}`;}
  if(plan.action==='deliver')return deliver(run,bot,obj,dest);
  if(plan.action==='build'){const built=await construct(run,bot,plan.variant);return 'Built '+built.name;}
  if(plan.action==='build_house')return constructHouse(run,bot,plan.house);
  if(plan.action==='use_preset')return usePreset(run,bot,plan.preset_id);
  if(plan.action==='remove')return remove(run,bot,obj);
  if(plan.action==='rest')return rest(run,bot,obj);
  if(plan.action==='inspect'){
   if(obj){await moveTo(run,bot,obj);}
   const found=await runRobotVisualSearch(editor.world,editor,bot,{target_phrase:(obj?.name||plan.message||'chair').replace(/[^\p{L}\p{N} _-]/gu,' ').trim().slice(0,100)||'chair'},api,()=>!usable(run));
   if(found.status!=='found')throw Error('SAM visual search: '+found.status);
   return 'SAM visual match: '+found.target.name;
  }
  if(plan.action==='ask'){
   if(!obj||obj.userData.editorKind!=='robot')throw Error('Only another robot can answer');
   await moveTo(run,bot,obj);
   await postDiscussion(bot,obj,plan.message||`Do you need any help with ${run.order.goal||'your task'}? Ask a question and suggest the next practical action.`);
   trace(bot,'COLLEAGUE',`Question to ${obj.name} delivered via the existing robot discussion/response channel`);
   return `Asked ${obj.name} about their needs`;
  }
  throw Error('Unsupported action');
 }
 async function cycle(run){
  if(run.busy||!usable(run))return;
  const bot=robotFor(run.id);if(!bot||!editor.canEdit(bot)){stop(run.id,'robot permission unavailable');return;}
  run.busy=true;update();
  try{
   let plan;
   if(run.order.mode==='agent')plan=await decision(run,bot);
   else if(run.order.mode==='deliver')plan={action:'deliver',target_id:run.order.sourceId,destination_id:run.order.destinationId};
   else if(run.order.mode==='build')plan={action:'build',variant:run.order.variant};
   else if(run.order.mode==='house'){
    const sizes=run.order.goal.match(/(\d+(?:\.\d+)?)\s*(?:×|x|by)\s*(\d+(?:\.\d+)?)/i);
    plan={action:'build_house',house:houseBlueprint(sizes?{width:Number(sizes[1]),depth:Number(sizes[2])}:{})};
   }else if(run.order.mode==='preset')plan={action:'use_preset',preset_id:run.order.presetId};
   else if(run.order.mode==='rest')plan={action:'rest',target_id:run.order.destinationId};
   else plan={action:'ask',target_id:run.order.destinationId,message:run.order.goal};
   requireActive(run,bot);
   const detail=await execute(run,bot,plan);
   run.completed++;run.last=autonomyResult(plan.action,true,detail);
   if(plan.action==='build_house'&&(run.house?.missing?.length||run.house?.inspectionFailed))run.last.status='partial';
   trace(bot,run.last.status==='partial'?'PARTIAL':'COMPLETED',detail);
   $('autonomyFailure').textContent=(run.metaFailure?'Meta planning unavailable: '+run.metaFailure+'\nVerified local action: ':'Task verified: ')+detail;
   run.metaFailure=null;
  }catch(error){
   const diagnosis=operatorFailure(error);run.last={...autonomyResult('task',false,error.message),diagnosis};
   $('autonomyFailure').textContent=`FAILED · ${diagnosis.code}\n${diagnosis.reason}\nNEXT: ${diagnosis.remedy}`;
   trace(bot,'UNFINISHED',diagnosis.reason+' · Next: '+diagnosis.remedy+' · No unverified completion is claimed');
  }finally{
   run.busy=false;update();
   if(!run.loop)stop(run.id,run.last?.status||'finished one cycle');
  }
 }
 const start=async(loop)=>{
  if(!api.online||!api.auth()){toast('Sign in to run autonomous tasks');return;}
  const order=cleanAutonomyOrder({robotId:$('autonomyRobot').value,mode:$('autonomyMode').value,sourceId:$('autonomySource').value,
   destinationId:$('autonomyDestination').value,goal:$('autonomyGoal').value,variant:$('autonomyVariant').value,
   interval:$('autonomyInterval').value,allowChanges:$('autonomyAllowChanges').checked,vision:$('autonomyVision').checked,room:room()});
  order.presetId=$('autonomyPreset').value;
  const bot=robotFor(order.robotId);
  if(!bot||!editor.canEdit(bot)){toast('Choose an editable robot');return;}
  if(order.mode==='deliver'&&(!objectFor(order.sourceId)||!objectFor(order.destinationId))){toast('Choose object and delivery destination');return;}
  if(order.mode==='assist'&&objectFor(order.destinationId)?.userData.editorKind!=='robot'){toast('Choose a colleague robot as destination');return;}
  if(['build','house','preset'].includes(order.mode)&&!order.allowChanges){toast('Enable authorised scene changes for construction');return;}
  if(order.mode==='preset'&&!order.presetId){toast('Choose an account-owned saved preset');return;}
  if(order.mode==='agent'&&!order.goal){toast('Describe a goal for the autonomous agent');return;}
  const billable=order.mode==='agent'||order.mode==='assist';
  if(billable&&!await confirmAction(`This ${loop?'loop':'task'} will send billable Meta API requests${order.vision?' with six real head-camera images per decision':''}. ${loop?'Each decision repeats no more frequently than every '+order.interval+' seconds.':'Only one cycle runs.'} Scene changes are ${order.allowChanges?'enabled for robot-built objects':'disabled'}.`,{title:'Enable autonomous robot operator?',confirmLabel:'Enable autonomy'}))return;
  if(!billable&&!await confirmAction(`The robot will ${order.mode} using scene tools${loop?' every '+order.interval+' seconds':''}. Creation is ${order.allowChanges?'enabled':'disabled'}.`,{title:'Start robot work order?',confirmLabel:'Start'}))return;
  stop(order.robotId,'replaced work order');
  const run={id:order.robotId,name:bot.name,room:order.room,order,loop,token:'autonomy-'+crypto.randomUUID(),step:0,completed:0,last:null,busy:false,cancelled:false,timer:null};
  runs.set(run.id,run);$('autonomyFailure').textContent='Working · awaiting verified scene tool results.';if(loop)run.timer=setInterval(()=>cycle(run),order.interval*1000);
  trace(bot,'START',`${loop?'Loop':'Once'} · mode ${order.mode} · goal ${order.goal} · 360 vision ${order.vision} · scene changes ${order.allowChanges} · cadence ${order.interval}s`);
  void cycle(run);update();
 };
 $('autonomyOnce').onclick=()=>void start(false);
 $('autonomyStart').onclick=()=>void start(true);
 $('autonomyStop').onclick=()=>stop($('autonomyRobot').value,'user stop');
 $('autonomyStopAll').onclick=stopAll;
 $('autonomyRefresh').onclick=refresh;
 $('routineToolButton').addEventListener('click',refresh);
 window.addEventListener('solvi:room-changed',stopAll);
 window.addEventListener('solvi:session-lost',stopAll);
 window.addEventListener('pagehide',stopAll);
 refresh();return {stopAll,refresh};
}
