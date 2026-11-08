// A bounded, portable chassis/wheel blueprint derived from the Meta Vehicle Lab
// reference. This is a SOLVI assembly, not a second physics engine.
export const VEHICLE_PRESETS=Object.freeze({
 'City Car':{name:'City Car',length:3.7,width:1.7,height:.7,wheelRadius:.38,wheelOffset:1.18,wheels:4,paint:'#f25fa4'},
 'Explorer Rover':{name:'Explorer Rover',length:4.5,width:2.1,height:.85,wheelRadius:.56,wheelOffset:1.5,wheels:6,paint:'#7dc8ae'},
 'Delivery Van':{name:'Delivery Van',length:5.7,width:2.05,height:1.35,wheelRadius:.46,wheelOffset:1.9,wheels:4,paint:'#f7c76b'},
 'Concept Racer':{name:'Concept Racer',length:4.2,width:1.9,height:.42,wheelRadius:.4,wheelOffset:1.45,wheels:4,paint:'#8e92ff'}
});
const number=(value,fallback,min,max)=>{const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;};
export function cleanVehicleBlueprint(value={}){
 const d=VEHICLE_PRESETS['City Car'];
 const length=number(value.length,d.length,1.5,12),width=number(value.width,d.width,.7,5),height=number(value.height,d.height,.22,4);
 const wheelRadius=number(value.wheelRadius,d.wheelRadius,.12,1.5);
 return {name:String(value.name||d.name).replace(/[\x00-\x1f<>]/g,'').trim().slice(0,72)||'Vehicle',length,width,height,
  wheels:[4,6,8].includes(Number(value.wheels))?Number(value.wheels):4,
  wheelRadius,wheelOffset:number(value.wheelOffset,d.wheelOffset,.35,Math.max(.35,length*.42)),
  paint:/^#[0-9a-f]{6}$/i.test(value.paint||'')?value.paint:d.paint,
  wheelColor:/^#[0-9a-f]{6}$/i.test(value.wheelColor||'')?value.wheelColor:'#222935',
  chassisModel:/^\/api\/scene\/models\/[a-f0-9-]{16,70}\.(glb|fbx)$/.test(String(value.chassisModel||''))?String(value.chassisModel):''};
}
export function vehiclePartBlueprint(input){const p=cleanVehicleBlueprint(input),parts=[];
 const clearance=p.wheelRadius*.9,chassisY=clearance+p.height*.52;
 parts.push({kind:p.chassisModel?'model':'cube',name:'Chassis',width:p.width,height:p.height,depth:p.length,x:0,y:chassisY,z:0,color:p.paint,model:p.chassisModel});
 // The cabin and wheels remain independently editable and collidable.
 parts.push({kind:'cube',name:'Cabin',width:p.width*.79,height:Math.max(.25,p.height*.8),depth:p.length*.43,x:0,y:clearance+p.height*1.34,z:-p.length*.04,color:p.paint});
 const positions=p.wheels===4?[-p.wheelOffset,p.wheelOffset]:p.wheels===6?[-p.wheelOffset,0,p.wheelOffset]:[-p.wheelOffset,-p.wheelOffset/3,p.wheelOffset/3,p.wheelOffset];
 for(let axle=0;axle<positions.length;axle++)for(const side of [-1,1])parts.push({kind:'cylinder',name:`Wheel ${axle+1} ${side<0?'L':'R'}`,
  radius:p.wheelRadius,width:p.wheelRadius*2,depth:p.wheelRadius*2,height:Math.max(.18,p.width*.13),x:side*(p.width*.5+.06),y:p.wheelRadius,z:positions[axle],color:p.wheelColor,rotation:[0,0,Math.PI/2]});
 return {blueprint:p,parts};
}
