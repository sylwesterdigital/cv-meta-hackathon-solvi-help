import {creativeCollectionTitle} from './scene-collections.js';
import {characterPolicy} from './robot-character-core.js';
import {sceneBoxCopies,liveCleanupObservation,chooseQueuedWorker,resolveQueuedBin} from './robot-task-queue.js';
import {groupBoxCleanupInstruction,groupBinClarification,selectCleanupTarget,nearestAvailableCleanupWorker,boxCleanupProjectGoal,sceneBinTargets} from './robot-group-cleanup.js';
import {namedRoomFurnishingInstruction,namedWorkContinuation,namedFurnishingPreference,recentHumanFurnishingAuthority,promisedRoomFurnishing,roomFurnishingSequence,nextRoomFurnishing} from './robot-room-furnishing.js';
// v0.2.192: server-durable work orders with browser-controlled scene execution. Never simulates keyboard events:
// the same checked editor/physics tools used by human keys are invoked directly.
import * as THREE from 'three';
import {captureRobotView,interruptRobotMission,robotAction} from './robots.js';
import {takeSeat,standUp} from './robot-seating.js';
import {emitBrainTrace,rememberRobotObservationFrame,runRobotVisualSearch} from './robot-brains.js';
import {cleanAutonomyOrder,cleanAutonomyDecision,autonomyProximity,autonomyResult,AUTONOMY_FURNITURE} from './robot-autonomy-core.js';
import {confirmAction} from './app-dialogs.js';
import {houseBlueprint,houseGoal,operatorFailure,publicPresetIndex,ROBOT_TOOL_DESCRIPTIONS} from './robot-construction-api.js';
import {metaRetryDelay,workRecoveryPlan,projectOutcome,localProjectSequence,requestedHomeCount,chatConstructionInstruction,chatNamedConstructionInstruction,namedRoofChoice,canCleanupGoal,chatCanCleanupInstruction,boxCleanupGoal,chatBoxCleanupInstruction} from './robot-autonomy-policy.js';
import {visibleWorkFields,workModeHelp} from './robot-workorder-ui.js';
import {cityTeamIntent,cityRoles,cityRoleGoal,cityRoleTarget,cityTeamState,cityMilestoneCount} from './robot-city-team.js';
import {chatSingleObjectTransfer} from './robot-object-intent.js';
import {creativeBuildIntent,groupCreativeIntent,namedCreativeIntent,creativeBlueprint,creativeRole,creativeProjectTag,nextCreativeIndex} from './robot-creative-builder.js';
import {validateRobotDesign,addressedCreativeRobot} from './robot-creative-design.js';
import {CREATIVE_SESSION_MAX_DESIGNS,creativeSessionDurationMs,creativeSessionDeadline,nextCreativeSlot,creativeSessionStatus} from './robot-creative-session.js';
import {cargoConstraints,groundedBoxMatch,safeThrowCandidate} from './robot-transfer-decisions.js';
import {predictThrowPath,cleanThrowSettings,pickUpClip} from './object-carry.js';
const $=id=>document.getElementById(id);
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const MAX_TRAVEL=90;
export function initRobotAutonomy({editor,api,room,toast,postDiscussion,postHumanQuestion=async()=>{}}){
 const panel=$('robotRoutinePanel');if(!panel||!$('autonomyRobot'))return null;
 const runs=new Map(),created=new Map();
 let metaPrefs={retry_seconds:30,max_retry_seconds:120,planner_cooldown_seconds:175};
 const modelStatus=$('autonomyModelStatus');
 async function checkMetaStatus(){
  if(!api.auth()){if(modelStatus)modelStatus.textContent='Sign in to check model availability';return;}
  try{const status=await api.req('/api/ai/key-status');
   if(modelStatus)modelStatus.textContent=(status.planning_ready?'CREDENTIAL PRESENT · ':'KEY MISSING · ')+status.detail;
   modelStatus?.classList.toggle('model-key-unavailable',!status.planning_ready);
   if(status.planning_ready)for(const run of runs.values())if(/key|configur/i.test(run.metaFailure||'')){
    run.nextMetaAt=0;run.metaFailure=null;run.metaFailures=0;
    trace(robotFor(run.id),'MODEL KEY RESTORED','Configured credential is now present; old missing-key retry timer cleared. Provider request still needs verification.');
    if(!run.busy)void cycle(run);
   }
   return status;
  }catch(error){if(modelStatus)modelStatus.textContent='Cannot verify Meta planning credentials: '+error.message;return null;}
 }
 async function loadMetaPrefs(){
  if(!api.auth())return;
  try{const response=await api.req('/api/robots/autonomy/preferences');metaPrefs=response.preferences||metaPrefs;
   for(const [id,key] of [['autonomyRetrySeconds','retry_seconds'],['autonomyMaxRetrySeconds','max_retry_seconds'],['autonomyPlannerCooldown','planner_cooldown_seconds']])$(id).value=String(metaPrefs[key]);
  }catch(error){if(modelStatus)modelStatus.textContent='Cannot load account planning preferences: '+error.message;}
  await checkMetaStatus();
 }
 $('autonomyCheckKey').onclick=()=>void checkMetaStatus();
 $('autonomySavePreferences').onclick=async()=>{
  const settings={retry_seconds:Number($('autonomyRetrySeconds').value),max_retry_seconds:Number($('autonomyMaxRetrySeconds').value),planner_cooldown_seconds:Number($('autonomyPlannerCooldown').value)};
  try{const result=await api.req('/api/robots/autonomy/preferences',{method:'PUT',body:JSON.stringify(settings)});
   metaPrefs=result.preferences;toast('Robot planning settings saved to your account');await checkMetaStatus();
  }catch(error){modelStatus.textContent='Settings not saved: '+error.message;}
 };
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
 $('autonomyApiGuide').textContent=[
  'SOLVI operator capabilities in THIS REALM (not historical commands)',
  'Identity: stable scene robot ID + user-visible name. Rename robots in Scene Editor.',
  'Creative: Muse proposes free-form assemblies as validated geometry DATA.',
  'Real primitive tools: '+(['cube','sphere','cylinder'].filter(k=>typeof editor.createRobotCreativePart==='function').join(', ')||'unavailable'),
  'Execution: current owner permissions, obstacle checks, checked A* navigation, object saves and receipts.',
  'Continuity: a saved human objective, plan and object IDs resume only in the exact room.',
  'No arbitrary generated JavaScript or new plugins are executed. Historical messages cannot authorize a different realm.'
 ].join('\n\n');
 selectRoutinePage('work');
 const workMode=$('autonomyMode'),workHelp=$('autonomyModeHelp');
 function updateWorkFields(){
  const mode=workMode.value,show=visibleWorkFields(mode,false);
  for(const label of panel.querySelectorAll('[data-autonomy-field]'))label.hidden=!show.has(label.dataset.autonomyField);
  if(workHelp)workHelp.textContent=workModeHelp(mode);
  $('autonomyStart').hidden=!['agent','local_project'].includes(mode);
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
   placedSupplies:run.placedSupplies,projectPlaced:run.projectPlaced,projectPending:run.projectPending,projectDeferred:run.projectDeferred,completedHouses:run.completedHouses,
   researchNotes:run.researchNotes,pendingAction:run.pendingAction,creativeSite:run.creativeSite,creativeBuilt:run.creativeBuilt,creativePending:run.creativePending,creativePlan:run.creativePlan,creativeSeriesIndex:run.creativeSeriesIndex,creativeDeadline:run.creativeDeadline,creativeNextAt:run.creativeNextAt,creativeHistory:run.creativeHistory,creativeRoamedIndex:run.creativeRoamedIndex,cleanupBinId:run.cleanupBinId,cleanupDone:run.cleanupDone,cleanupHomeId:run.cleanupHomeId,cleanupSkipped:run.cleanupSkipped,cleanupThrowTried:run.cleanupThrowTried,askedPreferences:run.askedPreferences,roofPreference:run.roofPreference,furnishingColors:run.furnishingColors,intentMessageId:run.intentMessageId,groupJobId:run.groupJobId,groupNoProgress:run.groupNoProgress,team:run.team,teamBuilt:run.teamBuilt};
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
   cancelled:false,timer:null,localTimer:null,localBurst:0,metaFailures:Number(state.metaFailures)||0,
   nextMetaAt:Number(state.nextMetaAt)||0,recoveryAttempts:state.recoveryAttempts||{},
   researchNotes:String(state.researchNotes||'').slice(0,900),pendingAction:'task',house:restoreHouse(state.house),
   invitations:Array.isArray(state.invitations)?state.invitations.slice(0,20):[],
   contacted:Array.isArray(state.contacted)?state.contacted.slice(0,20):[],placedSupplies:Number(state.placedSupplies)||0,
   projectPlaced:Array.isArray(state.projectPlaced)?state.projectPlaced.filter(p=>p&&typeof p.id==='string'&&typeof p.variant==='string').slice(0,6):[],
   projectDeferred:Array.isArray(state.projectDeferred)?state.projectDeferred.filter(p=>p&&typeof p.variant==='string'&&Number.isInteger(p.attempts)&&Number.isFinite(p.retryAt)&&typeof p.reason==='string').slice(0,6):[],
   projectPending:Array.isArray(state.projectPending)?state.projectPending.filter(p=>p&&typeof p.id==='string'&&typeof p.variant==='string').slice(0,6):[],
   completedHouses:Array.isArray(state.completedHouses)?state.completedHouses.filter(id=>typeof id==='string').slice(0,3):[],
   team:cityTeamState(state.team),teamBuilt:Array.isArray(state.teamBuilt)?state.teamBuilt.filter(x=>x&&['road','footpath'].includes(x.variant)&&typeof x.id==='string').slice(0,8):[],
   creativePlan:validateRobotDesign(state.creativePlan)?state.creativePlan:null,
   creativeSeriesIndex:Number.isInteger(state.creativeSeriesIndex)?Math.max(0,Math.min(CREATIVE_SESSION_MAX_DESIGNS-1,state.creativeSeriesIndex)):0,
   creativeDeadline:Number.isFinite(state.creativeDeadline)&&state.creativeDeadline>0?state.creativeDeadline:0,
   creativeNextAt:Number.isFinite(state.creativeNextAt)&&state.creativeNextAt>0?state.creativeNextAt:0,
   creativeHistory:Array.isArray(state.creativeHistory)?state.creativeHistory.filter(h=>h&&Number.isInteger(h.index)&&h.index>=0&&h.index<CREATIVE_SESSION_MAX_DESIGNS-1&&Array.isArray(h.ids)&&h.ids.length>=1&&h.ids.length<=12&&h.ids.every(id=>typeof id==='string'&&id.length<=100)).slice(0,CREATIVE_SESSION_MAX_DESIGNS-1):[],
   creativeRoamedIndex:Number.isInteger(state.creativeRoamedIndex)?Math.max(-1,Math.min(CREATIVE_SESSION_MAX_DESIGNS-1,state.creativeRoamedIndex)):-1,
   creativeSite:state.creativeSite&&Number.isFinite(state.creativeSite.x)&&Number.isFinite(state.creativeSite.z)?{x:state.creativeSite.x,z:state.creativeSite.z}:null,
   creativeBuilt:Array.isArray(state.creativeBuilt)?state.creativeBuilt.filter(p=>p&&typeof p.id==='string'&&Number.isInteger(p.index)&&p.index>=0&&p.index<16).slice(0,12):[],
   creativePending:state.creativePending&&typeof state.creativePending.id==='string'&&Number.isInteger(state.creativePending.index)?state.creativePending:null,
   cleanupBinId:String(state.cleanupBinId||'').slice(0,100),cleanupHomeId:String(state.cleanupHomeId||'').slice(0,100),cleanupDone:Array.isArray(state.cleanupDone)?state.cleanupDone.filter(id=>typeof id==='string').slice(0,48):[],
   cleanupSkipped:Array.isArray(state.cleanupSkipped)?state.cleanupSkipped.filter(v=>v&&typeof v.id==='string'&&typeof v.reason==='string'&&Number.isInteger(v.attempts)&&Number.isFinite(v.retryAt)).slice(0,32):[],
   cleanupThrowTried:Array.isArray(state.cleanupThrowTried)?state.cleanupThrowTried.filter(id=>typeof id==='string'&&id.length<101).slice(0,32):[],
   askedPreferences:state.askedPreferences===true,roofPreference:['flat','shed','pyramid'].includes(state.roofPreference)?state.roofPreference:'',
   furnishingColors:state.furnishingColors&&typeof state.furnishingColors==='object'?Object.fromEntries(Object.entries(state.furnishingColors).filter(([key,value])=>['bed','table','sofa','chair','stool','cabinet','lamp'].includes(key)&&/^#[a-f0-9]{6}$/i.test(value)).slice(0,7)):{},
   intentMessageId:typeof state.intentMessageId==='string'?state.intentMessageId.slice(0,100):'',
   groupJobId:typeof state.groupJobId==='string'?state.groupJobId.slice(0,100):'',groupNoProgress:Math.max(0,Math.min(15,Math.trunc(Number(state.groupNoProgress)||0)))};
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
   void dispatchPendingGroupTasks();
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
   ((o.userData.autonomyCreatedBy===run.id&&o.name?.includes('small house'))||o.name===run.name+' · small house')&&
   !run.completedHouses.includes(o.userData.editorId));
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
    contactTargets:contacts.map(o=>({id:o.userData.editorId,name:o.name})),placedSupplies:run.placedSupplies,
    projectPlaced:run.projectPlaced,projectPending:run.projectPending,projectDeferred:run.projectDeferred,completedHouses:run.completedHouses,
    retryBudget:bot.userData.robotBrain?.character?characterPolicy(bot.userData.robotBrain.character).retryBudget:8});
  if(run.order.sourceId&&run.order.destinationId&&run.order.mode==='local_project')return {action:'named_transfer',target_id:run.order.sourceId,destination_id:run.order.destinationId,recovery:true};
  const role=run.team?.role;
  if(['road','footpath'].includes(role)&&run.teamBuilt.length<cityRoleTarget(role)){
   const plan={action:'build_infrastructure',variant:role,reason:`City team ${role}: build real public infrastructure (${run.teamBuilt.length+1}/${cityRoleTarget(role)})`,recovery:true};
   trace(bot,'TEAM WORK',plan.reason);return plan;
  }
  // Broad saved furnishing goals can execute with local tools even when Meta
  // tool JSON is malformed. First enter an actual editable room via A*.
  if(plan.action==='furnish_room'&&run.order.allowChanges&&
      !editor.planRobotRoomFurnishing?.(bot,plan.variant)&&
      (run.recoveryAttempts.enter_room||0)<4){
   const room=editor.planRobotRoomEntry?.(bot);
   if(room){const entry={action:'enter_room',entry:room,recovery:true,
     reason:'Walk through a real doorway into '+room.roomName+' before furnishing'};
     trace(bot,'RECOVERY CHOICE',`${source} · enter_room · ${entry.reason}`);
     return entry;
   }
  }
  const chosen={...plan,recovery:true};
  if(chosen.action==='build_house')chosen.house=houseBlueprint({
   ...(/\b(hospital|clinic)\b/i.test(run.order.goal)?{width:8,depth:8}:/\b(cosy|cozy|snug|small)\b/i.test(run.order.goal)?{width:4,depth:4,roof:'shed'}:
    requestedHomeCount(run.order.goal)>1?{width:5+run.completedHouses.length*.6,depth:4+run.completedHouses.length*.4,roof:['pyramid','shed','flat'][run.completedHouses.length%3]}:{}),
   ...(run.roofPreference?{roof:run.roofPreference}:{})});
  trace(bot,'RECOVERY CHOICE',`${source} · ${plan.action} · ${plan.reason}`);
  return chosen;
 }
 function report(run,bot,plan,status,detail){
  const payload={room:run.room,robot_id:run.id,action:['site_check','site_scout'].includes(plan?.action)?'visit':plan?.action==='named_transfer'?'deliver':plan?.action==='furnish_room'?'build':plan?.action||'task',status,detail:String(detail).slice(0,440)};
  if(payload.action==='idle')payload.status='blocked';
  // Reporting is best-effort and never changes the result of the physical tool.
  void api.req('/api/robots/autonomy/report',{method:'POST',body:JSON.stringify(payload)}).catch(e=>emitLog(bot,'WORK RECEIPT UNAVAILABLE',e.message));
 }
 const usable=run=>!run.cancelled&&run.room===room()&&api.online&&api.auth()&&document.visibilityState==='visible'&&!editor.world.renderer.xr.isPresenting;
 function update(){
  const entries=[...runs.values()].map(r=>{
   const state=r.busy?'working':r.last?.status||'ready';
   const blocker=r.metaFailure?' · Meta: '+r.metaFailure:r.last?.status==='failed'||r.last?.status==='blocked'?' · '+String(r.last.detail||'').slice(0,160):'';
   const retry=r.nextMetaAt>Date.now()?' · model retry '+new Date(r.nextMetaAt).toLocaleTimeString():'';
   return `${r.name}: ${r.team?'CITY '+r.team.role:r.order.mode} · ${state} · ${r.team?cityMilestoneCount(r.team.role,r):r.completed}/${r.team?cityRoleTarget(r.team.role):'∞'} verified step(s)${blocker}${retry}`;
  });
  $('autonomyStatus').textContent=entries.join('\n')||'No active work orders. Autonomous roaming is a separate opt-in setting; recent chat alone does not assign work.';
  for(const b of $('controlledRobotFaces')?.children||[]){
   const r=runs.get(b.dataset.robotId);const state=r?r.busy?'working':r.last?.status||'ready':'no-order';
   b.dataset.workStatus=state;
   const name=robotFor(b.dataset.robotId)?.name||'Robot';
   b.title=name+' · '+(r?`${state}${r.last?.detail?' · '+String(r.last.detail).slice(0,170):''}`:'No current saved work order');
  }
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
  run.cancelled=true;clearInterval(run.timer);clearTimeout(run.localTimer);runs.delete(id);created.delete(id);
  if(disable){
   if(run.groupJobId)void api.req('/api/robots/autonomy/group/result',{method:'POST',body:JSON.stringify({room:run.room,message_id:run.groupJobId,robot_id:run.id,outcome:'release',reason})})
    .then(answer=>emitLog(robotFor(id),'GROUP '+answer.status.toUpperCase(),answer.detail))
    .catch(error=>emitLog(robotFor(id),'GROUP RETAINED',`Unable to hand off safely: ${error.message}; saved assignment remains recoverable.`));
   else void saveOrder(run,false).catch(error=>emitLog(null,'STOP NOT SAVED',error.message));
  }
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
   if(bot.userData.robotMission?.taskId===taskId)bot.userData.robotMission.autonomousRun=true;
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
 // Show a genuine authored lifting gesture for a small object on the floor.
 // Never call robotAction here: that command interrupts the active mission.
 async function liftFloorObject(run,bot,source){
  const animator=bot.userData.robotAnimator;
  if(!animator?.actions)return false;
  const bounds=new THREE.Box3().setFromObject(source);
  if(bounds.isEmpty()||Math.abs(bounds.min.y-bot.position.y)>.43)return false;
  const clip=pickUpClip(bot.userData.robotAvailableActions||[],'liftCarry')||
    pickUpClip(bot.userData.robotAvailableActions||[],'pickUp');
  if(!clip||!animator.actions.has(clip))return false;
  bot.userData.robotToolAction={clip,elapsed:0,duration:Math.min(1.35,Math.max(.45,animator.clipDuration(clip)||.8))};
  trace(bot,'LIFTING',`Playing ${clip} for floor-level ${source.name}; inventory transfer still requires tool acknowledgement`);
  await wait(Math.min(1000,bot.userData.robotToolAction.duration*1000));
  requireActive(run,bot);
  return true;
 }
 async function deliverNamedObject(run,bot,source,target){
  if(!run.order.allowChanges)throw Error('Scene edits not authorised for this transfer');
  if(!source||!target||source===target||!editor.canEdit(source)||!editor.canEdit(target))throw Error('Named source/target missing or not editable');
  if(source.userData.transformLocked===true)throw Error('Source transform is locked');
  if(source.userData.furniture?.variant==='box'&&run.order.goal){
   const requirement=cargoConstraints(run.order.goal),match=groundedBoxMatch(source,requirement);
   if(!match.ok)throw Error('Source does not satisfy the requested description: '+match.reason);
  }
  if(!['furniture','cube','sphere','cylinder','torus','model'].includes(source.userData.editorKind))throw Error('Source type cannot be moved by this tool');
  const held=source.userData.storage;
  if(held&&!(held.type==='held'&&held.holderId===run.id))throw Error('Source is already held or stored elsewhere');
  if(!held){
   await approachTransferTarget(run,bot,source,1.85);requireActive(run,bot);
   if(!autonomyProximity(bot,source,2.35)||Math.abs(source.position.y-bot.position.y)>1.7)throw Error('Source outside actual pickup reach');
   source.updateWorldMatrix(true,true);
   const size=new THREE.Box3().setFromObject(source).getSize(new THREE.Vector3());
   if(Math.max(size.x,size.y,size.z)>1.55||size.lengthSq()===0)throw Error('Source too large for hand inventory; use a supported object-moving tool');
   if(editor.inventory.heldFor(bot,'left')||editor.inventory.heldFor(bot,'right'))throw Error('Both object-transfer hands must be free');
   source.userData.pickable=true;
   if(!['food','tool','general'].includes(source.userData.inventory?.category))
    source.userData.inventory={category:'general',size:'bag',consumable:false};
   editor.queueSave(source);
   if(!editor.inventory.hold(bot,source))throw Error('Scene inventory refused pickup');
   if(bot.userData.robotAnimator)await liftFloorObject(run,bot,source);
   trace(bot,'OBJECT HELD',`Picked up ${source.name} (${source.userData.editorId})`);
  }
  await approachTransferTarget(run,bot,target,1.35);requireActive(run,bot);
  if(!autonomyProximity(bot,target,2.65)||Math.abs(target.position.y-bot.position.y)>1.7)throw Error('Target is not physically reachable on this floor');
  if(target.userData.furniture?.variant==='bin'){
   if(!editor.inventory.storeInBin(bot,source,target))throw Error('Target bin rejected item, including capacity, item type or permission checks');
  }else if(!editor.inventory.drop(bot,source))throw Error('Scene inventory refused physical drop');
  if(!await editor.persistObject(source,run.room))throw Error('Scene did not acknowledge object delivery; retry pending');
  trace(bot,'TRANSFER VERIFIED',`${source.name} saved ${target.userData.furniture?.variant==='bin'?'inside':'near'} ${target.name}; real scene object ID retained`);
  return `Delivered ${source.name} ${target.userData.furniture?.variant==='bin'?'into':'beside'} ${target.name}; server acknowledged scene edit`;
 }
 // One verified can per cycle, preserving ID and receipts across refresh.
 // Do not claim success when the robot cannot reach a real item or store it.
 async function cleanCans(run,bot){
  requireActive(run,bot);
  if(!run.order.allowChanges)throw Error('Can cleanup requires scene-change permission for the bin and inventory objects');
  let home=objectFor(run.cleanupHomeId);
  if(!home){
   home=editor.items.find(o=>o.userData.editorKind==='wall'&&/home|house/i.test(o.name)&&o.name.toLowerCase().includes(bot.name.toLowerCase()))||
    editor.items.filter(o=>o.userData.editorKind==='wall'&&/home|house/i.test(o.name)).sort((a,b)=>a.position.distanceToSquared(bot.position)-b.position.distanceToSquared(bot.position))[0];
   if(!home)throw Error('Cannot identify a saved home; cannot safely select an unrelated table');
   run.cleanupHomeId=home.userData.editorId;
   trace(bot,'CLEANUP HOME',`Identified ${home.name}; can selection remains scoped to its nearby tables`);
  }
  const candidates=editor.items.filter(o=>o.userData.editorKind==='furniture'&&o.userData.furniture?.variant==='can'&&
   !run.cleanupDone.includes(o.userData.editorId)&&!o.userData.storage&&
   Math.hypot(o.position.x-home.position.x,o.position.z-home.position.z)<12&&
   editor.items.some(t=>t.userData.furniture?.variant==='table'&&Math.hypot(t.position.x-o.position.x,t.position.z-o.position.z)<2.3));
  if(!candidates.length){trace(bot,'CLEANUP VERIFIED',`No remaining loose cans on tables around ${home.name}; ${run.cleanupDone.length} stored empties recorded`);
   return 'All detected table cans cleared near '+home.name;
  }
  candidates.sort((a,b)=>a.position.distanceToSquared(bot.position)-b.position.distanceToSquared(bot.position));
  const can=candidates[0];
  if(!editor.canEdit(can))throw Error('Can belongs to another owner; no permission to pick up '+can.name);
  let bin=objectFor(run.cleanupBinId)||editor.items.find(o=>o.userData.furniture?.variant==='bin'&&Math.hypot(o.position.x-home.position.x,o.position.z-home.position.z)<13&&editor.canEdit(o));
  if(Math.hypot(bot.position.x-can.position.x,bot.position.z-can.position.z)>1.9)await moveTo(run,bot,can);
  requireActive(run,bot);
  if(!bin){
   // The existing editor place tool applies actual collisions and ownership checks.
   const span=robotHouseSpan(home);
   const corners=span.width>2&&span.depth>2?[[.36,.36],[-.36,.36],[.36,-.36],[-.36,-.36]]:[];
   for(const [sx,sz] of corners){
    const at={x:home.position.x+sx*span.width,z:home.position.z+sz*span.depth};
    if(Math.hypot(at.x-bot.position.x,at.z-bot.position.z)>6)continue;
    bin=editor.createRobotFurniture(bot,'bin',{at});if(bin)break;
   }
   // If every corner is obstructed, prefer an honestly reported reachable bin
   // near the robot to falsely claiming an inaccessible corner placement.
   bin||=editor.createRobotFurniture(bot,'bin');
   if(!bin)throw Error('No collision-free bin location near the table; cleanup requires a clear work position');
   trace(bot,'BIN CREATED',`Created ${bin.name} using the normal persistent furniture tool near ${home.name}`);
  }
  run.cleanupBinId=bin.userData.editorId;
  if(Math.hypot(bot.position.x-can.position.x,bot.position.z-can.position.z)>1.9)await moveTo(run,bot,can);
  requireActive(run,bot);
  if(!autonomyProximity(bot,can,2.4))throw Error('Can is still out of verified reach');
  const dx=can.position.x-bot.position.x,dz=can.position.z-bot.position.z;
  bot.rotation.y=Math.atan2(dx,dz);
  if(!can.userData.pickable){can.userData.pickable=true;editor.queueSave(can);}
  if(!editor.inventory.hold(bot,can))throw Error('Inventory pickup refused '+can.name);
  trace(bot,'CAN HELD',`${can.name} now held in hand; persistent scene item ID ${can.userData.editorId}`);
  // Do not fake drinking already empty cans.
  if(can.userData.inventory?.consumable){
   if(!editor.inventory.drink(bot,can))throw Error('Drink action failed while can was held');
   trace(bot,'CAN USED',`Consumed contents of ${can.userData.editorId}; physical empty can remains`);
  }
  try{
   if(Math.hypot(bot.position.x-bin.position.x,bot.position.z-bin.position.z)>2.2)await moveTo(run,bot,bin);
   requireActive(run,bot);
   if(!autonomyProximity(bot,bin,2.6))throw Error('Bin is out of reach');
   if(!editor.inventory.storeInBin(bot,can,bin))throw Error('Bin rejected empty can');
   run.cleanupDone.push(can.userData.editorId);
   trace(bot,'CAN DISPOSED',`Empty can ${can.userData.editorId} stored in ${bin.name}; ${run.cleanupDone.length} item(s) finished`);
   return `Stored empty can in ${bin.name}; ${run.cleanupDone.length} table cans completed`;
  }catch(error){trace(bot,'CLEANUP PAUSED','Can is still held; no fictitious disposal. '+error.message);throw error;}
 }
 // Recover a failed direct object route by approaching its reachable side.
 // Each attempt is an actual collision-checked robot route with an observed
 // arrival event; no client-side position jump or object teleport is allowed.
 async function approachTransferTarget(run,bot,target,reach){
  const close=()=>Math.hypot(bot.position.x-target.position.x,bot.position.z-target.position.z)<=reach&&
   Math.abs(bot.position.y-target.position.y)<=1.7;
  if(close())return;
  let primaryError='Direct route did not reach the interaction range';
  try{await moveTo(run,bot,target);if(close())return;}
  catch(error){primaryError=error.message;}
  // Construction worksite routing currently supports ground-level actors;
  // do not silently drop a robot down from an elevated storey.
  if(Math.abs(bot.position.y)>.85)throw Error(primaryError+'; no ground-floor detour from upper storey');
  const angle=Math.atan2(bot.position.x-target.position.x,bot.position.z-target.position.z);
  for(const turn of [0,Math.PI/2,-Math.PI/2,Math.PI]){
   requireActive(run,bot);
   const at={x:target.position.x+Math.sin(angle+turn)*Math.min(reach,1.7),
    z:target.position.z+Math.cos(angle+turn)*Math.min(reach,1.7)};
   if(Math.hypot(at.x-bot.position.x,at.z-bot.position.z)>MAX_TRAVEL)continue;
   const taskId=run.token+':'+(++run.step);let resolve;
   const done=new Promise(r=>{resolve=r;});
   const listener=e=>{if(e.detail?.robotId===run.id&&e.detail?.taskId===taskId)resolve(e.detail.status);};
   window.addEventListener('solvi:robot-task-update',listener);
   try{
    if(!editor.routeRobotToWorksite?.(bot,at,taskId,'box/bin approach'))continue;
    if(bot.userData.robotMission?.taskId===taskId)bot.userData.robotMission.autonomousRun=true;
    trace(bot,'TRANSFER DETOUR',`Trying a checked approach to the open side of ${target.name}; keeping the same object-transfer goal`);
    const deadline=Date.now()+Math.min(80000,Math.max(15000,Math.hypot(at.x-bot.position.x,at.z-bot.position.z)*2200+12000));
    let status;
    while(status===undefined&&Date.now()<deadline){requireActive(run,bot);
     status=await Promise.race([done.then(x=>({done:x})),wait(400).then(()=>({}))]).then(x=>x.done);
    }
    if(status==='arrived'&&close())return;
   }finally{window.removeEventListener('solvi:robot-task-update',listener);}
  }
  throw Error(primaryError+'; four collision-checked side approaches also failed');
 }
 // Optional, genuinely physical throw. It is never counted as delivery until
 // physics places the prop inside the opening AND the scene server saves its
 // container state. Any miss becomes a one-time experiment with hand carry
 // as the next strategy; the robot never repeats the same bad throw forever.
 async function tryThrowBox(run,bot,box,bin){
  const id=box.userData.editorId;
  if(cargoConstraints(run.order.goal).content||!editor.carry?.pickup||!editor.carry?.throw||!editor.physics?.owns?.(box)||
     !bot.userData.robotAnimator?.actions||!pickUpClip(bot.userData.robotAvailableActions||[],'throwObject'))return false;
  const peers=editor.items.filter(o=>o.userData.editorKind==='robot'&&o!==bot);
  const advice=safeThrowCandidate({source:box,bin,robot:bot,people:peers,
   obstacles:editor.navigationObstacles?.(bot)||bot.userData.robotPathObstacles||[],physics:editor.physics.enabled,
   alreadyTried:run.cleanupThrowTried?.includes(id)});
  if(!advice.ok)return false;
  if(editor.inventory.heldFor(bot,'right')||editor.inventory.heldFor(bot,'left'))return false;
  if(bot.userData.robotCarry)return false;
  if(editor.items.filter(o=>o.userData.storage?.type==='container'&&o.userData.storage.containerId===bin.userData.editorId).length>=24)return false;
  const delta=new THREE.Vector3(bin.position.x-bot.position.x,0,bin.position.z-bot.position.z);
  const distance=delta.length();
  // The real right-hand attachment point can vary by avatar. A throw is
  // attempted only when a predicted palm trajectory intersects the opening.
  const hand=bot.getWorldPosition?.(new THREE.Vector3())||bot.position.clone();
  const start={x:hand.x+.12*delta.x/distance,y:Math.max(bot.position.y+.95,hand.y+1.1),z:hand.z+.12*delta.z/distance};
  const h=Number(bin.userData.furniture.height)||.5,top=bin.position.y+h;
  const yaw=Math.atan2(delta.x,delta.z),angle=12*Math.PI/180;
  const horizontal=Math.hypot(bin.position.x-start.x,bin.position.z-start.z);
  const denominator=2*Math.cos(angle)**2*(start.y-top+horizontal*Math.tan(angle));
  if(denominator<=0||horizontal<=0)return false;
  const force=Math.sqrt(9.81*horizontal**2/denominator);
  if(!Number.isFinite(force)||force<2||force>8.5)return false;
  const settings=cleanThrowSettings({...bot.userData.robotThrowSettings,angle:12,height:0,direction:0,force});
  const path=predictThrowPath(start,yaw,settings);
  const aperture=Math.min(Number(bin.userData.furniture.width)||0,Number(bin.userData.furniture.depth)||0)*.39;
  let intersects=false;
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i];if(a.y<top||b.y>top||Math.abs(a.y-b.y)<1e-8)continue;
   const t=(a.y-top)/(a.y-b.y),x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
   if(Math.hypot(x-bin.position.x,z-bin.position.z)<aperture){intersects=true;break;}
  }
  if(!intersects)return false;
  box.userData.pickable=true;
  box.userData.inventory={category:'general',size:'bag',consumable:false};
  editor.queueSave(box);
  // A failed pickup is not a throw attempt: ordinary pickup can proceed.
  bot.rotation.y=yaw;editor.queueSave(bot);
  if(!editor.carry.pickup(bot,false,id))return false;
  run.cleanupThrowTried=[...new Set([...(run.cleanupThrowTried||[]),id])].slice(-32);
  const previousSettings=bot.userData.robotThrowSettings;
  try{
   const deadline=Date.now()+3800;
   while(bot.userData.robotCarry?.stage==='pickup'&&Date.now()<deadline){requireActive(run,bot);await wait(80);}
   if(bot.userData.robotCarry?.stage!=='hold')throw Error('lifting did not finish before physics throw');
   bot.userData.robotThrowSettings=settings;
   if(!editor.carry.throw(bot))throw Error('physical Throw tool refused launch');
   trace(bot,'THROW LAUNCHED',`${box.name} aimed at the open ${bin.name}; awaiting physics landing, no storage claim yet`);
   const settle=Date.now()+3700;
   while(Date.now()<settle){requireActive(run,bot);await wait(90);}
   if(bot.userData.robotCarry)throw Error('throw animation has not released the box');
   const within=Math.hypot(box.position.x-bin.position.x,box.position.z-bin.position.z)<aperture;
   const inside=within&&box.position.y>=bin.position.y-.08&&box.position.y<=top+.12;
   if(!inside)throw Error('physics did not land the box inside the container');
   // Only after a real inside-bin landing does the ordinary inventory API
   // adopt and persist the item. Server validation remains authoritative.
   if(!editor.inventory.hold(bot,box))throw Error('cannot adopt the landed box into inventory');
   if(!editor.inventory.storeInBin(bot,box,bin))throw Error('bin rejected the landed box');
   if(!await editor.persistObject(box,run.room))throw Error('throw landing not acknowledged by scene server');
   if(!run.cleanupDone.includes(id))run.cleanupDone.push(id);
   run.cleanupSkipped=run.cleanupSkipped.filter(e=>e.id!==id);
   trace(bot,'THROW VERIFIED',`${box.name} physically landed inside ${bin.name} and scene save acknowledged`);
   return true;
  }catch(error){
   trace(bot,'THROW MISSED',`${box.name}: ${error.message}; switching to collision-checked manual carrying`);
   // If the pickup clip succeeded but the launch did not, release held cargo
   // before the next ordinary pickup attempt; do not force a teleport.
   if(bot.userData.robotCarry?.stage==='hold')editor.carry.drop?.(bot);
   return false;
  }finally{bot.userData.robotThrowSettings=previousSettings;}
 }
 // Bounded, server-persisted box transfer. A failed item is deferred, not
 // allowed to abort the entire task or become a fabricated completion.
 async function cleanBoxes(run,bot){
  requireActive(run,bot);
  if(!run.order.allowChanges)throw Error('Object collection requires scene-change permission');
  const goal=run.order.goal.toLowerCase();
  const seen=liveCleanupObservation(editor.items,bot);
  trace(bot,'LIVE SCENE',`Current ${new Date(seen.observedAt).toISOString()} scene index: ${seen.boxes.length} Box copies, ${seen.nearby.length} within 12m, ${seen.bins.length} named bin candidates. Previous camera captions are not used as live proof.`);
  if(run.groupJobId&&bot.userData.robotBrain?.initiativeVision!==false){
   try{
    const frame=await captureRobotView(editor.world,bot,{yawOffset:0,pitchDegrees:-12});
    requireActive(run,bot);
    if(frame?.size){
     rememberRobotObservationFrame(run.id,frame,`Live cleanup frame · ${new Date().toISOString()} · fresh capture, not historical scene proof`);
     trace(bot,'FRESH CAMERA',`Captured current robot head view (${frame.size} bytes); decisions still use live named scene objects and verified tool reach, not inferred image coordinates.`);
    }else trace(bot,'CAMERA UNAVAILABLE','No current head frame; proceeding only from checked scene object IDs.');
   }catch(error){trace(bot,'CAMERA UNAVAILABLE','No live image: '+error.message+'; older frames will not be substituted.');}
  }
  // The actual target ID from an authorised group dispatch outranks the
  // conversational wording of an older robot work order. Without an ID,
  // require one explicitly named matching scene object, never Small Bin.
  const isBin=o=>o?.userData?.editorId&&['furniture','model','cube','cylinder'].includes(o.userData.editorKind)&&
   /\b(?:bin|junk)\b/i.test(o.name||'');
  const existing=editor.items.find(o=>o.userData.editorId===run.cleanupBinId);
  const candidates=editor.items.filter(o=>isBin(o)&&goal.includes(o.name.toLowerCase()));
  const bin=isBin(existing)?existing:candidates.length===1?candidates[0]:null;
  if(!bin)throw Error(`No unique named junk-bin object loaded for ${run.order.goal.slice(0,120)}; do not use Small Bin as a substitute`);
  if(!editor.canEdit(bin))throw Error(`${bin.name} is not editable by the current robot operator`);
  run.cleanupBinId=bin.userData.editorId;
  const procedural=bin.userData.furniture?.variant==='bin';
  const verified=box=>procedural
   ?box.userData.storage?.type==='container'&&box.userData.storage.containerId===bin.userData.editorId
   :!box.userData.storage&&Math.hypot(box.position.x-bin.position.x,box.position.z-bin.position.z)<=2.5;
  // A modelled junk bin has no inventory container API. For that case only,
  // a close-by physical drop and persisted scene pose is a delivered-near
  // receipt, never a claim of storage inside the model.
  run.cleanupDone=run.cleanupDone.filter(id=>editor.items.some(o=>o.userData.editorId===id&&verified(o)));
  const descriptors=cargoConstraints(run.order.goal);
  const allBoxes=sceneBoxCopies(editor.items);
  const boxes=allBoxes.filter(o=>groundedBoxMatch(o,descriptors).ok);
  if(!boxes.length){
   const description=[descriptors.colour,descriptors.content].filter(Boolean).join(' with ');
   throw Error(allBoxes.length?`No Box copies can be verified against the requested ${description||'name'}; no unrelated boxes touched`:'No procedural Box copies exist in this room; nothing was moved');
  }
  if(descriptors.colour||descriptors.content)trace(bot,'CARGO FILTER',`Requested ${descriptors.colour||'any colour'}${descriptors.content?' containing '+descriptors.content:''}: ${boxes.length}/${allBoxes.length} boxes confirmed by scene metadata; others untouched`);
  const isStored=verified;
  // A successfully saved object can still need its work-order receipt if the
  // tab refreshed after the scene save but before the order-state save.
  for(const box of boxes.filter(isStored)){
   if(!run.cleanupDone.includes(box.userData.editorId)){
    const saved=await editor.persistObject(box,run.room);
    if(saved){run.cleanupDone.push(box.userData.editorId);trace(bot,'DISPOSAL RECOVERED',`${box.name} ${procedural?'stored in':'delivered beside'} ${bin.name}; save acknowledged`);}
   }
  }
  const pending=boxes.filter(o=>!run.cleanupDone.includes(o.userData.editorId));
  if(!pending.length)return `All ${boxes.length} Box copies verified ${procedural?'in':'beside'} ${bin.name}`;
  const now=Date.now(),skippedById=new Map(run.cleanupSkipped.map(e=>[e.id,e]));
  // Finish anything already held before attempting a second pickup.
  const held=pending.find(o=>o.userData.storage?.type==='held'&&o.userData.storage.holderId===run.id);
  const ready=pending.filter(o=>!o.userData.storage||o.userData.storage?.type==='held'&&o.userData.storage.holderId===run.id)
   .filter(o=>!skippedById.get(o.userData.editorId)||skippedById.get(o.userData.editorId).retryAt<=now)
   .sort((a,b)=>a.position.distanceToSquared(bot.position)-b.position.distanceToSquared(bot.position));
  const box=held?(ready.includes(held)?held:null):ready[0];
  if(!box){
   const due=run.cleanupSkipped.filter(e=>pending.some(o=>o.userData.editorId===e.id)).map(e=>e.retryAt);
   trace(bot,'CLEANUP DEFERRED',`${run.cleanupDone.length}/${boxes.length} saved; ${pending.length} pending. Earlier failed boxes will be reconsidered, ${due.length?'next at '+new Date(Math.min(...due)).toLocaleTimeString():'check permissions and inventory'}`);
   return `Cleanup deferred: ${pending.length} Box copies pending; ${run.cleanupDone.length} verified in ${bin.name}`;
  }
  const id=box.userData.editorId;
  try{
   if(!editor.canEdit(box))throw Error('Box is not editable by this robot operator');
   const storage=box.userData.storage;
   if(storage&&!(storage.type==='held'&&storage.holderId===run.id))throw Error('Box is held or stored by someone else');
   if(!storage){
    await approachTransferTarget(run,bot,box,1.85);
    requireActive(run,bot);
    if(!autonomyProximity(bot,box,2.4)||Math.abs(bot.position.y-box.position.y)>1.7)throw Error('Box remains outside physical pickup reach on this floor');
    if(procedural&&await tryThrowBox(run,bot,box,bin))return `Cleanup progress: ${run.cleanupDone.length}/${boxes.length} Box copies stored in ${bin.name} (verified throw)`;
    if(box.userData.storage&&!(box.userData.storage.type==='held'&&box.userData.storage.holderId===run.id))throw Error('Box was claimed by another worker during approach');
    // A missed physical throw may have moved the box: reacquire its CURRENT
    // scene position before holding it. Inventory.hold alone does not check
    // reach, so it must never become a remote telekinetic pickup.
    if(run.cleanupThrowTried?.includes(id)){
     await approachTransferTarget(run,bot,box,1.65);
     requireActive(run,bot);
     if(!autonomyProximity(bot,box,1.95)||Math.abs(bot.position.y-box.position.y)>1.7)
      throw Error('Missed throw: box has not been physically reacquired');
    }
    if(editor.inventory.heldFor(bot,'right')||editor.inventory.heldFor(bot,'left'))throw Error('Robot already holds an object; free a hand first');
    // The existing hand-inventory system needs an explicit pickable general
    // item, not an unpermitted bypass around scene mutation controls.
    box.userData.pickable=true;
    box.userData.inventory={category:'general',size:'bag',consumable:false};
    editor.queueSave(box);
    if(!editor.inventory.hold(bot,box))throw Error('Actual inventory pickup rejected by scene tool');
    if(bot.userData.robotAnimator)await liftFloorObject(run,bot,box);
    trace(bot,'BOX HELD',`Picked up ${box.name} (${id}) with the functional inventory tool`);
   }
   await approachTransferTarget(run,bot,bin,2.35);
   requireActive(run,bot);
   if(!autonomyProximity(bot,bin,2.65)||Math.abs(bot.position.y-bin.position.y)>1.7)throw Error('Junk bin remains out of reach on this floor');
   if(procedural){
    if(!editor.inventory.storeInBin(bot,box,bin))throw Error('Bin refused the box (capacity, size or permissions)');
   }else{
    if(!editor.inventory.drop(bot,box))throw Error('Physical drop beside modelled bin was refused');
   }
   if(!isStored(box))throw Error(procedural?'Storage receipt not reflected in scene state':'Box was not dropped within 2.5m of the named modelled bin');
   // A local draw state alone is not proof of a saved multiplayer edit.
   if(!await editor.persistObject(box,run.room))throw Error('Scene server did not acknowledge the stored box; save pending retry');
   if(!run.cleanupDone.includes(id))run.cleanupDone.push(id);
   run.cleanupSkipped=run.cleanupSkipped.filter(e=>e.id!==id);
   trace(bot,procedural?'BOX STORED':'BOX DELIVERED NEAR',`${box.name} saved ${procedural?'inside':'beside'} ${bin.name}; ${run.cleanupDone.length}/${boxes.length} verified items`);
   return `Cleanup progress: ${run.cleanupDone.length}/${boxes.length} Box copies ${procedural?'stored in':'delivered beside'} ${bin.name}`;
  }catch(error){
   const old=skippedById.get(id),attempts=Math.min(20,(old?.attempts||0)+1);
   const retryAt=Date.now()+Math.min(120000,12000*2**Math.min(attempts-1,3));
   run.cleanupSkipped=[...run.cleanupSkipped.filter(e=>e.id!==id),{id,reason:String(error.message).slice(0,110),attempts,retryAt}].slice(-32);
   trace(bot,'BOX SKIPPED',`${box.name}: ${error.message}; retry ${attempts} after ${new Date(retryAt).toLocaleTimeString()}; ${pending.length-1} other Box copies still eligible`);
   return `Cleanup progress: skipped ${box.name} (${String(error.message).slice(0,120)}); will retry; ${run.cleanupDone.length}/${boxes.length} verified`;
  }
 }
 async function walkToWorksite(run,bot,plan,label,showConstructionGesture=true){
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
   if(bot.userData.robotMission?.taskId===taskId)bot.userData.robotMission.autonomousRun=true;
   const deadline=Date.now()+Math.min(150000,Math.max(20000,plan.meters/1.1*2000+18000));
   let status;
   while(status===undefined&&Date.now()<deadline){requireActive(run,bot);
    status=await Promise.race([result.then(v=>({done:v})),wait(400).then(()=>({}))]).then(v=>v.done);
   }
   if(status!=='arrived')throw Error(status?'Site approach '+status:'Site approach timed out');
   if(Math.hypot(bot.position.x-position.x,bot.position.z-position.z)>.55)throw Error('Robot did not physically reach the planned worksite');
   trace(bot,'WORKSITE REACHED',`${label}; actual robot position verified, construction can start`);
   // Exploration is movement, not a fictitious pickup/construction action.
   if(showConstructionGesture){robotAction(bot,'pickUp');await wait(1150);requireActive(run,bot);}
   robotAction(bot,'idle');requireActive(run,bot);
   return plan.site;
  }finally{window.removeEventListener('solvi:robot-task-update',handler);}
 }
 async function construct(run,bot,variant){
  if(!run.order.allowChanges)throw Error('Scene creation must be enabled in the work order');
  requireActive(run,bot);
  const inside=run.house&&['bottle','can'].includes(variant);
  const plan=inside?null:editor.planRobotBuildSite?.(bot,'furniture',{variant,anchor:run.team?.anchor});
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
 // Assemble a persistent creative structure ONE checked primitive per cycle.
 // Reconstruct past parts by unique human-message/project ID on reload or
 // handoff; a chat promise or camera caption is never completion evidence.
 async function constructCreative(run,bot){
  if(!run.order.allowChanges)throw Error('Creative building requires authorised scene changes');
  requireActive(run,bot);
  const seriesTag=run.creativeSeriesIndex?':series'+run.creativeSeriesIndex:'';
  const tag=creativeProjectTag((run.groupJobId||run.intentMessageId||'')+seriesTag,run.id);
  // New work orders are designed by Muse as declarative geometry, not by
  // hardcoded noun-to-template commands. Previously saved 0.2.236 projects
  // still resume their original eight-part blueprint without rewriting them.
  if(run.order.variant==='creative'&&!run.creativePlan){
   if(run.nextMetaAt&&Date.now()<run.nextMetaAt){
    const pending=Error('Muse design waiting for its existing retry window');pending.failureCode='model-backoff';throw pending;
   }
   let result;
   try{result=await api.req('/api/robots/autonomy/design',{method:'POST',body:JSON.stringify({room:run.room,robot_id:run.id})});}
   catch(error){
    const transient=['meta-key-missing','rate-limited','provider-error','invalid-design'].includes(error.failureCode)||[429,502,503].includes(error.status);
    if(transient){
     run.nextMetaAt=Date.now()+Math.max(30000,Math.min(120000,(error.retryAfterSeconds||45)*1000));
     run.metaFailure=String(error.failureCode||error.message).slice(0,160);
    }
    const stopped=Error('Muse design unavailable; saved work remains intact: '+error.message);
    stopped.failureCode=transient?'model-backoff':(error.failureCode||'design-rejected');
    throw stopped;
   }
   if(result.room!==run.room||result.robot_id!==run.id||!validateRobotDesign(result.plan))
    throw Error('Muse returned a design not valid for this specific robot and realm');
   run.creativePlan=result.plan;
   run.nextMetaAt=0;run.metaFailure=null;
   await saveOrder(run,true); // commit fixed design BEFORE placing the first part
   trace(bot,'MUSE DESIGN COMMITTED',`${run.creativePlan.name}: ${run.creativePlan.parts.length} validated primitives, scoped to robot ${run.id} in realm ${run.room}`);
  }
  const blueprint=run.creativePlan?validateRobotDesign(run.creativePlan):creativeBlueprint(run.order.goal,creativeRole(run.groupJobId));
  if(!blueprint)throw Error('No valid saved design for this realm-bound project');
  const prefix='SOLVI Creative · '+tag+' · ';
  for(let index=0;index<blueprint.parts.length;index++){
   const existing=editor.items.find(o=>['cube','sphere','cylinder'].includes(o.userData.editorKind)&&editor.canEdit(o)&&o.name?.startsWith(prefix+index+' · '));
   if(existing&&!run.creativeBuilt.some(p=>p.index===index)){
    run.creativeBuilt.push({id:existing.userData.editorId,index});
    const part=blueprint.parts[index];
    if(!run.creativeSite)run.creativeSite={x:+(existing.position.x-part.offset.x).toFixed(3),z:+(existing.position.z-part.offset.z).toFixed(3)};
    trace(bot,'CREATIVE RESUMED',`Found earlier scene primitive ${existing.userData.editorId} at stage ${index+1}. Server must independently verify final project.`);
   }
  }
  run.creativeBuilt=run.creativeBuilt.filter(entry=>editor.items.some(o=>o.userData.editorId===entry.id&&o.name?.startsWith(prefix+entry.index+' · ')));
  const index=nextCreativeIndex(blueprint.parts,run.creativeBuilt);
  if(index<0)return `CREATIVE VERIFIED: ${blueprint.name} already has ${blueprint.parts.length} actual scene parts`;
  if(!run.creativeSite){
   let at;
   if(blueprint.direct){
    // 'in front of you' means a real robot-relative offset, not the
    // operator's mouse cursor or a 547-second-old camera description.
    const heading=bot.rotation.y,requested=blueprint.distance??2;
    at={x:bot.position.x+Math.sin(heading)*requested,z:bot.position.z+Math.cos(heading)*requested};
    if(!Number.isFinite(at.x)||!Number.isFinite(at.z))throw Error('Robot heading is not finite');
    if(requested>10){
     // Do not teleport a 30m-away object from the robot's current location.
     // The regular A* navigation tool must verify a real approach first.
     const standOff=Math.min(5,requested-2);
     const staging={x:at.x-Math.sin(heading)*standOff,z:at.z-Math.cos(heading)*standOff};
     await walkToWorksite(run,bot,{site:at,staging,meters:requested-standOff},blueprint.name);
     requireActive(run,bot);
    }
   }else{
    // An explicit 'go to @Bee and help embellish her maze' assignment must
    // use Bee's CURRENT scene position as a worksite hint, not old memories.
    // Never teleport: the normal A* approach still verifies the route.
    const collaborator=/\b(?:go\s+to|near|beside|help|with)\s+@([\p{L}\p{N}_-]+)/iu.exec(run.order.goal);
    const peer=collaborator&&editor.items.find(o=>o.userData.editorKind==='robot'&&o!==bot&&
      o.name.toLocaleLowerCase()===collaborator[1].toLocaleLowerCase());
    const anchor=peer?{x:peer.position.x,z:peer.position.z}:run.team?.anchor;
    const site=editor.planRobotBuildSite?.(bot,'house',{width:blueprint.span,depth:blueprint.span,anchor});
    if(peer)trace(bot,'COLLABORATIVE SITE',`Planning beside current realm robot ${peer.name}, with A* and scene collision checks.`);
    if(!site)throw Error('NO CLEAR CREATIVE WORKSITE: existing objects/route block this location; require an alternate accessible open area');
    at=await walkToWorksite(run,bot,site,blueprint.name);
   }
   requireActive(run,bot);
   run.creativeSite={x:+at.x.toFixed(3),z:+at.z.toFixed(3)};
   await saveOrder(run,true); // destination committed before the first edit
   trace(bot,'CREATIVE SITE COMMITTED',`${blueprint.name} at ${run.creativeSite.x},${run.creativeSite.z}; project ${tag}`);
  }
  const part=blueprint.parts[index],oldPending=run.creativePending;
  let object=oldPending?.index===index&&editor.items.find(o=>o.userData.editorId===oldPending.id&&editor.canEdit(o));
  if(!object){
   const stale=oldPending?.index===index;
   if(stale)trace(bot,'CREATIVE RETRY','Unsaved part no longer present; reconstructing only the missing part');
   object=editor.createRobotCreativePart?.(bot,part,{site:run.creativeSite,tag,index,collectionName:creativeCollectionTitle(bot.name,blueprint.name,tag,run.creativeSeriesIndex||0)});
   if(!object)throw Error('CREATIVE PLACEMENT REJECTED: no collision-free, operator-editable position for '+part.label);
   run.creativePending={id:object.userData.editorId,index};
  }
  requireActive(run,bot);
  const saveTimer=editor.pendingSaves?.get(object.userData.editorId);
  if(saveTimer){clearTimeout(saveTimer);editor.pendingSaves.delete(object.userData.editorId);}
  const receipt=await editor.persistObject?.(object,run.room);
  requireActive(run,bot);
  if(!receipt)throw Error('Creative primitive scene save was not acknowledged; retaining exact object for retry');
  if(!run.creativeBuilt.some(entry=>entry.index===index))run.creativeBuilt.push({id:object.userData.editorId,index});
  run.creativePending=null;
  trace(bot,'CREATIVE PART SAVED',`${blueprint.name}: ${index+1}/${blueprint.parts.length} ${part.label} (${object.userData.editorId}); confirmed by scene persistence`);
  return `Creative part ${index+1}/${blueprint.parts.length} verified: ${part.label} (${object.userData.editorId})`;
 }
 async function furnishRoom(run,bot,variant){
  if(!run.order.allowChanges)throw Error('Scene changes are disabled for furnishing');
  requireActive(run,bot);
  // A failed network save must not create another local duplicate on retry.
  const pending=run.projectPending.find(p=>p.variant===variant);
  let item=pending&&editor.items.find(o=>o.userData.editorId===pending.id&&editor.canEdit(o));
  if(!item){
   run.projectPending=run.projectPending.filter(p=>p.variant!==variant);
   const site=editor.planRobotRoomFurnishing?.(bot,variant);
   if(!site)throw Error('NO CLEAR ROOM SPOT: no verified same-floor footprint for '+variant+' in an editable room; checking existing furniture and wall geometry, will retry another position');
   item=editor.createRobotRoomFurniture?.(bot,variant,{color:run.furnishingColors[variant]||''});
   if(!item)throw Error('ROOM PLACEMENT REJECTED: '+variant+' could not be created after scene clearance changed');
   run.projectPending.push({id:item.userData.editorId,variant});
  }
  requireActive(run,bot);
  const id=item.userData.editorId;
  // The action is visible in the world, not merely a chat-side save. Animation
  // is cosmetic and never substitutes for the server's placement receipt.
  if(bot.userData.robotAnimator){robotAction(bot,'pickUp');await wait(550);requireActive(run,bot);robotAction(bot,'idle');}
  // Normal editor queueSave is asynchronous. Ask that very same persistence
  // method for an actual server acknowledgement before claiming completion.
  const pendingTimer=editor.pendingSaves?.get(id);
  if(pendingTimer){clearTimeout(pendingTimer);editor.pendingSaves.delete(id);}
  const acknowledged=await editor.persistObject?.(item,run.room);
  requireActive(run,bot);
  if(!acknowledged)throw Error('SCENE SAVE NOT ACKNOWLEDGED: '+variant+' remains pending; will retry original object ID');
  const owned=created.get(run.id)||new Set();owned.add(id);created.set(run.id,owned);
  run.projectPlaced.push({id,variant});
  run.projectPending=run.projectPending.filter(p=>p.variant!==variant);
  run.projectDeferred=run.projectDeferred.filter(p=>p.variant!==variant);
  trace(bot,'ACTION VERIFIED',`furnish_room(${variant}) persisted: ${id}; colour ${run.furnishingColors[variant]||'default'}`);
  trace(bot,'ROOM FURNITURE SAVED',`${variant} on verified room floor; server acknowledged scene object ${id}`);
  return `Verified room furnishing: ${variant} (${id})`;
 }
 async function constructInfrastructure(run,bot,variant){
  if(!run.order.allowChanges||!['road','footpath'].includes(variant))throw Error('City infrastructure requires authorised scene changes');
  requireActive(run,bot);
  const plan=editor.planRobotBuildSite?.(bot,variant,{anchor:run.team?.anchor});
  trace(bot,'TEAM SITE',plan?.teamAnchor?'Using shared city neighbourhood anchor':'Shared anchor inaccessible; choosing individually verified reachable site');
  const at=await walkToWorksite(run,bot,plan,variant+' construction site');
  requireActive(run,bot);
  const item=editor.createRobotInfrastructure?.(bot,variant,{at});
  if(!item)throw Error('No permitted, collision-free road or footpath site remained after arrival');
  run.teamBuilt.push({id:item.userData.editorId,variant});
  trace(bot,'CITY INFRASTRUCTURE',`${variant} constructed and queued for persistent room save, object ID ${item.userData.editorId}; ${run.teamBuilt.length}/${cityRoleTarget(run.team?.role)} team segments`);
  return `${variant} scene object ${item.name} created; ${run.teamBuilt.length}/${cityRoleTarget(run.team?.role)} segments`;
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
   const plan=editor.planRobotBuildSite?.(bot,'house',{...spec,anchor:run.team?.anchor});
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
   if(/meta.*key|key.*meta|configured|not configured/i.test(error.message)){trace(bot,'MODEL KEY UNAVAILABLE','Planning cannot authenticate on this browser tab; check Settings → Meta AI. Other model routes may have succeeded from different sessions.');void checkMetaStatus();}
   const retryAfter=Number(/Retry after (\d+)s/i.exec(error.message)?.[1]||0);
   const cooldownMs=Math.min(600000,Math.max(0,retryAfter)*1000);
   run.nextMetaAt=Date.now()+Math.max(cooldownMs,metaRetryDelay(run.metaFailures,{retrySeconds:metaPrefs.retry_seconds,maxRetrySeconds:metaPrefs.max_retry_seconds}));
   trace(bot,'META FAILED',`${error.message} · next model retry ${Math.ceil((run.nextMetaAt-Date.now())/1000)}s (your account setting); autonomous local tools remain active`);
   return recovery(run,bot,'Meta planning failure');
  }
  requireActive(run,bot);
  if(answer.vision_fallback)trace(bot,'VISION LIMIT',Number(answer.views)===1?'Six-frame request failed; planning used ONE genuine camera frame only':'Meta rejected image requests; text-only retry succeeded, so no visual perception is claimed');
  if(answer.validated===false){
   run.metaFailure=answer.decision?.reason||'Invalid model JSON';trace(bot,'MODEL OUTPUT REJECTED',answer.decision?.reason||'Unsupported planning output');
   run.metaFailures++;
   run.nextMetaAt=Date.now()+metaRetryDelay(run.metaFailures,{retrySeconds:metaPrefs.retry_seconds,maxRetrySeconds:metaPrefs.max_retry_seconds});
   return recovery(run,bot,'Invalid Meta tool call');
  }
  if(answer.decision?.action==='use_preset')await refreshPresets();
  const decision=cleanAutonomyDecision(answer.decision,editor.items.map(o=>({id:o.userData.editorId,kind:o.userData.editorKind})),run.id,publicPresetIndex(presets));
  if(!decision)throw Error('Model response had no valid scene-grounded action');
  trace(bot,'META PROPOSAL',`${decision.action}: ${decision.reason||'(no reason)'} · Meta usage ~US$${Number(answer.usage?.estimated_usd||0).toFixed(6)}`);
  run.metaFailures=0;run.nextMetaAt=0;run.metaFailure=null;
  if(decision.action==='idle'&&run.loop)return recovery(run,bot,'Model suggested waiting without resolving the work order');
  return decision;
 }
 async function execute(run,bot,plan){
  const obj=objectFor(plan.target_id),dest=objectFor(plan.destination_id);
  if(plan.action==='named_transfer')return deliverNamedObject(run,bot,obj,dest);
  if(plan.action==='cleanup_boxes')return cleanBoxes(run,bot);
  if(plan.action==='cleanup_cans')return cleanCans(run,bot);
  if(plan.action==='build_infrastructure')return constructInfrastructure(run,bot,plan.variant);
  if(plan.action==='creative_build')return constructCreative(run,bot);
  if(plan.action==='enter_room'){
   const entry=plan.entry;
   if(!entry?.staging)throw Error('No reachable editable ground-floor room with a path');
   const refreshed=editor.planRobotRoomEntry?.(bot);
   if(!refreshed||refreshed.roomId!==entry.roomId||
      Math.hypot(refreshed.staging.x-entry.staging.x,refreshed.staging.z-entry.staging.z)>.9)
      throw Error('Planned room entrance changed; resurvey another room');
   trace(bot,'ROOM ENTRY',`Walking into ${entry.roomName} on a verified ${entry.meters.toFixed(1)} m path`);
   await walkToWorksite(run,bot,entry,'room interior');
   trace(bot,'ROOM ENTERED',`Actually reached ${entry.roomName}; furniture still pending`);
   return 'Entered editable room by collision-checked movement; furnishing still pending';
  }
  if(plan.action==='site_scout'){
   requireActive(run,bot);
   const taskId=run.token+':'+(++run.step);
   let resolveStatus;const done=new Promise(resolve=>{resolveStatus=resolve;});
   const handler=event=>{if(event.detail?.robotId===run.id&&event.detail?.taskId===taskId)resolveStatus(event.detail.status);};
   window.addEventListener('solvi:robot-task-update',handler);
   try{
    trace(bot,'SCOUT OPEN WORKSITE',`Finding a different building area by 15 m checked retreat and random turn; mission ${taskId}`);
    if(!editor.receiveRobotCommand({room:run.room,id:taskId,robot_id:run.id,kind:'recover_route',distance:15,target_name:'alternate house worksite'}))
     throw Error('Cannot safely relocate from this worksite; existing obstacles remain unchanged');
    let status;const end=Date.now()+75000;
    while(status===undefined&&Date.now()<end){requireActive(run,bot);
     status=await Promise.race([done.then(v=>({done:v})),wait(400).then(()=>({}))]).then(v=>v.done);}
    if(status!=='arrived')throw Error('Site scouting route '+(status||'timed out'));
    trace(bot,'SCOUT ARRIVED','New physically verified stance available; retrying the saved house plan, not claiming construction.');
    return 'Reached alternative worksite area by collision-checked movement; house still pending';
   }finally{window.removeEventListener('solvi:robot-task-update',handler);}
  }
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
  if(plan.action==='idle')return plan.reason||'No safe untried step remains; review scene-edit permissions, the saved goal, and model diagnostics.';
  if(plan.action==='visit'){await moveTo(run,bot,obj);return `Visited ${obj.name}`;}
  if(plan.action==='deliver')return deliver(run,bot,obj,dest);
  if(plan.action==='build'){
   const built=await construct(run,bot,plan.variant);
   if(plan.project){run.projectPlaced.push({id:built.userData.editorId,variant:plan.variant});
    trace(bot,'PROJECT MILESTONE',`${run.projectPlaced.length}/${localProjectSequence(run.order.goal).length} grounded objects placed for the community site`);}
   return 'Built '+built.name;
  }
  if(plan.action==='build_house')return constructHouse(run,bot,plan.house);
  if(plan.action==='furnish_room')return furnishRoom(run,bot,plan.variant);
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
   run.projectPlaced=run.projectPlaced.filter(p=>editor.items.some(o=>o.userData.editorId===p.id));
   run.teamBuilt=run.teamBuilt.filter(p=>editor.items.some(o=>o.userData.editorId===p.id));
   run.completedHouses=run.completedHouses.filter(id=>editor.items.some(o=>o.userData.editorId===id&&o.userData.editorKind==='wall'));
   // The next Muse design is not another component of the previous design.
   // Keep the last completed design in saved state until the next scheduled
   // slot, so a deadline during the pause can still be verified server-side.
   if(run.order.variant==='creative'&&run.creativeDeadline&&run.creativePlan&&run.creativeNextAt){
    const complete=run.creativeBuilt.length===run.creativePlan.parts.length&&run.creativeBuilt.every(entry=>
      editor.items.some(o=>o.userData.editorId===entry.id&&o.name?.startsWith('SOLVI Creative · '+creativeProjectTag((run.groupJobId||run.intentMessageId||'')+(run.creativeSeriesIndex?':series'+run.creativeSeriesIndex:''),run.id)+' · '+entry.index+' · ')));
    if(complete){
     const state=creativeSessionStatus({deadline:run.creativeDeadline,nextAt:run.creativeNextAt,seriesIndex:run.creativeSeriesIndex});
     if(state==='slot-wait'||state==='budget-wait'){
      // One REAL collision-checked stroll between projects when the human
      // expressly asked for roaming. Do not mistake pacing for being idle.
      if(run.creativeRoamedIndex!==run.creativeSeriesIndex&&/\b(?:walk|wander|roam|explore)\b/i.test(run.order.goal)){
       run.creativeRoamedIndex=run.creativeSeriesIndex;
       try{
        const waypoint=editor.planRobotBuildSite?.(bot,'house',{width:1.8,depth:1.8});
        if(waypoint){await walkToWorksite(run,bot,waypoint,'creative-session exploration',false);
         trace(bot,'TIMED EXPLORATION VERIFIED',`Real collision-checked movement completed; work order remains active until ${new Date(run.creativeDeadline).toISOString()}.`);}
        else trace(bot,'TIMED EXPLORATION DEFERRED','No verified safe waypoint; next construction slot is retained.');
       }catch(error){trace(bot,'TIMED EXPLORATION DEFERRED',String(error.message).slice(0,170)+'; construction deadline unchanged.');}
      }
      const until=state==='budget-wait'?run.creativeDeadline:run.creativeNextAt;
      clearTimeout(run.localTimer);run.localTimer=setTimeout(()=>void cycle(run),Math.max(1000,until-Date.now()+100));
      return;
     }
     if(state==='ready'){
      const previous=run.creativePlan.name;
      if(!run.creativeHistory.some(h=>h.index===run.creativeSeriesIndex))
       run.creativeHistory.push({index:run.creativeSeriesIndex,ids:run.creativeBuilt.map(p=>p.id)});
      run.creativeSeriesIndex++;run.creativePlan=null;run.creativeSite=null;run.creativeBuilt=[];run.creativePending=null;run.creativeNextAt=0;
      run.nextMetaAt=0;run.metaFailure=null;
      await saveOrder(run,true);
      trace(bot,'NEXT DISTINCT DESIGN',`Completed ${previous}; starting scene-verified design ${run.creativeSeriesIndex+1}/${CREATIVE_SESSION_MAX_DESIGNS}; ${Math.ceil((run.creativeDeadline-Date.now())/60000)} minute(s) remain.`);
     }
    }
   }
   let plan;
   if(run.order.mode==='local_project' &&!canCleanupGoal(run.order.goal)&&!boxCleanupGoal(run.order.goal)&&((run.team&&cityMilestoneCount(run.team.role,run)>=cityRoleTarget(run.team.role))||(!run.team&&((requestedHomeCount(run.order.goal)>0&&run.completedHouses.length>=requestedHomeCount(run.order.goal))||
     (localProjectSequence(run.order.goal).length>0&&run.projectPlaced.length>=localProjectSequence(run.order.goal).length))))){
    trace(bot,'PROJECT FINISHED','Already completed in saved scene history; no duplicate buildings or props will be placed.');
    if(run.groupJobId){
     try{
      await saveOrder(run,true);
      await api.req('/api/robots/autonomy/group/result',{method:'POST',body:JSON.stringify({room:run.room,message_id:run.groupJobId,robot_id:run.id,outcome:'completed'})});
      trace(bot,'GROUP PROJECT VERIFIED','Server independently confirmed completed saved project milestones.');
      stop(run.id,'verified existing group project',false);
     }catch(error){trace(bot,'GROUP RECEIPT PENDING','Saved project IDs need server verification before closing: '+error.message);}
    }else stop(run.id,'verified project already complete');
    return;
   }
   if(run.order.mode==='agent'||run.order.mode==='local_project'){
    if((run.order.variant==='creative'||creativeBuildIntent(run.order.goal))&&run.order.allowChanges)plan={action:'creative_build',recovery:true,reason:'Create the next original procedural part with actual editor tools'};
    else if(run.order.mode==='local_project')plan=recovery(run,bot,'Locally authorised construction; no Meta model call');
    else if((houseGoal(run.order.goal)||roomFurnishingSequence(run.order.goal).length>0)&&run.order.allowChanges){
     // Local procedural tools do not need a paid Meta call or its backoff.
     plan=recovery(run,bot,'Executable authorised construction/furnishing goal; Meta planning optional');
    }else if(run.nextMetaAt&&Date.now()<run.nextMetaAt){
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
   run.pendingAction=plan.action;run.lastPlanAction=plan.action;run.lastPlanVariant=plan.variant||'';
   if(plan.recovery)run.recoveryAttempts[plan.action]=(run.recoveryAttempts[plan.action]||0)+1;
   // Missing objects are not evidence of completion after a reload or delete.
   run.projectPlaced=run.projectPlaced.filter(p=>editor.items.some(o=>o.userData.editorId===p.id));
   trace(bot,'ACTION STARTED',`${plan.action}${plan.variant?' ('+plan.variant+')':''} · saved goal: ${run.order.goal.slice(0,130)}${run.intentMessageId?' · message '+run.intentMessageId:''}`);
   const beforeCleanup=run.cleanupDone.length;
   const detail=await execute(run,bot,plan);
   if(run.groupJobId&&plan.action==='cleanup_boxes')run.groupNoProgress=run.cleanupDone.length>beforeCleanup?0:Math.min(15,run.groupNoProgress+1);
   if(plan.action==='build_house'&&run.house&&!run.house.missing?.length&&!run.house.inspectionFailed){
    const wallId=run.house.wall?.userData.editorId;
    if(wallId&&!run.completedHouses.includes(wallId)){
     run.completedHouses.push(wallId);
     run.recoveryAttempts.build_house=0; // successful new wall resets ONLY this tool's spent retry budget
     trace(bot,'HOME VERIFIED',`${run.completedHouses.length}/${requestedHomeCount(run.order.goal)||1} house(s) built and furnished; IDs retained for future cycles`);
    }
    if(run.completedHouses.length<requestedHomeCount(run.order.goal)){
     run.house=null;
     if(!run.askedPreferences&&run.completedHouses.length===1){
      run.askedPreferences=true;
      try{
       const question=await api.req('/api/robots/autonomy/ask-human',{method:'POST',body:JSON.stringify({room:run.room,robot_id:run.id,topic:'roof_style'})});
       await postHumanQuestion(question.message);
       trace(bot,'OPTIONAL STYLE QUESTION','Asked which roof to use for the NEXT house; defaults remain and work continues.');
      }catch(error){trace(bot,'OPTIONAL QUESTION SKIPPED',error.message+' · building is not blocked');}
     }
    }
   }
   const invitedNames=(run.order.goal.match(/@[\p{L}\p{N}_-]+/gu)||[]).map(v=>v.slice(1).toLowerCase());
   const wanted=editor.items.filter(o=>o.userData.editorKind==='robot'&&invitedNames.includes(o.name.toLowerCase())).map(o=>o.userData.editorId);
   const contactNeeded=/\b(find|meet|locate|visit|talk to|tell|approach)\b/i.test(run.order.goal)?wanted:[];
   const invitationNeeded=/\b(invite|opening party|celebrat)\b/i.test(run.order.goal)?wanted:[];
   const evidence=projectOutcome({house:run.house,goal:run.order.goal,invitations:run.invitations,
    invitationsRequired:invitationNeeded,contacts:run.contacted,contactsRequired:contactNeeded,
    placedSupplies:run.placedSupplies,suppliesRequired:/\b(bottles?|cans?|drinks?|refreshments?)\b/i.test(run.order.goal)?4:0});
   if(plan.action!=='idle')run.completed++;
   run.last=autonomyResult(plan.action,plan.action!=='idle',detail);
   if(plan.action==='idle')run.last.status=/^GOAL REACHED:/.test(detail)?'completed':'blocked';
   if(plan.action==='cleanup_boxes'&&detail.startsWith('Cleanup '))run.last.status='partial';
   if(run.order.mode==='agent'&&requestedHomeCount(run.order.goal)&&run.completedHouses.length<requestedHomeCount(run.order.goal))run.last.status='partial';
   if(run.order.mode==='agent'&&localProjectSequence(run.order.goal).length&&run.projectPlaced.length<localProjectSequence(run.order.goal).length)run.last.status='partial';
   else if(run.house&&!evidence.done)run.last.status='partial';
   if(plan.action==='site_check'&&run.house&&!evidence.done)run.last.status='partial';
   if(plan.action==='build_house'&&(run.house?.missing?.length||run.house?.inspectionFailed))run.last.status='partial';
   // A verified tool action is not the same as completing a complex goal.
   if(run.order.mode==='agent'&&houseGoal(run.order.goal)&&(!run.house||!evidence.done)&&run.last.status==='completed')run.last.status='partial';
   const remaining=evidence.blockers.join('; ');
   // Share actual, recent construction receipts with visiting teammates; do
   // not turn random exploration or a chat reply into proof of scene edits.
   if(run.last.status==='completed'&&['build_house','build_infrastructure','build','use_preset'].includes(plan.action))
    bot.userData.robotLastVerifiedWork={status:'completed',detail:String(detail).slice(0,240),at:Date.now()};
   trace(bot,run.last.status==='completed'&&run.order.mode==='agent'?'STEP VERIFIED':run.last.status==='completed'?'COMPLETED':run.last.status.toUpperCase(),detail+(run.house&&remaining?' · Remaining: '+remaining:''));
   report(run,bot,plan,run.last.status,detail+(run.house&&remaining?' · Remaining: '+remaining:''));
   $('autonomyFailure').textContent=(run.metaFailure?'Meta planning unavailable: '+run.metaFailure+'\nVerified local action: ':'Work order: ')+detail+(run.house&&remaining?'\nUNFINISHED: '+remaining:'')+(!run.house&&run.order.mode==='agent'&&houseGoal(run.order.goal)?'\nUNFINISHED: no confirmed house yet':'');
   if(run.order.mode==='local_project'&&!canCleanupGoal(run.order.goal)&&!boxCleanupGoal(run.order.goal)&&((run.team&&cityMilestoneCount(run.team.role,run)>=cityRoleTarget(run.team.role))||(!run.team&&((requestedHomeCount(run.order.goal)>0&&run.completedHouses.length>=requestedHomeCount(run.order.goal))||
      (localProjectSequence(run.order.goal).length>0&&run.projectPlaced.length>=localProjectSequence(run.order.goal).length))))){
    trace(bot,'PROJECT FINISHED','All bounded local construction milestones have verified scene object IDs; the work order is stopping.');
    if(run.groupJobId){
     await saveOrder(run,true);
     try{
      await api.req('/api/robots/autonomy/group/result',{method:'POST',body:JSON.stringify({room:run.room,message_id:run.groupJobId,robot_id:run.id,outcome:'completed'})});
      trace(bot,'GROUP PROJECT VERIFIED','Server confirmed built scene IDs; independent project queue is ready for another worker.');
      stop(run.id,'verified group project',false);
     }catch(error){trace(bot,'GROUP RECEIPT PENDING','Built objects saved; task receipt needs server verification: '+error.message);}
    }else stop(run.id,'verified project milestones completed');
   }
   if(plan.action==='creative_build'&&run.creativeBuilt.length>=(run.creativePlan?.parts?.length||creativeBlueprint(run.order.goal,creativeRole(run.groupJobId)).parts.length)){
    // One complete design is a checkpoint; a timed human assignment is NOT
    // completed until its wall-clock deadline has elapsed.
    try{
     await saveOrder(run,true);
     const state=creativeSessionStatus({deadline:run.creativeDeadline,nextAt:run.creativeNextAt,seriesIndex:run.creativeSeriesIndex});
     if(run.creativeDeadline&&state!=='expired'){
      if(!run.creativeNextAt){
       run.creativeNextAt=nextCreativeSlot(run.order.goal,run.creativeDeadline,run.creativeSeriesIndex+1);
       await saveOrder(run,true);
       trace(bot,'CREATIVE SESSION CHECKPOINT',`${run.creativePlan?.name||'Design'} verified (${run.creativeSeriesIndex+1}/${CREATIVE_SESSION_MAX_DESIGNS}). Assignment remains active until ${new Date(run.creativeDeadline).toISOString()}; next design ${new Date(run.creativeNextAt).toISOString()}.`);
      }
      // No fast-loop duplicate design and no 180s fallback while waiting.
      clearTimeout(run.localTimer);run.localTimer=setTimeout(()=>void cycle(run),Math.max(1000,run.creativeNextAt-Date.now()+100));
     }else if(run.groupJobId){
      const result=await api.req('/api/robots/autonomy/group/result',{method:'POST',body:JSON.stringify({room:run.room,message_id:run.groupJobId,robot_id:run.id,outcome:'completed'})});
      trace(bot,'CREATIVE SESSION VERIFIED',`${run.creativeSeriesIndex+1} structure(s), latest ${run.creativeBuilt.length} parts independently verified; group receipt ${result.status}; ${run.creativeDeadline?'requested time elapsed':'one-off project complete'}.`);
      stop(run.id,'creative work session completed',false);
     }else{
      trace(bot,'CREATIVE SESSION VERIFIED',`${run.creativeSeriesIndex+1} separately saved structure(s); ${run.creativeDeadline?'requested time elapsed':'one-off project complete'}.`);
      stop(run.id,'creative work session completed');
     }
    }catch(error){trace(bot,'CREATIVE RECEIPT PENDING',`Scene parts exist but completion is NOT verified by server: ${error.message}`);}
   }
   if(plan.action==='named_transfer'&&run.order.mode==='local_project'&&detail.startsWith('Delivered ')){trace(bot,'TRANSFER FINISHED','Named target move has a saved scene receipt.');stop(run.id,'verified named object transfer');}
   if(plan.action==='cleanup_boxes'&&detail.startsWith('All ')&&/ Box copies verified (?:in|beside) /.test(detail)){
    if(run.groupJobId){
     try{
      await api.req('/api/robots/autonomy/group/result',{method:'POST',body:JSON.stringify({room:run.room,message_id:run.groupJobId,robot_id:run.id,outcome:'completed'})});
      trace(bot,'GROUP CLEANUP VERIFIED','Server independently checked every Box copy in current saved scene; project closed.');
      stop(run.id,'verified group box collection',false);
     }catch(error){trace(bot,'GROUP RECEIPT PENDING','Client scene claims complete, but the server has NOT confirmed the boxes: '+error.message);}
    }else{trace(bot,'CLEANUP FINISHED','All Box copies have server-acknowledged storage receipts.');stop(run.id,'verified box collection');}
   }
   // A blocked worker yields a shared task when no cargo is in its hands;
   // the next available nearby robot can try a different physical route.
   if(run.groupJobId&&plan.action==='cleanup_boxes'&&run.groupNoProgress>=3&&!run.cancelled){
    const holding=editor.items.find(o=>o.userData.storage?.type==='held'&&o.userData.storage.holderId===run.id);
    if(holding&&editor.canEdit(holding)){
     if(editor.inventory.drop(bot,holding)&&await editor.persistObject(holding,run.room))
      trace(bot,'SAFE HANDOFF DROP',`Saved ${holding.name} at current physical location before asking a colleague to continue; not counted as bin delivery.`);
    }
    const cargoRemaining=editor.items.some(o=>o.userData.storage?.type==='held'&&o.userData.storage.holderId===run.id);
    if(!cargoRemaining){
     try{
      const handoff=await api.req('/api/robots/autonomy/group/result',{method:'POST',body:JSON.stringify({room:run.room,message_id:run.groupJobId,robot_id:run.id,outcome:'release',reason:'No verified progress after three fresh scene checks; seeking another eligible robot'})});
      trace(bot,'GROUP HANDOFF',`No box moved in three cycles; ${handoff.status}. Saved scene objects remain untouched.`);
      stop(run.id,'handed off blocked group task',false);
      void dispatchPendingGroupTasks();
     }catch(error){trace(bot,'HANDOFF BLOCKED','Assignment retained; no duplicate worker may start: '+error.message);}
    }else trace(bot,'HANDOFF DEFERRED','Robot still holds cargo; physical delivery or recovery must finish before another worker is assigned.');
   }
   if(plan.action==='cleanup_cans'&&detail.startsWith('All detected table cans cleared')){trace(bot,'CLEANUP FINISHED','Table clear per current scene objects; work order stopped.');stop(run.id,'verified table can cleanup');}
   if(run.last.status==='blocked'&&run.loop)trace(bot,'WHY BLOCKED',detail+' · A new direct assignment can replace the old work order. Existing objects remain untouched.');
   if(plan.action==='idle'&&/^GOAL REACHED:/.test(detail))stop(run.id,'verified project target reached');
   if(plan.action==='idle'&&detail.startsWith('FURNISHING DEFERRED:')){
    const next=nextRoomFurnishing(roomFurnishingSequence(run.order.goal),run.projectPlaced,run.projectDeferred);
    if(next.nextRetryAt){clearTimeout(run.localTimer);run.localTimer=setTimeout(()=>void cycle(run),Math.max(1000,next.nextRetryAt-Date.now()+100));}
   }
   // While Meta is unavailable, continue actual verified local building steps
   // rather than taking another 180-second silence after placing one object.
   // This bounded burst does not invoke the model or bypass an edit check.
   if(!run.cancelled&&run.loop&&plan.recovery&&plan.action!=='idle'&&(plan.action==='creative_build'||run.localBurst<(canCleanupGoal(run.order.goal)||boxCleanupGoal(run.order.goal)?48:run.order.sourceId?3:10))){
    run.localBurst++;
    clearTimeout(run.localTimer);
    run.localTimer=setTimeout(()=>void cycle(run),plan.action==='furnish_room'?2500:plan.action==='creative_build'?2800:12000);
   }
   // Account-configured model retry must not be stretched to a 180s work-order tick.
   // Only a blocked model request waits; unrelated local actions continue above.
   else if(!run.cancelled&&run.loop&&run.order.mode==='agent'&&run.metaFailure&&run.lastPlanAction==='idle'&&run.nextMetaAt>Date.now()){
    clearTimeout(run.localTimer);
    run.localTimer=setTimeout(()=>void cycle(run),Math.max(1000,run.nextMetaAt-Date.now()+100));
    trace(bot,'NEXT MODEL ATTEMPT',`Retry scheduled for ${new Date(run.nextMetaAt).toLocaleTimeString()} (user-configured backoff; not a robot-wide idle order)`);
   }
   // Keep the last model failure visible until a model call really succeeds.
  }catch(error){
   const diagnosis=operatorFailure(error);run.last={...autonomyResult('task',false,error.message),diagnosis};
   $('autonomyFailure').textContent=`FAILED · ${diagnosis.code}\n${diagnosis.reason}\nNEXT: ${diagnosis.remedy}`;
   trace(bot,'UNFINISHED',diagnosis.reason+' · Next: '+diagnosis.remedy+' · No unverified completion is claimed');
   if(run.pendingAction==='creative_build'&&!run.creativePlan&&run.nextMetaAt>Date.now()&&!run.cancelled){
    run.groupNoProgress=0;
    trace(bot,'MUSE DESIGN WAITING',`Model access/backoff is not a navigation failure. Worker ${bot.name} retains its own saved assignment until ${new Date(run.nextMetaAt).toLocaleTimeString()}; no reassignment or duplicate geometry.`);
    clearTimeout(run.localTimer);run.localTimer=setTimeout(()=>void cycle(run),Math.max(1000,run.nextMetaAt-Date.now()+150));
   }else if(run.groupJobId&&['cleanup_boxes','creative_build'].includes(run.pendingAction)&&!run.cancelled){
    run.groupNoProgress=Math.min(15,run.groupNoProgress+1);
    if(run.groupNoProgress>=3){
     const holding=editor.items.some(o=>o.userData.storage?.type==='held'&&o.userData.storage.holderId===run.id);
     if(!holding){
      try{
       const handoff=await api.req('/api/robots/autonomy/group/result',{method:'POST',body:JSON.stringify({room:run.room,message_id:run.groupJobId,robot_id:run.id,outcome:'release',reason:String(error.message).slice(0,160)})});
       trace(bot,'GROUP REASSIGN',`Blocked worker released safely (${handoff.status}); another idle robot can try.`);
       stop(run.id,'group retry with another free robot',false);
       void dispatchPendingGroupTasks();
      }catch(handoffError){trace(bot,'GROUP RETAINED',handoffError.message);}
     }
    }else{
     clearTimeout(run.localTimer);
     run.localTimer=setTimeout(()=>void cycle(run),3000);
    }
   }
   if(run.pendingAction==='creative_build'&&!run.groupJobId&&!run.cancelled){
    clearTimeout(run.localTimer);run.localTimer=setTimeout(()=>void cycle(run),Math.max(1000,(run.nextMetaAt||0)-Date.now()+150,8000));
   }
   if(run.pendingAction==='furnish_room'&&run.lastPlanVariant){
    const prev=run.projectDeferred.find(p=>p.variant===run.lastPlanVariant);
    const attempts=Math.min(5,(prev?.attempts||0)+1);
    const retryAt=Date.now()+Math.min(120000,12000*2**(attempts-1));
    run.projectDeferred=[...run.projectDeferred.filter(p=>p.variant!==run.lastPlanVariant),
     {variant:run.lastPlanVariant,attempts,retryAt,reason:String(error.message).slice(0,110)}].slice(0,6);
    trace(bot,'FURNISHING DEFERRED',`${run.lastPlanVariant}: ${error.message}; trying another requested furnishing before retrying this one`);
    clearTimeout(run.localTimer);run.localTimer=setTimeout(()=>void cycle(run),1500);
   }
   if(run.recoveryAttempts[run.pendingAction])run.recoveryAttempts[run.pendingAction]=Math.max(1,run.recoveryAttempts[run.pendingAction]);
   report(run,bot,{action:run.pendingAction||'task'},'failed',diagnosis.reason);
  }finally{
   run.busy=false;update();
   if(!run.cancelled){
    try{await saveOrder(run,run.loop);}catch(error){trace(bot,'STATE NOT SAVED',error.message);}
   }
   if(!run.loop||!['agent','local_project'].includes(run.order.mode))stop(run.id,run.last?.status||'finished one cycle');
  }
 }
 const start=async(loop)=>{
  if(!api.online||!api.auth()){toast('Sign in to run autonomous tasks');return;}
  if(loop&&!['agent','local_project'].includes($('autonomyMode').value)){toast('Start loop supports Meta agents or bounded local projects.');return;}
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
  if(['build','house','preset','local_project'].includes(order.mode)&&!order.allowChanges){toast('Enable authorised scene changes for construction');return;}
  if(order.mode==='preset'&&!order.presetId){toast('Choose an account-owned saved preset');return;}
  if(order.mode==='agent'&&!order.goal){toast('Describe a goal for the autonomous agent');return;}
  if(order.mode==='local_project'&&!requestedHomeCount(order.goal)&&!localProjectSequence(order.goal).length){
   if(!canCleanupGoal(order.goal)&&!boxCleanupGoal(order.goal)){
    // Work orders panel is an explicit, confirmed human authorization; do
    // NOT demand a special object noun before passing the goal to Muse.
    if(!order.goal.trim()){toast('Describe an object or creative project to build');return;}
    order.variant='creative';
   }
  }
  const billable=order.mode==='agent'||order.mode==='assist';
  if(billable&&!await confirmAction(`This ${loop?'loop':'task'} will send billable Meta API requests${order.vision?' with six real head-camera images per decision':''}. ${loop?'Each decision repeats no more frequently than every '+order.interval+' seconds; this opted-in loop is saved on the server and resumes after browser refresh when the signed-in visible 3D scene loads. It does not run while the browser is closed.':'Only one cycle runs and will not auto-resume.'} Scene changes are ${order.allowChanges?'enabled for robot-built objects':'disabled'}.`,{title:'Enable autonomous robot operator?',confirmLabel:'Enable autonomy'}))return;
  if(!billable&&!await confirmAction(`The robot will ${order.mode} using scene tools${loop?' every '+order.interval+' seconds':''}. Creation is ${order.allowChanges?'enabled':'disabled'}.`,{title:'Start robot work order?',confirmLabel:'Start'}))return;
  stop(order.robotId,'replaced work order',false);
  const run=newRun(order,loop,bot);
  if(loop&&order.mode==='local_project'&&order.variant==='creative'&&creativeSessionDurationMs(order.goal))
   run.creativeDeadline=creativeSessionDeadline(order.goal,Date.now());
  try{await saveOrder(run,loop);}catch(error){toast('Cannot save robot work order: '+error.message);return;}
  savedOrders.set(run.id,{robot_id:run.id,order,state:stateOf(run),enabled:loop});
  runs.set(run.id,run);$('autonomyFailure').textContent='Working · awaiting verified scene tool results.';if(loop)run.timer=setInterval(()=>cycle(run),order.interval*1000);
  trace(bot,'START',`${loop?'Loop':'Once'} · mode ${order.mode} · goal ${order.goal} · 360 vision ${order.vision} · scene changes ${order.allowChanges} · cadence ${order.interval}s`);
  void cycle(run);update();
 };
 const startCityTeam=async(instruction,fromButton=false)=>{
  const intent=cityTeamIntent(instruction);
  if(!intent)return 0;
  const available=editor.items.filter(o=>{
   if(o.userData.editorKind!=='robot'||!editor.canEdit(o)||editor.controlledRobot?.()===o||o.userData.robotMission)return false;
   const current=runs.get(o.userData.editorId);
   return !current||(fromButton&&current.order.mode==='local_project'&&
    !canCleanupGoal(current.order.goal)&&(requestedHomeCount(current.order.goal)>0||localProjectSequence(current.order.goal).length>0));
  }).slice(0,8);
  const roles=cityRoles(intent,available.length);
  if(!roles.length){toast('City team: no idle authorised robots. Existing tasks have not been interrupted.');return 0;}
  const anchor={x:+available[0].position.x.toFixed(2),z:+available[0].position.z.toFixed(2)};
  const teamId='city-'+crypto.randomUUID(),label='City builders';let accepted=0;
  for(let index=0;index<roles.length;index++){
   const bot=available[index],id=bot.userData.editorId,role=roles[index];
   if(runs.has(id))stop(id,'human-requested city-team reassignment of generic construction project',false);
   const order=cleanAutonomyOrder({mode:'local_project',robotId:id,room:room(),goal:cityRoleGoal(role),allowChanges:true,vision:false,interval:180});
   const run=newRun(order,true,bot,{team:{id:teamId,role,anchor,label}});
   try{await saveOrder(run,true);}catch(error){trace(bot,'CITY ROLE REFUSED',error.message);continue;}
   savedOrders.set(id,{robot_id:id,order,state:stateOf(run),enabled:true});
   runs.set(id,run);run.timer=setInterval(()=>void cycle(run),order.interval*1000);
   trace(bot,'CITY ROLE ASSIGNED',`${role}: ${order.goal}; team ${teamId}. Uses physical validated scene tools, not conversation promises.`);
   void cycle(run);accepted++;
  }
  if(accepted)toast(`City team: ${accepted} robot(s) assigned housing / infrastructure / commons roles. See Work orders for scene receipts.`);
  update();return accepted;
 };
 $('autonomyCityTeam').onclick=async()=>{
  if(!api.online||!api.auth()){toast('Sign in to start city builders');return;}
  const ok=await confirmAction('Assign available idle, editable robots to a shared city project with houses, roads, pedestrian paths and a community area. Each object is permission-checked and saved. Existing named cleanup and non-construction work orders are preserved; generic local construction orders may be reassigned. Robots execute only while the signed-in browser scene is running.',{title:'Start collaborative city builders?',confirmLabel:'Start city team'});
  if(ok)void startCityTeam('@all start building a city with homes roads parks',true);
 };
 const handledChatMessages=new Set();
 let groupDispatchBusy=false;
 const groupDispatchDelays=new Map(),groupQueueReported=new Map();
 async function dispatchPendingGroupTasks(force=false){
  if(groupDispatchBusy||!api.online||!api.auth())return 0;
  groupDispatchBusy=true;let assigned=0;
  try{
   const reply=await api.req('/api/robots/autonomy/group/queue?room='+encodeURIComponent(room()));
   let humanMessages=null;
   for(const task of reply.tasks||[]){
    if(task.status==='blocked'&&groupQueueReported.get(task.source_message_id)!==task.updated){
     groupQueueReported.set(task.source_message_id,task.updated);
     emitLog(null,'GROUP BLOCKED',`${task.kind} needs intervention after ${task.attempts} failed delegations: ${task.detail}. A new explicit human request may start another job.`);
     toast('Group job blocked: see Work orders log for the exact reason.');
    }
    if(task.status!=='pending'||Number(task.retry_at||0)*1000>Date.now())continue;
    if(!force&&groupDispatchDelays.get(task.source_message_id)>Date.now())continue;
    groupDispatchDelays.set(task.source_message_id,Date.now()+10000);
    let selection=null,boxes=[];
    if(task.kind==='cleanup_boxes'){
     if([...runs.values()].some(r=>boxCleanupGoal(r.order.goal)))continue; // no competing box movers
     boxes=sceneBoxCopies(editor.items);
     if(!boxes.length){emitLog(null,'GROUP WAITING',`Task ${task.source_message_id}: no current Box copy scene objects; will inspect again.`);continue;}
     if(!humanMessages){
      try{humanMessages=(await api.req('/api/messages?room='+encodeURIComponent(room()))).messages||[];}
      catch(error){emitLog(null,'GROUP WAITING','Cannot verify human-named bin yet: '+error.message);continue;}
     }
     selection=resolveQueuedBin(editor.items,task.source_text,humanMessages);
     if(!selection.ready){emitLog(null,'GROUP WAITING',`${task.source_message_id}: ${selection.reason}; no wrong bin selected.`);continue;}
     if(!editor.canEdit(selection.target)){emitLog(null,'GROUP WAITING','Bin exists but is not editable by this operator');continue;}
    }
    // Named amendments are directed to exactly the scene robot named by the
    // human. If it is busy, leave the SQLite intent pending instead of
    // handing it to a random colleague or discarding the earlier assignment.
    const worker=task.kind==='named_creative_build'
     ?editor.items.find(bot=>bot.userData.editorKind==='robot'&&bot.userData.editorId===task.target_id&&
        editor.canEdit(bot)&&!runs.has(bot.userData.editorId)&&!bot.userData.robotMission)
     :chooseQueuedWorker(editor.items,[...runs.keys()],editor.controlledRobot?.()?.userData.editorId||'',
       bot=>editor.canEdit(bot),task.failed_worker_id,task.kind,selection?.target||null);
    if(!worker){emitLog(null,'GROUP WAITING',`Task ${task.source_message_id}: no free editable worker; preserving other projects.`);continue;}
    const id=worker.userData.editorId;
    const goal=task.kind==='cleanup_boxes'?boxCleanupProjectGoal(selection.targetName):task.source_text;
    const order=cleanAutonomyOrder({mode:'local_project',robotId:id,room:room(),goal,variant:['creative_build','named_creative_build'].includes(task.kind)?'creative':'',allowChanges:true,vision:false,interval:180});
    const run=newRun(order,true,worker);
    run.groupJobId=task.source_message_id;
    run.intentMessageId=task.source_message_id;
    if(['creative_build','named_creative_build'].includes(task.kind)){
     run.creativeDeadline=creativeSessionDeadline(task.source_text,Date.parse(task.created||''));
     if(run.creativeDeadline&&Date.now()>=run.creativeDeadline){
      trace(worker,'GROUP TIMED OUT','The shared work window elapsed before this robot became free; no late construction will start.');
      continue;
     }
    }
    run.cleanupBinId=selection?.target?.userData.editorId||'';
    try{
     await api.req('/api/robots/autonomy/group/claim',{method:'POST',body:JSON.stringify({room:room(),message_id:task.source_message_id,robot_id:id,target_id:task.kind==='named_creative_build'?task.target_id:run.cleanupBinId,order,state:stateOf(run)})});
    }catch(error){emitLog(worker,'GROUP CLAIM REFUSED',error.message+'; no scene task started');continue;}
    savedOrders.set(id,{robot_id:id,order,state:stateOf(run),enabled:true});
    runs.set(id,run);
    run.timer=setInterval(()=>void cycle(run),order.interval*1000);
    trace(worker,'GROUP DELEGATED',`Human message ${task.source_message_id}, ${task.kind}; free editable worker ${worker.name}; ${boxes.length} boxes; ${['creative_build','named_creative_build'].includes(task.kind)?'creative stage '+creativeRole(task.source_message_id):'bin '+(selection?.targetName||'(construction)')} · one atomic server claim.`);
    trace(worker,'ORDER COMMITTED',`SQLite group assignment and robot order saved together BEFORE physical movement.`);
    toast(`${worker.name}: ${task.kind==='cleanup_boxes'?'box cleanup':'construction'} accepted; follow physical receipts in Brain.`);
    void cycle(run);assigned++;
   }
  }catch(error){emitLog(null,'GROUP DISPATCH WAITING',error.message);}
  finally{groupDispatchBusy=false;}
  if(assigned)update();return assigned;
 }
 // Recheck pending work within seconds, independently of 180 s model-planning
 // intervals; the browser must remain signed in with its 3D scene loaded.
 let groupQueueTimer=setInterval(()=>void dispatchPendingGroupTasks(),3000);
 async function assignRoomFurnishing(bot,goal,origin='human instruction',options={}){
  const id=bot.userData.editorId;
  const order=cleanAutonomyOrder({mode:'local_project',robotId:id,room:room(),goal,allowChanges:true,vision:false,interval:180});
  const old=runs.get(id);
  // Do not discard an old mission until the new order is accepted by the
  // server. Preserve its scene IDs and pending state in the old run on failure.
  const run=newRun(order,true,bot);
  run.furnishingColors={...(options.colours||{})};run.intentMessageId=String(options.messageId||'').slice(0,100);
  trace(bot,'INTENT ACCEPTED',`${origin}: ${roomFurnishingSequence(goal).join(' + ')}${run.intentMessageId?' · message '+run.intentMessageId:''}`);
  try{await saveOrder(run,true);}catch(error){trace(bot,'FURNISHING NOT STARTED',error.message);return 0;}
  if(old)stop(id,'superseded by explicit furnished-room instruction',false);
  savedOrders.set(id,{robot_id:id,order,state:stateOf(run),enabled:true});runs.set(id,run);
  run.timer=setInterval(()=>void cycle(run),order.interval*1000);
  trace(bot,'ORDER COMMITTED',`Persistent furnishing order stored by server; ${roomFurnishingSequence(goal).join(' + ')} · ${origin}`);
  trace(bot,'ROOM FURNISHING ASSIGNED',`${roomFurnishingSequence(goal).join(' + ')} from ${origin}; replacing ${old?.order.mode||'idle'}. Every item requires an actual floor and server scene receipt.`);
  toast(`${bot.name}: furnishing work order saved. The Brain log will report real placements or specific blockers.`);
  void cycle(run);update();return 1;
 }
 async function startChatProjects(message){
  if(!message?.id||handledChatMessages.has(message.id)||!api.online||!api.auth()||(message.room_id&&message.room_id!==room()))return 0;
  // Never fall through to a misleading model promise when the sender cannot
  // operate the addressed robot. Real scene-edit permissions are required.
  // Explicit @all instructions become server-durable pending intents, even
  // when no robot is free or a named bin has not loaded yet. Chat replies are
  // never a substitute for physical tool receipts.
  const groupCleanup=groupBoxCleanupInstruction(message.text);
  const groupCreative=groupCreativeIntent(message.text)||(/^\s*@(?:all|everyone)\b/i.test(message.text)&&/\b(?:please|can you|could you|start|now|go ahead)\b/i.test(message.text)&&/\b(?:build|create|make|design|construct|assemble)\b/i.test(message.text)&&!/\b(?:do not|don't|never|stop|cancel)\b/i.test(message.text)?message.text:null);
  const groupBuild=groupCreative||(!cityTeamIntent(message.text)?chatConstructionInstruction(message.text):null);
  if(groupCleanup||groupBuild){
   handledChatMessages.add(message.id);
   try{
    const queued=await api.req('/api/robots/autonomy/group/queue',{method:'POST',body:JSON.stringify({room:room(),message_id:message.id})});
    emitLog(null,'GROUP QUEUED',`Human message ${message.id}; task ${queued.task.kind}; ${queued.deduplicated?'merged with pending job':'new durable intent'}; will dispatch only through checked scene tools.`);
    await dispatchPendingGroupTasks(true);
    return 1; // Suppress five non-executable @all acknowledgement speeches.
   }catch(error){emitLog(null,'GROUP QUEUE FAILED',error.message);toast('Group job not saved: '+error.message);return -1;}
  }
  // New @all destination corrections update the existing cleanup order
  // rather than becoming five conversational acknowledgements.
  if(groupBinClarification(message.text)){
   const active=[...runs.values()].filter(r=>boxCleanupGoal(r.order.goal)&&editor.canEdit(robotFor(r.id)));
   if(active.length){
    handledChatMessages.add(message.id);
    let history=[];
    try{history=(await api.req('/api/messages?room='+encodeURIComponent(room()))).messages||[];}
    catch(error){emitLog(null,'BIN UPDATE FAILED',error.message);return 0;}
    const selected=selectCleanupTarget(editor.items,message.text,history);
    if(!selected.targetName)return 0;
    let accepted=0;
    for(const run of active){
     const bot=robotFor(run.id);
     const correct=async()=>{
      if(run.cancelled)return;
      const oldGoal=run.order.goal,oldId=run.cleanupBinId;
      run.order.goal=boxCleanupProjectGoal(selected.targetName);
      run.cleanupBinId=selected.target?.userData.editorId||'';
      try{
       if(run.groupJobId){
        if(!run.cleanupBinId)throw Error('Corrected bin must be present before updating the assigned group task');
        await api.req('/api/robots/autonomy/group/retarget',{method:'POST',body:JSON.stringify({room:run.room,message_id:run.groupJobId,
         clarification_message_id:message.id,robot_id:run.id,target_id:run.cleanupBinId,order:run.order,state:stateOf(run)})});
       }else await saveOrder(run,true);
       trace(bot,'BIN TARGET UPDATED',`${selected.targetName}: ${selected.reason}; server-saved target ${run.cleanupBinId||'not yet loaded'}`);
       if(!run.busy)void cycle(run);
      }catch(error){run.order.goal=oldGoal;run.cleanupBinId=oldId;trace(bot,'BIN UPDATE FAILED',error.message);}
     };
     // Never change an in-progress carrying action's destination mid-step.
     // The authenticated correction is applied when that physical step ends.
     if(run.busy){
      let attempts=0;
      const waitForIdle=()=>{
       if(run.cancelled)return;
       if(run.busy){
        if(attempts++<150)setTimeout(waitForIdle,1000);
        else trace(bot,'BIN UPDATE DEFERRED','Previous physical action did not finish within the correction window; retry the human clarification.');
       }else void correct();
      };
      trace(bot,'BIN UPDATE WAITING','Human target correction held until current physical action finishes.');
      setTimeout(waitForIdle,250);
     }else await correct();
     accepted++;
    }
    return accepted;
   }
   handledChatMessages.add(message.id);
   await dispatchPendingGroupTasks(true);
   return 1; // Pending task now has a new human-authored bin name.
  }
  // The named human creative command can also be an AMENDMENT to an existing
  // project. Queue it durably, with exact robot+realm identity; do not replace
  // a currently building robot or reinterpret a peer suggestion as authority.
  const namedCreative=addressedCreativeRobot(message.text,editor.items.filter(o=>o.userData.editorKind==='robot')
    .map(o=>({id:o.userData.editorId,name:o.name,kind:'robot'})));
  if(namedCreative){
   const namedBot=editor.items.find(o=>o.userData.editorId===namedCreative.robotId);
   handledChatMessages.add(message.id);
   if(!namedBot||!editor.canEdit(namedBot)){
    emitLog(namedBot,'NAMED TASK REFUSED','Current operator lacks scene robot permissions; no work order created');return -1;
   }
   try{
    const queued=await api.req('/api/robots/autonomy/group/queue',{method:'POST',body:JSON.stringify({room:room(),message_id:message.id})});
    emitLog(namedBot,'NAMED CREATIVE QUEUED',`Saved human message ${message.id}; ${queued.task.kind}; ${queued.deduplicated?'deduplicated':'pending assignment'}; robot ID ${namedCreative.robotId}.`);
    await dispatchPendingGroupTasks(true);
    return 1;
   }catch(error){emitLog(namedBot,'NAMED TASK NOT QUEUED',error.message);toast('Named creative task not saved: '+error.message);return -1;}
  }
  const denied=editor.items.find(o=>o.userData.editorKind==='robot'&&!editor.canEdit(o)&&
   (namedRoomFurnishingInstruction(message.text,o.name)||namedWorkContinuation(message.text,o.name)||
    namedFurnishingPreference(message.text,o.name)));
  if(denied){handledChatMessages.add(message.id);
   trace(denied,'TASK NOT AUTHORISED','This browser cannot edit or operate the named robot. No work order was saved and no action was attempted.');
   toast(`${denied.name}: only a robot operator with scene edit permission can start this action.`);
   return -1;
  }
  const answered=editor.items.find(o=>o.userData.editorKind==='robot'&&editor.canEdit(o)&&
   runs.has(o.userData.editorId)&&runs.get(o.userData.editorId).askedPreferences&&namedRoofChoice(message.text,o.name));
  if(answered){
   handledChatMessages.add(message.id);
   const run=runs.get(answered.userData.editorId);
   if(requestedHomeCount(run.order.goal)>run.completedHouses.length){
    run.roofPreference=namedRoofChoice(message.text,answered.name);
    try{await saveOrder(run,true);trace(answered,'STYLE SAVED',`Next new house will use ${run.roofPreference} roof; existing structures unchanged.`);}
    catch(error){trace(answered,'STYLE NOT SAVED',error.message);}
   }return 1;
  }
  const assigned=editor.items.find(o=>o.userData.editorKind==='robot'&&editor.canEdit(o)&&(chatBoxCleanupInstruction(message.text,o.name)||chatCanCleanupInstruction(message.text,o.name)));
  if(assigned){
   handledChatMessages.add(message.id);
   const id=assigned.userData.editorId,goal=chatBoxCleanupInstruction(message.text,assigned.name)||chatCanCleanupInstruction(message.text,assigned.name);
   const boxes=boxCleanupGoal(goal);
   const order=cleanAutonomyOrder({mode:'local_project',robotId:id,room:room(),goal,allowChanges:true,vision:false,interval:180});
   // An explicit named human instruction supersedes an unrelated old task.
   const old=runs.get(id);if(old)stop(id,'new explicit object-cleanup instruction',false);
   const run=newRun(order,true,assigned);
   try{await saveOrder(run,true);}catch(error){trace(assigned,'CLEANUP NOT STARTED',error.message);return 0;}
   savedOrders.set(id,{robot_id:id,order,state:stateOf(run),enabled:true});
   runs.set(id,run);run.timer=setInterval(()=>void cycle(run),order.interval*1000);
   trace(assigned,'CLEANUP ASSIGNED',`Human request became an executable, persistent ${boxes?'box':'can'}-clearing order; older ${old?.order.mode||'idle'} work was superseded`);
   toast(`${assigned.name}: ${boxes?'box':'can'} cleanup saved; the action log will show actual pickup and verified storage.`);
   void cycle(run);update();return 1;
  }
  // A named answer to an optional design question updates the SAME saved
  // project. Colour never becomes a prerequisite for physical execution.
  const preferenceBot=editor.items.find(o=>o.userData.editorKind==='robot'&&editor.canEdit(o)&&
   namedFurnishingPreference(message.text,o.name));
  if(preferenceBot){
   const choice=namedFurnishingPreference(message.text,preferenceBot.name);
   let run=runs.get(preferenceBot.userData.editorId);
   if(run&&run.order.allowChanges&&roomFurnishingSequence(run.order.goal).includes(choice.variant)){
    handledChatMessages.add(message.id);
    const already=run.projectPlaced.find(p=>p.variant===choice.variant);
    if(already){trace(preferenceBot,'PREFERENCE NOT APPLIED',choice.colour+' '+choice.variant+' requested after that item was saved; existing furniture unchanged.');return 1;}
    run.furnishingColors[choice.variant]=choice.hex;
    try{await saveOrder(run,true);trace(preferenceBot,'PREFERENCE SAVED',choice.variant+' = '+choice.colour+'; no waiting for other preferences');
     if(!run.busy)void cycle(run);
    }catch(error){trace(preferenceBot,'PREFERENCE SAVE FAILED',error.message);}
    return 1;
   }
   // A colour reply can continue the previously authorised construction if
   // the original user request and a concrete promise are BOTH in room chat.
   let history=[];
   try{history=(await api.req('/api/messages?room='+encodeURIComponent(room()))).messages||[];}
   catch(error){trace(preferenceBot,'PREFERENCE NOT SAVED','Unable to verify earlier authorisation: '+error.message);return 0;}
   const stamp=Date.parse(message.created)||Date.now();
   const promised=promisedRoomFurnishing(history,preferenceBot.name,stamp);
   if(recentHumanFurnishingAuthority(history,preferenceBot.name,stamp)&&promised.includes(choice.variant)){
    handledChatMessages.add(message.id);
    return assignRoomFurnishing(preferenceBot,`@${preferenceBot.name} please add ${promised.join(' and ')} to this room`,
     'human-authorised preference continuation',{colours:{[choice.variant]:choice.hex},messageId:message.id});
   }
   trace(preferenceBot,'PREFERENCE NOT ACTIONABLE','No current project and no recent direct human furnishing order; did not invent authorisation.');
  }
  const followUp=editor.items.find(o=>o.userData.editorKind==='robot'&&editor.canEdit(o)&&
   namedWorkContinuation(message.text,o.name));
  if(followUp){
   const id=followUp.userData.editorId,active=runs.get(id);
   if(active&&active.order.allowChanges&&roomFurnishingSequence(active.order.goal).length){
    handledChatMessages.add(message.id);
    trace(followUp,'WORK ORDER REMINDED',`Rechecking saved ${roomFurnishingSequence(active.order.goal).join(' + ')} project immediately. No second work order created.`);
    clearTimeout(active.localTimer);
    if(!active.busy)void cycle(active);
    else trace(followUp,'WORK ORDER BUSY','Current verified editor action is still running; no duplicate action started');
    return 1;
   }
   // Recover a concrete, recent model promise ONLY when this authenticated
   // human now explicitly instructs it to happen. A robot statement alone
   // can never create an editor mutation.
   let messages=[];
   try{messages=(await api.req('/api/messages?room='+encodeURIComponent(room()))).messages||[];}
   catch(error){trace(followUp,'FOLLOW-UP BLOCKED','Cannot read recent room dialogue: '+error.message);return 0;}
   const items=promisedRoomFurnishing(messages,followUp.name,Date.parse(message.created)||Date.now());
   if(items.length){
    handledChatMessages.add(message.id);
    return assignRoomFurnishing(followUp,`@${followUp.name} please add ${items.join(' and ')} to this room`,'explicit human follow-up to recent robot promise',{messageId:message.id});
   }
   trace(followUp,'FOLLOW-UP NEEDS TARGET','No saved furnishing job or recent concrete furnishing promise was found. Ask for specific objects to place; no scene was modified.');
   return 0;
  }
  const roomBuilder=editor.items.find(o=>o.userData.editorKind==='robot'&&editor.canEdit(o)&&
   namedRoomFurnishingInstruction(message.text,o.name));
  if(roomBuilder){
   handledChatMessages.add(message.id);
   return assignRoomFurnishing(roomBuilder,namedRoomFurnishingInstruction(message.text,roomBuilder.name),'direct human furnishing instruction',{messageId:message.id});
  }
  // A saved direct human request for an actual primitive is immediately
  // executable, rather than returning an imaginary 'try a cube' suggestion.
  const address=addressedCreativeRobot(message.text,editor.items.filter(o=>o.userData.editorKind==='robot')
    .map(o=>({id:o.userData.editorId,name:o.name,kind:'robot'})));
  const creativeBot=address&&editor.items.find(o=>o.userData.editorId===address.robotId&&o.userData.editorKind==='robot');
  if(creativeBot){
   handledChatMessages.add(message.id);
   if(!editor.canEdit(creativeBot)){
    trace(creativeBot,'CREATIVE NOT AUTHORISED','Current operator cannot edit this robot in realm '+room());return -1;
   }
   const id=creativeBot.userData.editorId,old=runs.get(id);
   if(old&&old.groupJobId){trace(creativeBot,'CREATIVE REQUEST DEFERRED','Robot has a different active group job; no existing work discarded.');return -1;}
   const goal=address.goal;
   const order=cleanAutonomyOrder({mode:'local_project',robotId:id,room:room(),goal,variant:'creative',allowChanges:true,vision:false,interval:180});
   const run=newRun(order,true,creativeBot);run.intentMessageId=message.id;
   if(creativeSessionDurationMs(goal))run.creativeDeadline=creativeSessionDeadline(goal,Date.now());
   try{await saveOrder(run,true);}catch(error){trace(creativeBot,'CREATIVE NOT STARTED',error.message);return -1;}
   if(old)stop(id,'superseded by a new human creative project',false);
   savedOrders.set(id,{robot_id:id,order,state:stateOf(run),enabled:true});runs.set(id,run);
   run.timer=setInterval(()=>void cycle(run),order.interval*1000);
   trace(creativeBot,'CREATIVE GOAL COMMITTED',`Real ID ${id}; realm ${room()}; saved human message ${message.id}. Muse designs from this goal, not a canned command list.`);
   void cycle(run);update();return 1;
  }
  // A fresh direct construction request outranks the robot's old generic
  // agent order. A conversation reply alone never authorises scene edits.
  const namedBuilder=editor.items.find(o=>o.userData.editorKind==='robot'&&editor.canEdit(o)&&
   chatNamedConstructionInstruction(message.text,o.name));
  if(namedBuilder){
   handledChatMessages.add(message.id);
   const id=namedBuilder.userData.editorId,goal=chatNamedConstructionInstruction(message.text,namedBuilder.name);
   const old=runs.get(id);
   const order=cleanAutonomyOrder({mode:'local_project',robotId:id,room:room(),goal,allowChanges:true,vision:false,interval:180});
   if(old)stop(id,'superseded by a fresh direct human construction request',false);
   const run=newRun(order,true,namedBuilder);
   try{await saveOrder(run,true);}catch(error){trace(namedBuilder,'BUILD NOT STARTED','Could not save new work order: '+error.message);return 0;}
   savedOrders.set(id,{robot_id:id,order,state:stateOf(run),enabled:true});runs.set(id,run);
   run.timer=setInterval(()=>void cycle(run),order.interval*1000);
   trace(namedBuilder,'DIRECT BUILD ASSIGNED',`New human instruction replaces ${old?.order.mode||'idle'} order. Goal: ${goal}. Saving object IDs and checking building clearance.`);
   toast(`${namedBuilder.name}: new house project saved. Follow verified construction in Work orders.`);
   void cycle(run);update();return 1;
  }
  const transfer=editor.items.find(o=>o.userData.editorKind==='robot'&&editor.canEdit(o)&&
   chatSingleObjectTransfer(message.text,o.name,editor.items.map(item=>({id:item.userData.editorId,name:item.name,kind:item.userData.editorKind}))));
  if(transfer){
   handledChatMessages.add(message.id);
   const named=chatSingleObjectTransfer(message.text,transfer.name,editor.items.map(item=>({id:item.userData.editorId,name:item.name,kind:item.userData.editorKind})));
   const id=transfer.userData.editorId;
   const order=cleanAutonomyOrder({mode:'local_project',robotId:id,room:room(),goal:message.text,allowChanges:true,vision:false,interval:180,sourceId:named.sourceId,destinationId:named.destinationId});
   const old=runs.get(id);if(old)stop(id,'new explicit named object transfer',false);
   const run=newRun(order,true,transfer);
   try{await saveOrder(run,true);}catch(error){trace(transfer,'TRANSFER NOT STARTED',error.message);return 0;}
   savedOrders.set(id,{robot_id:id,order,state:stateOf(run),enabled:true});
   runs.set(id,run);run.timer=setInterval(()=>void cycle(run),order.interval*1000);
   trace(transfer,'TRANSFER ASSIGNED',`Grounded ${named.sourceName} → ${named.destinationName} into exact scene IDs; older order superseded`);
   void cycle(run);update();return 1;
  }
  if(cityTeamIntent(message?.text)){handledChatMessages.add(message.id);return startCityTeam(message.text);}
  return 0; // Other chat is conversation, not an executable work-order instruction.
 }
 $('autonomyOnce').onclick=()=>void start(false);
 $('autonomyStart').onclick=()=>void start(true);
 $('autonomyStop').onclick=()=>stop($('autonomyRobot').value,'user stop');
 $('autonomyStopAll').onclick=()=>stopAll(true);
 $('autonomyRefresh').onclick=refresh;
 $('routineToolButton').addEventListener('click',refresh);
 $('autonomyRobot').addEventListener('change',()=>{const saved=savedOrders.get($('autonomyRobot').value);if(saved)presentSaved(saved.order);});
 window.addEventListener('solvi:autonomy-ready',()=>{void loadMetaPrefs();void loadSaved();});
 window.addEventListener('solvi:meta-key-updated',()=>{
  for(const run of runs.values())if(run.order.variant==='creative'&&!run.creativePlan){
   run.metaFailure='model-key-updated';run.nextMetaAt=0;
  }
  void checkMetaStatus();
 });
 window.addEventListener('solvi:room-changed',()=>{restoreSequence++;stopAll(false);});
 window.addEventListener('solvi:session-lost',()=>{restoreSequence++;stopAll(false);});
 window.addEventListener('pagehide',()=>{restoreSequence++;clearInterval(groupQueueTimer);stopAll(false);});
 window.addEventListener('pageshow',event=>{if(event.persisted){groupQueueTimer=setInterval(()=>void dispatchPendingGroupTasks(),3000);void loadSaved();}});
 refresh();return {stopAll,refresh,loadSaved,startChatProjects,isActive:id=>runs.has(id)};
}
