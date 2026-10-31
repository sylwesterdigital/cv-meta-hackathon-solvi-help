import {confirmAction} from './app-dialogs.js';
// Explicitly opt-in, in-tab robot recurring actions. Not a server scheduler.
const $=id=>document.getElementById(id);
export function initRobotRoutines({editor,room,toast,postDiscussion,captureObservation}){
 const panel=$('robotRoutinePanel'),agent=$('routineRobot'),target=$('routineTarget'),action=$('routineAction'),cadence=$('routineCadence'),topic=$('routineTopic'),status=$('routineStatus');
 const routines=new Map();
 function candidates(){return editor.items.filter(item=>item.userData.editorKind==='robot'&&editor.canEdit(item));}
 function refresh(){const prev=agent.value,selectedTarget=target.value;
  agent.replaceChildren(...candidates().map(o=>new Option(o.name,o.userData.editorId)));if(prev)agent.value=prev;
  target.replaceChildren(...editor.items.filter(o=>o!==candidates().find(r=>r.userData.editorId===agent.value)).map(o=>new Option(o.name,o.userData.editorId)));if(selectedTarget)target.value=selectedTarget;
  status.textContent=[...routines.values()].map(r=>`${r.robotName}: ${r.action} ${r.targetName} · ${r.interval}s`).join(' · ')||'No recurring tasks running.';
 }
 function stop(id){const task=routines.get(id);if(!task)return;clearInterval(task.timer);routines.delete(id);refresh();}
 function stopAll(){for(const id of [...routines.keys()])stop(id);}
 async function tick(task){
  if(task.busy||document.hidden||room()!==task.room)return;
  const bot=editor.items.find(o=>o.userData.editorId===task.robotId),goal=editor.items.find(o=>o.userData.editorId===task.targetId);
  if(!bot||!goal||!editor.canEdit(bot)){stop(task.robotId);return;}
  task.busy=true;
  try{
   const distance=Math.hypot(bot.position.x-goal.position.x,bot.position.z-goal.position.z);
   if(task.action==='follow'&&distance>2.1){
    const dx=bot.position.x-goal.position.x,dz=bot.position.z-goal.position.z;
    const factor=1.55/Math.max(.001,distance);
    editor.routeRobot(bot,{x:goal.position.x+dx*factor,z:goal.position.z+dz*factor});
   }else if(task.action==='observe'&&distance<25){
    await captureObservation(bot,goal);
   }else if(task.action==='discuss'&&Date.now()-task.lastRun>=task.interval*1000){
    task.lastRun=Date.now();await postDiscussion(bot,goal,task.topic);
   }
  }catch(error){status.textContent='Routine error: '+error.message;}
  finally{task.busy=false;}
 }
 $('routineToolButton').onclick=()=>{panel.hidden=false;refresh();};
 $('routineClose').onclick=()=>panel.hidden=true;
 agent.onchange=refresh;
 $('routineStart').onclick=async()=>{
  const bot=candidates().find(o=>o.userData.editorId===agent.value),goal=editor.items.find(o=>o.userData.editorId===target.value);
  if(!bot||!goal||bot===goal)return toast('Choose different robot and target');
  const mode=action.value;const seconds=mode==='follow'?Math.max(6,Number(cadence.value)||10):Math.max(60,Number(cadence.value)||120);
  if(mode==='discuss'&&!topic.value.trim())return toast('Enter a discussion subject first');
  if(mode==='discuss'&&!await confirmAction('This recurring discussion sends billable AI requests while this browser tab is open.',{title:'Start recurring AI discussion?',confirmLabel:'Start discussion'}))return;
  stop(bot.userData.editorId);
  const task={robotId:bot.userData.editorId,robotName:bot.name,targetId:goal.userData.editorId,targetName:goal.name,action:mode,interval:seconds,topic:topic.value.trim().slice(0,240),room:room(),lastRun:0,busy:false,timer:null};
  routines.set(task.robotId,task);task.timer=setInterval(()=>tick(task),task.interval*1000);tick(task);refresh();
 };
 $('routineStop').onclick=()=>{stop(agent.value);toast('Recurring task stopped');};
 $('routineStopAll').onclick=stopAll;
 window.addEventListener('solvi:room-changed',stopAll);
 window.addEventListener('pagehide',stopAll);
 return {stopAll};
}
