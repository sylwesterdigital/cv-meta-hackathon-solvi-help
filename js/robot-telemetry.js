// Locally measured client scene coordinates, not claims inferred from robot speech.
// Route validity comes from the actual movement controller and final waypoint.
const point=p=>({x:Number(p?.x)||0,z:Number(p?.z)||0});
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function plannedRouteLength(start,waypoints=[]){
 let previous=point(start),meters=0;
 for(const node of waypoints){const next=point(node);meters+=distance(previous,next);previous=next;}
 return Number(meters.toFixed(3));
}
export function newMovementTelemetry(robot,taskId){
 const start=point(robot.position);
 return {taskId:taskId||'',start,previous:start,last:start,observedMeters:0,
   largestStep:0,samples:1,startedAt:Date.now(),plannedMeters:0,
   replans:0,routeSegments:0};
}
export function sampleMovementTelemetry(state,robot){
 if(!state||!robot)return;
 const latest=point(robot.position),delta=distance(state.previous,latest);
 if(delta>.0001){state.observedMeters+=delta;state.largestStep=Math.max(state.largestStep,delta);state.samples++;}
 state.previous=latest;state.last=latest;
}
export function missionMovementEvidence(state,robot,route,status){
 if(!robot)return null;
 if(state)sampleMovementTelemetry(state,robot);
 const final=point(robot.position),destination=route?.destination?point(route.destination):null;
 const distanceToRouteEnd=destination?distance(final,destination):null;
 const isMovementTask=!!route&&!route.blocked&&destination&&status!=='blocked';
 const verified=!!(isMovementTask&&distanceToRouteEnd<=.38&&state
   &&(state.observedMeters>.05||distance(state.start,destination)<=.38)&&state.largestStep<=3);
 const report={coordinateSource:'client scene measured robot.position',status,taskId:state?.taskId||'',
   startedAt:state?.startedAt?new Date(state.startedAt).toISOString():null,
   origin:state?.start||null,finalPosition:final,routeDestination:destination,
   distanceToRouteEndMeters:distanceToRouteEnd===null?null:+distanceToRouteEnd.toFixed(3),
   actualTravelledMeters:+(state?.observedMeters||0).toFixed(3),
   plannedRouteMeters:+(state?.plannedMeters||0).toFixed(3),
   largestFrameStepMeters:+(state?.largestStep||0).toFixed(3),
   sampledSteps:state?.samples||0,routeSegments:state?.routeSegments||0,replans:state?.replans||0,
   abruptMovementDetected:!!(state&&state.largestStep>3),arrivalVerifiedByClientPosition:verified};
 return report;
}
export function shouldRejectClaimedArrival(evidence,status){
 return ['arrived','sitting','procedural-sitting','coffee-visit'].includes(status)
   && evidence?.routeDestination&&!evidence.arrivalVerifiedByClientPosition;
}
