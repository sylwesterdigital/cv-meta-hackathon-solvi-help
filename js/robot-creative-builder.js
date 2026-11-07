// Human-authorised, bounded creative architecture. Design data only: editor
// owns geometry, physics, ownership, movement and server-acknowledged saves.
// Stable plans let a robot resume after a reload without re-planning old parts.
const BUILD=/(?:\b(?:build|building|construct|constructing|creat\w*|make|add|place|design|erect)\b)/i;
const STRUCTURE=/\b(?:mega\s*str\w*|str\w*ctures?|architectur\w*|towers?|arches?|bridges?|pavilions?|sculptures?|landmarks?|monuments?|yellow\s+cubes?|cubes?|procedural\s+(?:api|creation|objects?)|new\s+realms?)\b/i;
const NEGATIVE=/\b(?:do\s+not|don't|never|stop|cancel|avoid|without)\s+(?:\w+\s+){0,4}(?:build|create|construct|make|add|place|start|design)\b/i;
export function creativeBuildIntent(text=''){
 const value=String(text||'').trim().slice(0,1800);
 if(!BUILD.test(value)||!STRUCTURE.test(value)||NEGATIVE.test(value))return null;
 // “can you create a cube?” is an explicit request; a discussion about a
 // possible cube is not. Only a saved authenticated human message can use it.
 if(/\b(?:maybe|what\s+if|would\s+it\s+be\s+possible|imagine\s+if)\b/i.test(value)&&!/(?:\bplease\b|\bcan\s+you\b|\bcould\s+you\b)/i.test(value))return null;
 return value;
}
export function groupCreativeIntent(text=''){
 return /^\s*@(?:all|everyone)\b/i.test(text)?creativeBuildIntent(text):null;
}
export function namedCreativeIntent(text='',robotName=''){
 const match=/^\s*@([\p{L}\p{N}_-]+)[\s,:]+(.*)$/iu.exec(String(text||''));
 if(!match||match[1].toLowerCase()!==String(robotName||'').toLowerCase())return null;
 const goal=creativeBuildIntent(match[2]);
 return goal&&/\b(?:please|can\s+you|could\s+you|do\s+you\s+have\s+access|start|build|create|make|add|place|construct)\b/i.test(match[2])?String(text||'').trim().slice(0,1800):null;
}
export const CREATIVE_PARTS_PER_PROJECT=8;
export function creativeProjectTag(messageId='',robotId=''){
 return String(messageId||robotId||'local').slice(0,90).replace(/[^\w:.-]/g,'_');
}
export function creativeRole(messageId=''){
 const match=/:([0-2])$/.exec(String(messageId));
 return match?Number(match[1]):0;
}
const pal=[['#e0a749','#498cbd','#80cfb5'],['#82c4eb','#e5a35b','#bb85d9'],['#b69de5','#51b9ab','#e2c57c']];
function part(label,x,y,z,w,h,d,color){return {label,offset:{x,y,z},size:{width:w,height:h,depth:d},color};}
export function creativeBlueprint(goal='',role=0){
 const text=String(goal||'');
 const paint=pal[Math.abs(Math.trunc(role))%3];
 const colour=/\b(yellow)\b/i.test(text)?'#f4d44d':null;
 if(/\b(?:cubes?|blocks?)\b/i.test(text)&&/\b(?:1\s*(?:m|met(?:re|er)s?)\b|one\s+met(?:re|er))\b/i.test(text)&&!/(?:mega|tower|structure|stacks?)/i.test(text)){
  return {name:'one-metre cube',parts:[part('1m cube',0,0,0,1,1,1,colour||'#8bc3ff')],span:2,direct:true};
 }
 const choice=/\barch\b/i.test(text)?1:/\bpavilion\b/i.test(text)?2:/\btower\b/i.test(text)?0:Math.abs(Math.trunc(role))%3;
 let parts,name;
 if(choice===1){name='colonnaded sky arch';parts=[
  part('left foundation',-2.1,0,0,1.1,.65,1.3,paint[0]),part('right foundation',2.1,0,0,1.1,.65,1.3,paint[0]),
  part('left column',-2.1,.6,0,.75,3.5,.8,paint[1]),part('right column',2.1,.6,0,.75,3.5,.8,paint[1]),
  part('lower lintel',0,4.05,0,5.2,.6,.9,paint[0]),part('upper lintel',0,4.65,0,4.2,.45,.75,paint[1]),
  part('left finial',-1.55,5.1,0,.6,1,.6,paint[2]),part('right finial',1.55,5.1,0,.6,1,.6,paint[2])];
 }else if(choice===2){name='canopy pavilion';parts=[
  part('north-west post',-1.7,0,-1.7,.7,3.2,.7,paint[0]),part('north-east post',1.7,0,-1.7,.7,3.2,.7,paint[0]),
  part('south-west post',-1.7,0,1.7,.7,3.2,.7,paint[0]),part('south-east post',1.7,0,1.7,.7,3.2,.7,paint[0]),
  part('canopy deck',0,3.15,0,4.8,.45,4.8,paint[1]),part('roof crown',0,3.6,0,3.2,.55,3.2,paint[2]),
  part('central lantern',0,4.15,0,.85,1,.85,paint[1]),part('sky cap',0,5.1,0,1.55,.45,1.55,paint[2])];
 }else{name='skyline tower';parts=[
  part('north-west column',-1.55,0,-1.55,.85,3.4,.85,paint[0]),part('north-east column',1.55,0,-1.55,.85,3.4,.85,paint[0]),
  part('south-west column',-1.55,0,1.55,.85,3.4,.85,paint[0]),part('south-east column',1.55,0,1.55,.85,3.4,.85,paint[0]),
  part('observation deck',0,3.4,0,4.1,.55,4.1,paint[1]),part('roof crown',0,3.95,0,2.8,.5,2.8,paint[2]),
  part('spire',0,4.45,0,.55,2,.55,paint[0]),part('beacon',0,6.45,0,1.1,.65,1.1,paint[1])];}
 return {name,parts,span:7,direct:false};
}
export function nextCreativeIndex(parts,done=[]){
 const verified=new Set(done.map(entry=>entry?.index));
 return parts.findIndex((_,index)=>!verified.has(index));
}
