// Pure, scene-grounded decisions for cargo work. A spoken adjective is a
// constraint, never permission to grab every object with the same noun.
const COLOURS=['pink','magenta','purple','violet','red','orange','yellow','green','blue','cyan','teal','brown','black','white','grey','gray'];
const IGNORE_CONTENT=new Set(['box','boxes','bin','junk','copy','copies','all','one','those','these','contents','content']);
const hexColour=/^#[\da-f]{6}$/i;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
export function cargoConstraints(goal=''){
 const text=String(goal||'').toLowerCase();
 const colourNames=COLOURS.filter(name=>new RegExp('\\b'+name+'\\b','i').test(text));
 const nearBox=colourNames.filter(name=>
  new RegExp('\\b'+name+'\\b(?:\\s+\\w+){0,2}\\s+\\bbox(?:es|\\s+copies)?\\b','i').test(text)||
  new RegExp('\\bbox(?:es|\\s+copies)?\\b[^.!?]{0,60}\\b(?:only\\s+(?:the\\s+|those\\s+|these\\s+)?|(?:painted|marked|colou?red)\\s+)'+name+'\\b','i').test(text));
 const ambiguousColours=nearBox.length>1;
 // Never infer contents from appearances. An explicitly requested label or
 // contents must be present in grounded scene metadata.
 const content= /\b(?:contain(?:s|ing)?|filled\s+with|holding|with\s+contents?\s+(?:of\s+)?|with\s+)(?:the\s+|some\s+)?([\w\s-]{2,45}?)(?=\s+(?:inside|in\s+them|into|in\s+the\s+bin|to\s+the\s+bin|please|only|and\s+put)\b|[.!?,]|$)/i.exec(text)?.[1]?.trim()||null;
 const excluded=COLOURS.find(name=>new RegExp('\\b(?:except|excluding|not|other than)\\s+(?:the\\s+)?'+name+'\\b','i').test(text))||null;
 const colour=nearBox.length===1&&nearBox[0]!==excluded?nearBox[0]:null;
 const exact=/\bbox\s+copy\s*(\d+)\b/i.exec(text)?.[1]||null;
 return {colour:colour==='gray'?'grey':colour,excludeColour:excluded==='gray'?'grey':excluded,content:content&&!IGNORE_CONTENT.has(content)?content:null,exact,ambiguousColours};
}
function rgbColour(value){
 if(!hexColour.test(value||''))return null;
 const r=parseInt(value.slice(1,3),16)/255,g=parseInt(value.slice(3,5),16)/255,b=parseInt(value.slice(5),16)/255;
 const max=Math.max(r,g,b),min=Math.min(r,g,b),spread=max-min;
 let hue=0;
 if(spread>1e-8){if(max===r)hue=((g-b)/spread)%6;else if(max===g)hue=(b-r)/spread+2;else hue=(r-g)/spread+4;hue=(hue*60+360)%360;}
 return {hue,saturation:max===0?0:spread/max,value:max};
}
export function colourFamily(value){
 const c=rgbColour(value);if(!c)return null;
 if(c.value<.18)return 'black';
 if(c.saturation<.13)return c.value>.87?'white':'grey';
 if(c.hue>=335||c.hue<12)return c.hue>=335&&c.saturation<.78&&c.value>.65?'pink':'red';
 if(c.hue<40)return c.value<.72?'brown':'orange';
 if(c.hue<68)return 'yellow';
 if(c.hue<170)return 'green';
 if(c.hue<200)return 'teal';
 if(c.hue<255)return 'blue';
 if(c.hue<285)return 'violet';
 if(c.hue<330)return 'pink';
 return 'pink';
}
export function groundedBoxMatch(obj,constraints={}){
 const name=String(obj?.name||'');
 if(constraints.ambiguousColours)return {ok:false,reason:'multiple colour descriptions; cannot select a safe subset'};
 if(constraints.exact&&!new RegExp('^Box copy'+constraints.exact+'$','i').test(name))return {ok:false,reason:'different named box'};
 const colour=constraints.colour;
 if(colour){
  const family=colourFamily(obj?.userData?.furniture?.color)||colourFamily(obj?.userData?.color);
  const inName=new RegExp('\\b'+colour+'\\b','i').test(name);
  const coloursMatch=family===colour||colour==='magenta'&&family==='pink'||colour==='cyan'&&family==='teal'||colour==='purple'&&family==='violet';
  if(!inName&&!coloursMatch)return {ok:false,reason:family?'colour is '+family+', not '+colour:'colour not known: cannot verify '+colour};
 }
 if(constraints.excludeColour){
  const family=colourFamily(obj?.userData?.furniture?.color)||colourFamily(obj?.userData?.color);
  if(!family)return {ok:false,reason:'cannot verify excluded colour'};
  if(family===constraints.excludeColour)return {ok:false,reason:'excluded '+family+' object'};
 }
 if(constraints.content){
  const known=[obj?.userData?.content,obj?.userData?.contents,obj?.userData?.furniture?.content,obj?.userData?.furniture?.contents,obj?.userData?.description]
   .filter(value=>typeof value==='string'&&value.trim());
  // No descriptor -> cannot truthfully claim the contents of an opaque box.
  if(!known.length)return {ok:false,reason:'box contents unknown; cannot verify '+constraints.content};
  if(!known.some(value=>value.toLowerCase().includes(constraints.content.toLowerCase())))return {ok:false,reason:'contents do not match '+constraints.content};
 }
 return {ok:true,reason:'matched explicit descriptions'};
}
// A run is deliberately a *temporary* part of a long, already planned route.
// It is vetoed by a nearby colleague or obstacle, and resumed as walking at a turn.
export function shouldJogCargoLeg({start,end,obstacles=[],colleagues=[],floorY=0,allowed=false}={}){
 if(!allowed||!start||!end||![start.x,start.z,end.x,end.z].every(Number.isFinite))return false;
 const dx=end.x-start.x,dz=end.z-start.z,length=Math.hypot(dx,dz);
 if(length<9)return false;
 const ux=dx/length,uz=dz/length,sweep=Math.min(5,length-1.5);
 for(const colleague of colleagues){
  if(!colleague||Math.abs(Number(colleague.y??0)-floorY)>1.4)continue;
  const x=colleague.x-start.x,z=colleague.z-start.z,projection=x*ux+z*uz;
  if(projection>-1&&projection<sweep+2&&Math.abs(x*uz-z*ux)<2.4)return false;
 }
 for(let d=0.45;d<=sweep;d+=.45){const x=start.x+ux*d,z=start.z+uz*d;
  if(obstacles.some(o=>x>=o.minX-.6&&x<=o.maxX+.6&&z>=o.minZ-.6&&z<=o.maxZ+.6))return false;
 }
 return true;
}
// A physics throw is *not* automatically a faster solution. Reject small
// apertures, long distances and any nearby person. The caller must still
// verify an actual physics landing and a server-acknowledged bin transfer.
export function safeThrowCandidate({source,bin,robot,people=[],obstacles=[],physics=false,alreadyTried=false}={}){
 if(!physics||alreadyTried||!robot||!source||!bin)return {ok:false,reason:'normal carrying is more reliable'};
 const w=Number(bin.userData?.furniture?.width)||0,depth=Number(bin.userData?.furniture?.depth)||w;
 if(Math.min(w,depth)<1.15||bin.userData?.furniture?.lid===true)return {ok:false,reason:'bin opening too small or closed for a reliable throw'};
 const d=Math.hypot(robot.position.x-bin.position.x,robot.position.z-bin.position.z);
 if(d<2.2||d>4.3)return {ok:false,reason:'throw does not save useful walking distance'};
 if(Math.abs(robot.position.y-bin.position.y)>0.75)return {ok:false,reason:'throw requires a same-floor target'};
 const dx=bin.position.x-robot.position.x,dz=bin.position.z-robot.position.z;
 for(const p of people){if(p===robot||Math.abs(p.position.y-robot.position.y)>1.3)continue;
  const t=clamp(((p.position.x-robot.position.x)*dx+(p.position.z-robot.position.z)*dz)/(d*d),0,1);
  if(Math.hypot(p.position.x-robot.position.x-t*dx,p.position.z-robot.position.z-t*dz)<2.2)return {ok:false,reason:'colleague in or beside throwing corridor'};
 }
 for(let t=.1;t<1;t+=.09){const x=robot.position.x+t*dx,z=robot.position.z+t*dz;
  if(obstacles.some(o=>!(o.id&&o.id===bin.userData?.editorId)&&!(o.id&&o.id===source.userData?.editorId)&&x>=o.minX-.5&&x<=o.maxX+.5&&z>=o.minZ-.5&&z<=o.maxZ+.5))return {ok:false,reason:'throw path intersects scene geometry'};
 }
 return {ok:true,reason:'large open target and clear, same-floor corridor'};
}
