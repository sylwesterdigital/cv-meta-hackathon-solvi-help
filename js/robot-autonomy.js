// v0.2.192: server-durable work orders with browser-controlled scene execution. Never simulates keyboard events:
// the same checked editor/physics tools used by human keys are invoked directly.
import * as THREE from 'three';
import {captureRobotView,interruptRobotMission,robotAction} from './robots.js';
import {takeSeat,standUp} from './robot-seating.js';
import {emitBrainTrace,rememberRobotObservationFrame,runRobotVisualSearch} from './robot-brains.js';
import {cleanAutonomyOrder,cleanAutonomyDecision,autonomyProximity,autonomyResult,AUTONOMY_FURNITURE} from './robot-autonomy-core.js';
import {confirmAction} from './app-dialogs.js';
import {houseBlueprint,houseGoal,operatorFailure,publicPresetIndex,ROBOT_TOOL_DESCRIPTIONS} from './robot-construction-api.js';
import {metaRetryDelay,workRecoveryPlan,projectOutcome} from './robot-autonomy-policy.js';
import {visibleWorkFields,workModeHelp} from './robot-workorder-ui.js';
const $=id=>document.getElementById(id);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const MAX_TRAVEL=90;
export function initRobotAutonomy({editor,api,room,toast,postDiscussion}){
 const panel=$('robotRoutinePanel');if(!panel||!$('autonomyRobot'))return null;
 const runs=new Map(),created=new Map();
 let restoreSequence=0;const savedOrders=new Map();
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
 const workMode=$('autonomyMode'),workHelp=$('autonomyModeHelp');
 function updateWorkFields(){
  const mode=workMode.value,show=visibleWorkFields(mode,false);
  for(const label of panel.querySelectorAll('[data-autonomy-field]'))label.hidden=!show.has(label.dataset.autonomyField);
  if(workHelp)workHelp.textContent=workModeHelp(mode);
  $('autonomyStart').hidden=mode!=='agent';
  $('autonomyVision').disabled=mode!=='agent';
  // The simple build tools execute once. Repetition and model billing are only
  // relevant to the agent, not the single direct action picker.
 }
 workMode.addEventListener('change',updateWorkFields);
 updateWorkFields();
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

 // Persist only bounded, serializable state; actual scene objects are looked
 // up by ID again after reload. No camera data or API credentials are saved.
 function stateOf(run){
  const house=run.house?{wallId:run.house.wall?.userData.editorId||'',floorId:run.house.floor?.userData.editorId||'',
   center:run.house.center,spec:run.house.spec,missing:run.house.missing,placed:run.house.placed,
   bedsPlaced:run.house.bedsPlaced,travelChecked:run.house.travelChecked,
   inspectionFailed:run.house.inspectionFailed||''}:null;
  return {house,step:run.step,completed:run.completed,last:run.last,metaFailures:run.metaFailures,
   nextMetaAt:run.nextMetaAt,recoveryAttempts:run.recoveryAttempts,invitations:run.invitations,contacted:run.contacted,
   placedSupplies:run.placedSupplies,researchNotes:run.researchNotes,pendingAction:run.pendingAction};
 }
 function restoreHouse(state){
  if(!state||typeof state!=='object')return null;
  const wall=editor.items.find(o=>o.userData.editorId===state.wallId&&o.userData.editorKind==='wall'&&editor.canEdit(o));
  const floor=editor.items.find(o=>o.userData.editorId===state.floorId&&editor.canEdit(o));
  if(!wall)return null;
  return {wall,floor,center:state.center||{x:wall.position.x,z:wall.position.z},spec:houseBlueprint(state.spec||{}),
   missing:Array.isArray(state.missing)?state.missing.filter(v=>AUTONOMY_FURNITURE.includes(v)).slice(0,12):[],
   placed:Array.isArray(state.placed)?state.placed.slice(0,25):[],bedsPlaced:Number(state.bedsPlaced)||0,
   travelChecked:state.travelChecked===true,inspectionFailed:String(state.inspectionFailed||'').slice(0,240)};
 }
 async function saveOrder(run,enabled=run.loop){
  const state=stateOf(run);
  return api.req('/api/robots/autonomy/order',{method:'PUT',body:JSON.stringify({room:run.room,robot_id:run.id,order:run.order,state,enabled})});
 }
 function newRun(order,loop,bot,state={}){
  const run={id:order.robotId,name:bot.name,room:order.room,order,loop,token:'autonomy-'+crypto.randomUUID(),
   step:Number(state.step)||0,completed:Number(state.completed)||0,last:state.last||null,busy:false,
   cancelled:false,timer:null,metaFailures:Number(state.metaFailures)||0,
   nextMetaAt:Number(state.nextMetaAt)||0,recoveryAttempts:state.recoveryAttempts||{},
   researchNotes:String(state.researchNotes||'').slice(0,900),pendingAction:'task',house:restoreHouse(state.house),
   invitations:Array.isArray(state.invitations)?state.invitations.slice(0,20):[],
   contacted:Array.isArray(state.contacted)?state.contacted.slice(0,20):[],placedSupplies:Number(state.placedSupplies)||0};
  return run;
 }
 function presentSaved(order){
  $('autonomyMode').value=order.mode;updateWorkFields();
  $('autonomyGoal').value=order.goal;
  $('autonomyInterval').value=String(order.interval);
  $('autonomyVision').checked=order.vision;
  $('autonomyAllowChanges').checked=order.allowChanges;
  for(const [field,value] of [['autonomyVariant',order.variant],['autonomySource',order.sourceId],
   ['autonomyDestination',order.destinationId],['autonomyPreset',order.presetId]]){
   const element=$(field);if(element&&[...element.options].some(o=>o.value===value))element.value=value;
  }
 }
 async function loadSaved(){
  const sequence=++restoreSequence;
  if(!api.online||!api.auth())return;
  try{
   const response=await api.req('/api/robots/autonomy/orders?room='+encodeURIComponent(room()));
   if(sequence!==restoreSequence)return;
   savedOrders.clear();
   for(const item of response.orders||[]){
    savedOrders.set(item.robot_id,item);
    if(!item.enabled||runs.has(item.robot_id))continue;
    const bot=robotFor(item.robot_id);
    if(!bot||!editor.canEdit(bot))continue;
    const order=cleanAutonomyOrder(item.order);
    order.presetId=item.order.presetId||'';
    if(order.room!==room()||order.robotId!==item.robot_id)continue;
    const run=newRun(order,true,bot,item.state);
    runs.set(run.id,run);run.timer=setInterval(()=>cycle(run),order.interval*1000);
    trace(bot,'RESTORED','Server work order resumed with its saved goal, failure budget and scene-object IDs; browser execution only');
    void cycle(run);
   }
   const chosen=savedOrders.get($('autonomyRobot').value);
   if(chosen&&!runs.has(chosen.robot_id))presentSaved(chosen.order);
   update();
  }catch(error){emitLog(null,'MISSION RESTORE FAILED',error.message);}
 }
 const robotFor=id=>editor.items.find(o=>o.userData.editorKind==='robot'&&o.userData.editorId===id);
 const objectFor=id=>editor.items.find(o=>o.userData.editorId===id);
 const colleague=run=>editor.items.find(o=>o.userData.editorKind==='robot'&&o.userData.editorId!==run.id&&o.visible);
 const robotHouseSpan=wall=>{
  const vertices=wall.userData.wall?.points;
  if(!Array.isArray(vertices)||vertices.length<3)return {width:0,depth:0};
  const xs=vertices.map(v=>Number(v?.[0])),zs=vertices.map(v=>Number(v?.[1]));
  if(!xs.every(Number.isFinite)||!zs.every(Number.isFinite))return {width:0,depth:0};
  return {width:Math.max(...xs)-Math.min(...xs),depth:Math.max(...zs)-Math.min(...zs)};
 };
 const existingRobotHouse=run=>{
  const hospital=/\b(hospital|clinic)\b/i.test(run.order.goal);
  const candidates=editor.items.filter(o=>o.userData.editorKind==='wall'&&editor.canEdit(o)&&
   ((o.userData.autonomyCreatedBy===run.id&&o.name?.includes('small house'))||o.name===run.name+' · small house'));
  // A former 5×4 house is NOT an acceptable 8×8 hospital. Reuse only a
  // compatible footprint, rather than repeatedly claiming an old shed meets
  // a new construction order.
  const suitable=candidates.filter(o=>{const span=robotHouseSpan(o);
   return !hospital||(span.width>=5.8&&span.depth>=5.8);});
  return suitable[0]||null;
 };
 // Name checks are a non-destructive continuation hint after a scene reload;
 // they never grant edit rights or prove who physically built the object.
 function recovery(run,bot,source='Meta unavailable'){
  const peer=colleague(run);
  const hasSeat=editor.items.some(o=>o.userData.editorKind==='furniture'&&['chair','officeChair','bed','sofa','stool'].includes(o.userData.furniture?.variant)&&Math.hypot(o.position.x-bot.position.x,o.position.z-bot.position.z)<10);
  const invitations=(run.order.goal.match(/@[\p{L}\p{N}_-]+/gu)||[]).map(n=>n.slice(1));
  const remaining=editor.items.filter(o=>o.userData.editorKind==='robot'&&o.userData.editorId!==run.id&&invitations.some(name=>name.toLowerCase()===o.name.toLowerCase())&&!run.invitations.includes(o.userData.editorId));
  const requiresContact=/\b(find|meet|locate|visit|talk to|tell|approach)\b/i.test(run.order.goal);
  const contacts=requiresContact?editor.items.filter(o=>o.userData.editorKind==='robot'&&o.userData.editorId!==run.id&&invitations.some(name=>name.toLowerCase()===o.name.toLowerCase())&&!run.contacted.includes(o.userData.editorId)):[];
  const plan=workRecoveryPlan({goal:run.order.goal,allowChanges:run.order.allowChanges,house:run.house,
    existingHouse:!!existingRobotHouse(run),peerId:peer?.userData.editorId||'',attempts:run.recoveryAttempts,hasSeat,
    invitationTargets:remaining.map(o=>({id:o.userData.editorId,name:o.name})),
    contactTargets:contacts.map(o=>({id:o.userData.editorId,name:o.name})),placedSupplies:run.placedSupplies});
  const chosen={...plan,recovery:true};
  if(chosen.action==='build_house')chosen.house=houseBlueprint(/\b(hospital|clinic)\b/i.test(run.order.goal)?{width:8,depth:8}:{})
  trace(bot,'RECOVERY CHOICE',`${source} · ${plan.action} · ${plan.reason}`);
  return chosen;
 }
 function report(run,bot,plan,status,detail){
  const payload={room:run.room,robot_id:run.id,action:plan?.action==='site_check'?'visit':plan?.action||'task',status,detail:String(detail).slice(0,440)};
  if(payload.action==='idle')payload.status='blocked';
  // Reporting is best-effort and never changes the result of the physical tool.
  void api.req('/api/robots/autonomy/report',{method:'POST',body:JSON.stringify(payload)}).catch(e=>emitLog(bot,'WORK RECEIPT UNAVAILABLE',e.message));
 }
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
 function stop(id,reason='stopped',disable=true){
  const run=runs.get(id);if(!run)return;
  run.cancelled=true;clearInterval(run.timer);runs.delete(id);created.delete(id);
  if(disable)void saveOrder(run,false).catch(error=>emitLog(null,'STOP NOT SAVED',error.message));
  const bot=robotFor(id);
  if(bot?.userData.robotMission?.taskId?.startsWith(run.token))interruptRobotMission(bot);
  if(bot)trace(bot,'STOP',reason);update();
 }
 function stopAll(disable=false){for(const id of [...runs.keys()])stop(id,'room, session or page closed',disable);}
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
 async function walkToWorksite(run,bot,plan,label){
  requireActive(run,bot);
  const position=plan?.staging;
  if(!position)throw Error('No reachable work position found; nearby scene geometry may block the site');
  if(bot.userData.robotSeated)standUp(bot,editor);
  const taskId=run.token+':'+(++run.step);
  let finish;const result=new Promise(resolve=>{finish=resolve;});
  const handler=e=>{if(e.detail?.robotId===run.id&&e.detail?.taskId===taskId)finish(e.detail.status);};
  window.addEventListener('solvi:robot-task-update',handler);
  try{
   trace(bot,'SITE FOUND',`${label} at X ${plan.site.x.toFixed(1)}, Z ${plan.site.z.toFixed(1)}; ${plan.meters} m walking route`);
   if(!editor.routeRobotToWorksite?.(bot,position,taskId,label))throw Error('Construction site is no longer reachable by A*');
   const deadline=Date.now()+Math.min(150000,Math.max(20000,plan.meters/1.1*2000+18000));
   let status;
   while(status===undefined&&Date.now()<deadline){requireActive(run,bot);
    status=await Promise.race([result.then(v=>({done:v})),wait(400).then(()=>({}))]).then(v=>v.done);
   }
   if(status!=='arrived')throw Error(status?'Site approach '+status:'Site approach timed out');
   if(Math.hypot(bot.position.x-position.x,bot.position.z-position.z)>.55)throw Error('Robot did not physically reach the planned worksite');
   trace(bot,'WORKSITE REACHED',`${label}; actual robot position verified, construction can start`);
   // Authored pickup gesture marks a short visible manual construction phase.
   robotAction(bot,'pickUp');await wait(1150);requireActive(run,bot);
   robotAction(bot,'idle');requireActive(run,bot);
   return plan.site;
  }finally{window.removeEventListener('solvi:robot-task-update',handler);}
 }
 async function construct(run,bot,variant){
  if(!run.order.allowChanges)throw Error('Scene creation must be enabled in the work order');
  requireActive(run,bot);
  const inside=run.house&&['bottle','can'].includes(variant);
  const plan=inside?null:editor.planRobotBuildSite?.(bot,'furniture',{variant});
  const at=inside?{x:run.house.center.x+(run.placedSupplies%2?0.9:-0.9),z:run.house.center.z+(run.placedSupplies<2?0.8:-0.8)}:
   await walkToWorksite(run,bot,plan,variant+' worksite');
  requireActive(run,bot);
  const item=editor.createRobotFurniture?.(bot,variant,{at});
  if(!item)throw Error('No clear build location or this furniture type is unsupported');
  const set=created.get(run.id)||new Set();set.add(item.userData.editorId);created.set(run.id,set);
  if(['bottle','can'].includes(variant))run.placedSupplies++;
  trace(bot,'BUILD',`Constructed ${item.name} at a clear position; scene persisted using the human Add tool`);
  return item;
 }
 async function constructHouse(run,bot,input={}){
  if(!run.order.allowChanges)throw Error('House construction requires Allow scene changes');
  requireActive(run,bot);
  // A new agent session must not reproduce a prior house with the same robot.
  // This is an audit/continuation, not a claim that it is furnished or inspected.
  if(!run.house&&run.order.mode==='agent'&&existingRobotHouse(run)){
   const wall=existingRobotHouse(run);
   const floors=editor.items.filter(o=>o.userData.editorKind==='cube'&&editor.canEdit(o)&&
     (o.userData.autonomyCreatedBy===run.id&&o.userData.autonomyFloor||o.name===run.name+' · house floor'));
   const floor=floors.sort((a,b)=>Math.hypot(a.position.x-wall.position.x,a.position.z-wall.position.z)-Math.hypot(b.position.x-wall.position.x,b.position.z-wall.position.z))[0];
   const existing=editor.items.filter(o=>o.userData.editorKind==='furniture'&&editor.canEdit(o)&&
     (o.userData.autonomyCreatedBy===run.id||o.name?.startsWith(run.name+' · '))&&
     (floor?Math.hypot(o.position.x-floor.position.x,o.position.z-floor.position.z)<10:true));
   const spec=houseBlueprint(input);
   const hospital=/\b(hospital|clinic)\b/i.test(run.order.goal);
   const foundBeds=existing.filter(o=>o.userData.furniture?.variant==='bed').length;
   const missing=[...Array(Math.max(0,(hospital?3:1)-foundBeds)).fill('bed')];
   if(!existing.some(o=>o.userData.furniture?.variant==='table'))missing.push('table');
   if(!existing.some(o=>o.userData.furniture?.variant==='chair'))missing.push('chair');
   run.house={wall,floor,center:{x:floor?.position.x??wall.position.x+spec.width/2,z:floor?.position.z??wall.position.z+spec.depth/2},spec,
    missing,placed:existing.map(o=>o.name),bedsPlaced:foundBeds,
    travelChecked:false,inspectionFailed:'Existing building not yet checked from this robot session'};
   trace(bot,'PROJECT REUSED','Found a prior robot-built house; no duplicate shell created. Inspect it before declaring the new goal fulfilled.');
   // Continue into the same cycle: inspect and furnish the existing house.
   // Previously this returned immediately, stranding Run once at PARTIAL.

  }
  const spec=houseBlueprint(input);
  if(!run.house){
   const plan=editor.planRobotBuildSite?.(bot,'house',spec);
   const at=await walkToWorksite(run,bot,plan,'house construction site');
   const project=editor.createRobotHouse?.(bot,{...spec,at});
   if(!project)throw Error('House footprint became occupied after arrival; no building created');
   const hospital=/\b(hospital|clinic)\b/i.test(run.order.goal);
   run.house={...project,missing:spec.furnish?(hospital?['bed','bed','bed','table','chair']:['bed','table','chair']):[],placed:[],bedsPlaced:0};
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
   const position=variant==='bed'&&/\b(hospital|clinic)\b/i.test(run.order.goal)?
    {x:project.center.x-project.spec.width*.28,z:project.center.z+project.spec.depth*(.26-.28*project.bedsPlaced)}:positions[variant];
   const furniture=editor.createRobotFurniture?.(bot,variant,{at:position});
   if(!furniture){trace(bot,'FURNISH UNFINISHED',`${variant} could not fit; scene kept, no fictional completion`);continue;}
   const owned=created.get(run.id)||new Set();owned.add(furniture.userData.editorId);created.set(run.id,owned);
   project.missing.splice(project.missing.indexOf(variant),1);project.placed.push(furniture.name);
   if(variant==='bed')project.bedsPlaced++;
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
  let frames=[];
  try{frames=await scan(run,bot,run.order.goal||'Inspect and decide a useful next action');}
  catch(error){
   requireActive(run,bot);
   trace(bot,'CAMERA RECOVERY',`360° capture unavailable: ${error.message}; retrying planning without camera images, with no visual claims`);
  }
  requireActive(run,bot);
  const form=new FormData();form.append('room',run.room);form.append('robot_id',run.id);
  form.append('objective',run.order.goal||'Support other robots and maintain the room; rest when nothing requires attention.');
  form.append('last_result',run.last?JSON.stringify(run.last).slice(0,350):'');
  form.append('research_notes',run.researchNotes||'');
  form.append('allow_changes',String(run.order.allowChanges));
  for(const {yaw,blob} of frames)form.append('views',blob,`eye-${yaw}.jpg`);
  trace(bot,'META PLANNING',`${frames.length} real camera frames → Meta Muse Spark; proposing ONE validated action, not performing it`);
  let answer;
  try{answer=await api.req('/api/robots/autonomy/plan',{method:'POST',body:form});}
  catch(error){
   run.metaFailure=error.message;run.metaFailures++;
   run.nextMetaAt=Date.now()+metaRetryDelay(run.metaFailures);
   trace(bot,'META FAILED',`${error.message} · retry after ${Math.ceil((run.nextMetaAt-Date.now())/60000)} minute(s); local safe tools remain available`);
   return recovery(run,bot,'Meta planning failure');
  }
  requireActive(run,bot);
  if(answer.vision_fallback)trace(bot,'VISION LIMIT',Number(answer.views)===1?'Six-frame request failed; planning used ONE genuine camera frame only':'Meta rejected image requests; text-only retry succeeded, so no visual perception is claimed');
  if(answer.validated===false){
   run.metaFailure=answer.decision?.reason||'Invalid model JSON';trace(bot,'MODEL OUTPUT REJECTED',answer.decision?.reason||'Unsupported planning output');
   run.metaFailures++;
   run.nextMetaAt=Date.now()+metaRetryDelay(run.metaFailures);
   return recovery(run,bot,'Invalid Meta tool call');
  }
  if(answer.decision?.action==='use_preset')await refreshPresets();
  const decision=cleanAutonomyDecision(answer.decision,editor.items.map(o=>({id:o.userData.editorId,kind:o.userData.editorKind})),run.id,publicPresetIndex(presets));
  if(!decision)throw Error('Model response had no valid scene-grounded action');
  trace(bot,'META PROPOSAL',`${decision.action}: ${decision.reason||'(no reason)'} · Meta usage ~US$${Number(answer.usage?.estimated_usd||0).toFixed(6)}`);
  run.metaFailures=0;run.nextMetaAt=0;
  if(decision.action==='idle'&&run.loop)return recovery(run,bot,'Model suggested waiting without resolving the work order');
  return decision;
 }
 async function execute(run,bot,plan){
  const obj=objectFor(plan.target_id),dest=objectFor(plan.destination_id);
  if(plan.action==='site_check'){
   if(!run.house?.wall||!editor.items.includes(run.house.wall))throw Error('House to inspect is no longer available');
   await moveTo(run,bot,run.house.wall);
   run.house.inspectionFailed=null;
   trace(bot,'SITE CHECK','Arrived at existing structure; no duplicate house created');
   return 'Rechecked existing house from the exterior';
  }
  if(plan.action==='research'){
   const result=await api.req('/api/robots/autonomy/research',{method:'POST',body:JSON.stringify({room:run.room,robot_id:run.id,topic:run.order.goal})});
   requireActive(run,bot);
   const notes=(result.sources||[]).slice(0,2).map(source=>`${source.title}: ${source.summary||''}`).join(' | ');
   run.researchNotes=notes.slice(0,900);
   trace(bot,'RESEARCH',notes?`Checked relevant public background: ${(result.sources||[]).map(x=>x.title+' ('+x.url+')').join(' · ')}. Source summaries are not physical build instructions.`:result.finding||'No relevant public source');
   return notes?'Read relevant public background; construction still requires verified scene tools':'No useful external reference was available; continuing with local scene tools';
  }
  if(plan.action==='idle')return 'No safe untried step remains; work order blocked pending new tools, instructions or the next Meta retry';
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
   // Speaking is proof of contact, not proof that the other robot accepted a
   // work order or performed any construction.
   if(/\b(find|meet|locate|visit|talk to|tell|approach)\b/i.test(run.order.goal)&&!run.contacted.includes(obj.userData.editorId))run.contacted.push(obj.userData.editorId);
   if(/\b(invite|opening party|celebrat)\b/i.test(run.order.goal)&&!run.invitations.includes(obj.userData.editorId))run.invitations.push(obj.userData.editorId);
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
   if(run.order.mode==='agent'){
    if(run.nextMetaAt&&Date.now()<run.nextMetaAt){
     trace(bot,'META BACKOFF',`Avoiding repeated failed requests until ${new Date(run.nextMetaAt).toLocaleTimeString()}`);
     plan=recovery(run,bot,'Waiting for Meta retry window');
    }else plan=await decision(run,bot);
   }
   else if(run.order.mode==='deliver')plan={action:'deliver',target_id:run.order.sourceId,destination_id:run.order.destinationId};
   else if(run.order.mode==='build')plan={action:'build',variant:run.order.variant};
   else if(run.order.mode==='house'){
    const sizes=run.order.goal.match(/(\d+(?:\.\d+)?)\s*(?:×|x|by)\s*(\d+(?:\.\d+)?)/i);
    plan={action:'build_house',house:houseBlueprint(sizes?{width:Number(sizes[1]),depth:Number(sizes[2])}:/\b(hospital|clinic)\b/i.test(run.order.goal)?{width:8,depth:8}:{})};
   }else if(run.order.mode==='preset')plan={action:'use_preset',preset_id:run.order.presetId};
   else if(run.order.mode==='rest')plan={action:'rest',target_id:run.order.destinationId};
   else plan={action:'ask',target_id:run.order.destinationId,message:run.order.goal};
   requireActive(run,bot);
   run.pendingAction=plan.action;
   if(plan.recovery)run.recoveryAttempts[plan.action]=(run.recoveryAttempts[plan.action]||0)+1;
   const detail=await execute(run,bot,plan);
   const invitedNames=(run.order.goal.match(/@[\p{L}\p{N}_-]+/gu)||[]).map(v=>v.slice(1).toLowerCase());
   const wanted=editor.items.filter(o=>o.userData.editorKind==='robot'&&invitedNames.includes(o.name.toLowerCase())).map(o=>o.userData.editorId);
   const contactNeeded=/\b(find|meet|locate|visit|talk to|tell|approach)\b/i.test(run.order.goal)?wanted:[];
   const invitationNeeded=/\b(invite|opening party|celebrat)\b/i.test(run.order.goal)?wanted:[];
   const evidence=projectOutcome({house:run.house,goal:run.order.goal,invitations:run.invitations,
    invitationsRequired:invitationNeeded,contacts:run.contacted,contactsRequired:contactNeeded,
    placedSupplies:run.placedSupplies,suppliesRequired:/\b(bottles?|cans?|drinks?|refreshments?)\b/i.test(run.order.goal)?4:0});
   if(plan.action!=='idle')run.completed++;
   run.last=autonomyResult(plan.action,plan.action!=='idle',detail);
   if(plan.action==='idle')run.last.status='blocked';
   else if(run.house&&!evidence.done)run.last.status='partial';
   if(plan.action==='site_check'&&run.house&&!evidence.done)run.last.status='partial';
   if(plan.action==='build_house'&&(run.house?.missing?.length||run.house?.inspectionFailed))run.last.status='partial';
   // A verified tool action is not the same as completing a complex goal.
   if(run.order.mode==='agent'&&houseGoal(run.order.goal)&&(!run.house||!evidence.done)&&run.last.status==='completed')run.last.status='partial';
   const remaining=evidence.blockers.join('; ');
   trace(bot,run.last.status==='completed'&&run.order.mode==='agent'?'STEP VERIFIED':run.last.status==='completed'?'COMPLETED':run.last.status.toUpperCase(),detail+(run.house&&remaining?' · Remaining: '+remaining:''));
   report(run,bot,plan,run.last.status,detail+(run.house&&remaining?' · Remaining: '+remaining:''));
   $('autonomyFailure').textContent=(run.metaFailure?'Meta planning unavailable: '+run.metaFailure+'\nVerified local action: ':'Work order: ')+detail+(run.house&&remaining?'\nUNFINISHED: '+remaining:'')+(!run.house&&run.order.mode==='agent'&&houseGoal(run.order.goal)?'\nUNFINISHED: no confirmed house yet':'');
   if(run.last.status==='blocked'&&run.loop)trace(bot,'AWAITING NEW CAPABILITY','No safe untried tool. Will check for new model availability at the scheduled time; not a completed task.');
   run.metaFailure=null;
  }catch(error){
   const diagnosis=operatorFailure(error);run.last={...autonomyResult('task',false,error.message),diagnosis};
   $('autonomyFailure').textContent=`FAILED · ${diagnosis.code}\n${diagnosis.reason}\nNEXT: ${diagnosis.remedy}`;
   trace(bot,'UNFINISHED',diagnosis.reason+' · Next: '+diagnosis.remedy+' · No unverified completion is claimed');
   if(run.recoveryAttempts[run.pendingAction])run.recoveryAttempts[run.pendingAction]=Math.max(1,run.recoveryAttempts[run.pendingAction]);
   report(run,bot,{action:run.pendingAction||'task'},'failed',diagnosis.reason);
  }finally{
   run.busy=false;update();
   if(!run.cancelled){
    try{await saveOrder(run,run.loop);}catch(error){trace(bot,'STATE NOT SAVED',error.message);}
   }
   if(!run.loop||run.order.mode!=='agent')stop(run.id,run.last?.status||'finished one cycle');
  }
 }
 const start=async(loop)=>{
  if(!api.online||!api.auth()){toast('Sign in to run autonomous tasks');return;}
  if(loop&&$('autonomyMode').value!=='agent'){toast('Use Run once for direct tools. Start loop is reserved for the Meta agent.');return;}
  const mode=$('autonomyMode').value,fields=visibleWorkFields(mode,loop);
  const order=cleanAutonomyOrder({robotId:$('autonomyRobot').value,mode,
   sourceId:fields.has('source')?$('autonomySource').value:'',
   destinationId:fields.has('destination')?$('autonomyDestination').value:'',
   goal:fields.has('goal')?$('autonomyGoal').value:'',
   variant:fields.has('variant')?$('autonomyVariant').value:'chair',
   interval:$('autonomyInterval').value,
   allowChanges:fields.has('allow')&&$('autonomyAllowChanges').checked,
   vision:fields.has('vision')&&$('autonomyVision').checked,room:room()});
  order.presetId=fields.has('preset')?$('autonomyPreset').value:'';
  const bot=robotFor(order.robotId);
  if(!bot||!editor.canEdit(bot)){toast('Choose an editable robot');return;}
  if(order.mode==='deliver'&&(!objectFor(order.sourceId)||!objectFor(order.destinationId))){toast('Choose object and delivery destination');return;}
  if(order.mode==='assist'&&objectFor(order.destinationId)?.userData.editorKind!=='robot'){toast('Choose a colleague robot as destination');return;}
  if(['build','house','preset'].includes(order.mode)&&!order.allowChanges){toast('Enable authorised scene changes for construction');return;}
  if(order.mode==='preset'&&!order.presetId){toast('Choose an account-owned saved preset');return;}
  if(order.mode==='agent'&&!order.goal){toast('Describe a goal for the autonomous agent');return;}
  const billable=order.mode==='agent'||order.mode==='assist';
  if(billable&&!await confirmAction(`This ${loop?'loop':'task'} will send billable Meta API requests${order.vision?' with six real head-camera images per decision':''}. ${loop?'Each decision repeats no more frequently than every '+order.interval+' seconds; this opted-in loop is saved on the server and resumes after browser refresh when the signed-in visible 3D scene loads. It does not run while the browser is closed.':'Only one cycle runs and will not auto-resume.'} Scene changes are ${order.allowChanges?'enabled for robot-built objects':'disabled'}.`,{title:'Enable autonomous robot operator?',confirmLabel:'Enable autonomy'}))return;
  if(!billable&&!await confirmAction(`The robot will ${order.mode} using scene tools${loop?' every '+order.interval+' seconds':''}. Creation is ${order.allowChanges?'enabled':'disabled'}.`,{title:'Start robot work order?',confirmLabel:'Start'}))return;
  stop(order.robotId,'replaced work order',false);
  const run=newRun(order,loop,bot);
  try{await saveOrder(run,loop);}catch(error){toast('Cannot save robot work order: '+error.message);return;}
  savedOrders.set(run.id,{robot_id:run.id,order,state:stateOf(run),enabled:loop});
  runs.set(run.id,run);$('autonomyFailure').textContent='Working · awaiting verified scene tool results.';if(loop)run.timer=setInterval(()=>cycle(run),order.interval*1000);
  trace(bot,'START',`${loop?'Loop':'Once'} · mode ${order.mode} · goal ${order.goal} · 360 vision ${order.vision} · scene changes ${order.allowChanges} · cadence ${order.interval}s`);
  void cycle(run);update();
 };
 $('autonomyOnce').onclick=()=>void start(false);
 $('autonomyStart').onclick=()=>void start(true);
 $('autonomyStop').onclick=()=>stop($('autonomyRobot').value,'user stop');
 $('autonomyStopAll').onclick=()=>stopAll(true);
 $('autonomyRefresh').onclick=refresh;
 $('routineToolButton').addEventListener('click',refresh);
 $('autonomyRobot').addEventListener('change',()=>{const saved=savedOrders.get($('autonomyRobot').value);if(saved)presentSaved(saved.order);});
 window.addEventListener('solvi:autonomy-ready',()=>void loadSaved());
 window.addEventListener('solvi:room-changed',()=>{restoreSequence++;stopAll(false);});
 window.addEventListener('solvi:session-lost',()=>{restoreSequence++;stopAll(false);});
 window.addEventListener('pagehide',()=>{restoreSequence++;stopAll(false);});
 refresh();return {stopAll,refresh,loadSaved,isActive:id=>runs.has(id)};
}
