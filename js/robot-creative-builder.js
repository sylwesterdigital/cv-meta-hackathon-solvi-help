// Human-authorised, bounded creative architecture. Design data only: editor
// owns geometry, physics, ownership, movement and server-acknowledged saves.
// Stable plans let a robot resume after a reload without re-planning old parts.
const BUILD=/(?:\b(?:build|built|building|construct|constructing|creat\w*|make|add|place|design|erect|remodel|recolour|recolor)\b)/i;
const STRUCTURE=/\b(?:mega\s*str\w*|str\w*ctures?|architectur\w*|submarines?|submersibles?|mock\s*ups?|mocups?|spheres?|balls?|houses?|spaceships?|vehicles?|windmills?|anything\s+else|towers?|arches?|bridges?|pavilions?|sculptures?|landmarks?|monuments?|yellow\s+cubes?|cubes?|procedural\s+(?:api|creation|objects?)|new\s+realms?)\b/i;
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
 const goal=creativeBuildIntent(match[2])||(creativeRemodelIntent(match[2])?match[2]:null);
 return goal&&/\b(?:please|can\s+you|could\s+you|do\s+you\s+have\s+access|start|build|built|create|make|add|place|construct|change|remodel|free\s+to)\b/i.test(match[2])?String(text||'').trim().slice(0,1800):null;
}
// Follow-up is a HUMAN authorization. Muse speech alone cannot mutate scenes.
// Recover one concrete recent proposal by the same named robot, not by a peer.
export function approvedCreativeFollowUp(text='',name='',history=[],at=Date.now()){
 const m=/^\s*@([\p{L}\p{N}_-]+)[\s,:]+(.+)$/iu.exec(String(text||''));
 if(!m||m[1].toLowerCase()!==name.toLowerCase()||
   !/\b(?:ok|yes|please|go ahead|let'?s)\b/i.test(m[2])||
   !/\b(?:create|build|make|start|do)\b/i.test(m[2])||
   !/\b(?:mock\s*up|mocup|mini|that|idea|talking about|described|suggested)\b/i.test(m[2]))return null;
 for(const row of [...history].reverse()){
  const stamp=Date.parse(row.created||row.timestamp||'');
  if(!Number.isFinite(stamp)||stamp>at+60000||at-stamp>15*60*1000)continue;
  if(row.role!=='assistant'||String(row.speaker||row.speaker_override||'').toLowerCase()!==name.toLowerCase())continue;
  if(/\b(?:submarine|submersible|yellow sub|mini sub|hull.*portholes?)\b/i.test(row.text||''))
   return `@${name} please create a mini yellow submarine mockup with hull, sail and portholes, as I just approved`;
 }
 return null;
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
function part(label,x,y,z,w,h,d,color,kind='cube',rotationY=0){return {label,kind,rotationY,offset:{x,y,z},size:{width:w,height:h,depth:d},color};}
export function creativeForwardDistance(text=''){
 const m=/\b(\d{1,2}(?:\.\d+)?)\s*m(?:et(?:re|er)s?)?\s+(?:in\s+)?front\s+of\s+(?:you|yourself|him|her)\b/i.exec(text);
 return m?Math.min(45,Number(m[1])):null;
}
const colors={yellow:'#f4d44d',pink:'#ed79be',red:'#ed6666',green:'#60c987',blue:'#579ff0',purple:'#a380e8',orange:'#efa552',white:'#ececec',black:'#323a49'};
function requestedColor(text){const match=/(?:\b(?:pink|yellow|red|green|blue|purple|orange|white|black)\b)/i.exec(text);return match?colors[match[0].toLowerCase()]:null;}
export function creativeRemodelIntent(text=''){
 return /\b(?:make\s+it\s+more\s+complex|what\s+you\s+just\s+built|change\s+everything\s+to|recolou?r|remodel|turn\s+it\s+into)\b/i.test(text)&&
   /\b(?:house|pink|roof|walls?)\b/i.test(text)&&!NEGATIVE.test(text);
}
export function creativeBlueprint(goal='',role=0){
 const text=String(goal||'');
 const paint=pal[Math.abs(Math.trunc(role))%3];
 const colour=requestedColor(text);
 const distance=creativeForwardDistance(text);
 if(creativeRemodelIntent(text)){
  const pink=colour||colors.pink;
  return {name:'house-like remodeling',remodel:true,parts:[
   part('front left wall',-1.55,0,-1.65,.32,3.1,2.8,pink),
   part('front right wall',1.55,0,-1.65,.32,3.1,2.8,pink),
   part('back left wall',-1.55,0,1.65,.32,3.1,2.8,pink),
   part('back right wall',1.55,0,1.65,.32,3.1,2.8,pink),
   part('front gable',0,2.6,-1.65,3.5,.8,.4,pink),
   part('back gable',0,2.6,1.65,3.5,.8,.4,pink),
   part('roof left',-.85,3.4,0,1.95,.35,4.1,pink),
   part('roof right',.85,3.4,0,1.95,.35,4.1,pink)
  ],span:7,direct:false};
 }
 if(/\bsubmarines?|submersibles?|yellow\s+sub\b/i.test(text)){
  const yellow=colour||colors.yellow;
  const small=/\b(?:mini|small|mock\s*up|mocup)\b/i.test(text);
  const pieces=[
   part('ellipsoid pressure hull',0,.65,0,small?3.4:5.8,1.35,1.5,yellow,'sphere'),
   part('rounded bow',small?1.5:2.65,.65,0,small?1:1.4,1.14,1.32,yellow,'sphere'),
   part('rounded stern',small?-1.5:-2.65,.65,0,small?1:1.4,1.14,1.32,yellow,'sphere'),
   part('conning tower',0,1.2,0,.85,1.25,.8,yellow,'cylinder'),
   part('periscope stalk',0,2.35,0,.14,.7,.14,'#b7ced1','cylinder'),
   part('periscope head',.18,2.9,0,.42,.15,.2,'#b7ced1'),
   part('porthole left',-1.1,.77,.69,.4,.4,.16,'#31517a','sphere'),
   part('porthole right',.55,.77,.69,.4,.4,.16,'#31517a','sphere'),
   part('tail fin',small?-1.5:-2.65,1.35,0,.45,1.1,.2,yellow),
   part('propeller hub',small?-1.98:-3.35,.63,0,.42,.42,.42,'#929fae','sphere')];
  return {name:small?'mini yellow submarine':'yellow submarine',parts:pieces,span:7,direct:distance!==null,distance:distance??null};
 }
 if(/\b(?:sphere|ball)\b/i.test(text)){
  // A 1m instruction immediately before "in front" is POSITION, not diameter.
  const diameter=(/\b(?:diameter|wide|across)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*m\b/i.exec(text)||[])[1];
  const d=diameter?Math.min(3,Math.max(.2,Number(diameter))):1;
  return {name:'coloured sphere',parts:[part('1m sphere',0,0,0,d,d,d,colour||colors.pink,'sphere')],span:2,direct:true,distance:distance??2};
 }
 
 if(/\b(?:cubes?|blocks?)\b/i.test(text)&&/\b(?:1\s*(?:m|met(?:re|er)s?)\b|one\s+met(?:re|er))\b/i.test(text)&&!/(?:mega|tower|structure|stacks?)/i.test(text)){
  return {name:'one-metre cube',parts:[part('1m cube',0,0,0,1,1,1,colour||'#8bc3ff')],span:2,direct:true,distance:distance??2};
 }
 const choice=/\barch\b/i.test(text)?1:/\bpavilion\b/i.test(text)?2:/\btower\b/i.test(text)?0:/\banything\s+else\b/i.test(text)?2:Math.abs(Math.trunc(role))%3;
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

// Muse returns only design DATA. No JS snippets, network URLs, scripts,
// unbounded scene operations or invented editor API methods may be executed.
export function validateCreativePlan(candidate){
 if(!candidate||typeof candidate!=='object'||!Array.isArray(candidate.parts)||
    candidate.parts.length<1||candidate.parts.length>12)return null;
 const name=String(candidate.name||'').trim().slice(0,70);if(!name)return null;
 const parts=[];
 for(const p of candidate.parts){
  if(!p||typeof p!=='object'||!['cube','sphere','cylinder'].includes(p.kind)||
     typeof p.label!=='string'||!p.label.trim()||p.label.length>80||
     !/^#[0-9a-f]{6}$/i.test(p.color||''))return null;
  const o=p.offset||{},d=p.size||{};
  if(![o.x,o.y,o.z,d.width,d.height,d.depth].every(v=>typeof v==='number'&&Number.isFinite(v))||
     Math.min(d.width,d.height,d.depth)<.1||Math.max(d.width,d.height,d.depth)>7||
     o.y<0||o.y+d.height>12||Math.abs(o.x)+d.width/2>4.6||
     Math.abs(o.z)+d.depth/2>4.6)return null;
  parts.push({kind:p.kind,label:p.label.trim().slice(0,50),color:p.color.toLowerCase(),
   offset:{x:o.x,y:o.y,z:o.z},size:{width:d.width,height:d.height,depth:d.depth}});
 }
 return {name,parts,span:9,direct:false};
}
