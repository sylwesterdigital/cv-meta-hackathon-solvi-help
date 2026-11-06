// v0.2.210: pure, bounded local exploration policy. Never treats the scene
// index as visual evidence; all movement is checked by the existing A* router.
export const LIFE_TICK_MS=6000;
export const LIFE_LEASE_MS=22000;
export function lifeCanStart(robot,{controlled=false,workOrder=false}={}){
 const u=robot?.userData||{};
 return u.editorKind==='robot'&&u.robotBrain?.initiativeMove===true&&!controlled&&!workOrder&&
  !u.robotMission&&!u.robotGoal&&!u.robotLocalMotion&&!u.robotRemoteMotion&&!u.robotCarry&&
  !u.robotSeated&&!u.robotJumpActive&&!(Number(u.robotLifePauseUntil)>Date.now());
}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function lifeCandidates(robot,objects=[],history=[],step=0){
 const here=robot?.position;
 if(!here||![here.x,here.z].every(Number.isFinite))return [];
 const past=new Set(history.slice(-36).map(h=>String(h.targetId||'')));
 const nearby=(objects||[]).filter(o=>o!==robot&&o?.userData?.editorId&&
   o.visible!==false&&o.position&&[o.position.x,o.position.z].every(Number.isFinite)&&
   !['light','floor','ceiling','wall'].includes(o.userData.editorKind)&&
   !o.userData.inventory?.storage&&!o.userData.robotCarry);
 const choices=[];
 for(const object of nearby){
  const kind=object.userData.editorKind,id=object.userData.editorId;
  const d=distance(here,object.position);
  if(d<7||d>35||past.has(id))continue;
  const dx=here.x-object.position.x,dz=here.z-object.position.z;
  const separation=kind==='robot'?2.1:3.1;
  const point={x:object.position.x+dx/d*separation,z:object.position.z+dz/d*separation};
  const novelty=kind==='robot'?3:2;
  choices.push({targetId:id,targetName:String(object.name||kind).slice(0,90),kind,point,
   score:novelty+Math.min(d,25)/25+(kind==='robot'&&step%4===0?1.5:0)});
 }
 choices.sort((a,b)=>b.score-a.score||a.targetId.localeCompare(b.targetId));
 // Rotate the heading after every attempt to explore genuinely new ground.
 // No single random 2m shuffle and no unsafe direct position mutation.
 const bearings=[0,Math.PI*.46,-Math.PI*.52,Math.PI*.93,-Math.PI*.94,Math.PI*.23,-Math.PI*.25];
 for(let i=0;i<4;i++){
  const angle=(Number(robot.rotation?.y)||0)+bearings[(step+i)%bearings.length];
  const metres=[13,16,11,19][(step+i)%4];
  const point={x:here.x+Math.sin(angle)*metres,z:here.z+Math.cos(angle)*metres};
  if(history.slice(-8).some(h=>h.point&&distance(point,h.point)<5))continue;
  choices.push({targetId:'',targetName:'unvisited ground',kind:'explore',point,score:0});
 }
 return choices.slice(0,8);
}
export function lifeResult(status,start,end){
 const metres=(start&&end)?distance(start,end):0;
 return {status:['arrived','blocked','failed','partial','stopped'].includes(status)?status:'failed',
   metres:Number.isFinite(metres)?Math.round(metres*10)/10:0,
   moved:Number.isFinite(metres)&&metres>=1.5};
}
