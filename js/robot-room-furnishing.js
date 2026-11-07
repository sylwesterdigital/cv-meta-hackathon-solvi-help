// Bounded, inspectable intent rules. Human text selects known procedural tools;
// the scene editor, not this parser or a language model, authorises mutations.
export function normaliseFurnishingText(text=''){
 return String(text||'').replace(/\byo\s+uare\b/gi,'you are')
  .replace(/\bfurnutures?\b/gi,'furniture').replace(/\bfurnitures\b/gi,'furniture');
}
const TERMS=[
 ['fridge',/\b(?:fridges?|refrigerators?)\b/i],
 ['tv',/\b(?:tv|tvs|televisions?|telly|tellies)\b/i],
 ['sofa',/\b(?:sofas?|couches?)\b/i],
 ['bed',/\bbeds?\b/i],
 ['table',/\btables?\b/i],
 ['chair',/\bchairs?\b/i],
 ['cabinet',/\bcabinets?\b/i],
 ['lamp',/\blamps?\b/i],
 ['speaker',/\bspeakers?\b/i],
 ['monitor',/\bmonitors?\b/i],
 ['stool',/\bstools?\b/i]
];
export const ROOM_FURNISHING_VARIANTS=Object.freeze(TERMS.map(([name])=>name));
// When an authorised human grants an individual robot creative freedom to
// furnish a real room, choose a bounded, reversible starter set instead of
// turning the instruction into a promise without an executable goal.
export function isOpenEndedRoomFurnishing(text=''){
 const s=normaliseFurnishingText(text).slice(0,1800);
 if(/\b(?:do\s+not|don\'t|never|stop|avoid|without)\s+(?:adding|add|put|place|install|furnish)\b/i.test(s))return false;
 return /\b(?:add|adding|furnish|furnishing|place|put)\b/i.test(s)&&
  /\b(?:furniture|furnitures|furnishings)\b/i.test(s)&&
  /\b(?:rooms?|houses?|homes?|here|inside|interiors?)\b/i.test(s);
}
export function namedWorkContinuation(text='',robotName=''){
 const addressed=/^@([\p{L}\p{N}_-]+)(?:[,.:\s]+)(.+)$/u.exec(String(text||'').trim());
 if(!addressed||addressed[1].toLowerCase()!==String(robotName||'').trim().toLowerCase())return false;
 const command=addressed[2].trim();
 if(/\b(?:don't|do not|never|stop|cancel)\b/i.test(command))return false;
 return /\b(?:do\s+(?:it|that|what\s+you\s+(?:said|promised|offered))(?:\s+(?:earlier|now|right now))?|continue\s+(?:the\s+)?(?:furnishing|work|task)|carry\s+on\s+(?:with\s+)?(?:the\s+)?(?:furnishing|work|task)|start\s+(?:the\s+)?(?:furnishing|work|task))\b/i.test(command)&&
  /\b(?:please|now|do|continue|carry|start)\b/i.test(command);
}
// A follow-up can authorise the specific items in a recent robot promise;
// a promise itself is NEVER sufficient authority to edit the scene.
export function promisedRoomFurnishing(messages=[],robotName='',now=Date.now()){
 const entries=Array.isArray(messages)?messages:[];
 for(let i=entries.length-1;i>=0;i--){
  const m=entries[i];
  if(m?.role!=='assistant'||String(m.speaker||'').toLowerCase()!==String(robotName||'').toLowerCase())continue;
  const at=Date.parse(m.created||'');
  if(!Number.isFinite(at)||Math.abs(now-at)>30*60*1000)continue;
  if(/\b(?:completed|finished|already\s+placed|already\s+added|saved\s+in\s+scene)\b/i.test(m.text||''))continue;
  if(!/\b(?:i(?:'ll| will| can| plan to| intend to)|going to)\b/i.test(m.text||''))continue;
  const variants=roomFurnishingSequence(m.text||'');
  if(variants.length)return variants;
 }
 return [];
}

export function roomFurnishingSequence(text=''){
 const message=normaliseFurnishingText(text).slice(0,1800);
 if(!/\b(?:add|adding|put|place|placing|install|installing|furnish|furnishing|set\s+up)\b/i.test(message))return [];
 // Require an actual placement directive, not a negation or quoted discussion.
 if(/\b(?:do\s+not|don't|never|stop|avoid)\s+(?:adding|add|put|place|install|furnish)\b/i.test(message))return [];
 const mentions=TERMS.map(([variant,expr])=>({variant,match:expr.exec(message)}))
  .filter(item=>item.match).sort((a,b)=>a.match.index-b.match.index);
 return mentions.length?mentions.map(item=>item.variant).slice(0,6):isOpenEndedRoomFurnishing(message)?['bed','table']:[];
}
export function namedRoomFurnishingInstruction(text='',robotName=''){
 const message=normaliseFurnishingText(text).trim().slice(0,1800);
 const addressed=/^@([\p{L}\p{N}_-]+)(?:[,:\s]+)(.+)$/u.exec(message);
 if(!addressed||!robotName||addressed[1].toLowerCase()!==String(robotName).trim().toLowerCase())return null;
 const command=addressed[2].trim();
 if(!roomFurnishingSequence(command).length)return null;
 // A directly addressed request, even when phrased "what about adding ...?",
 // is executable. Pure descriptions and generic future speculation are not.
 if(!/^(?:(?:hey|but|and|so|btw|please|now|just|right now|actually|what about|how about|go and|go ahead and|can you|could you|would you|why not|i'd like you to|i want you to|you can|you are free to|you're free to|feel free to|you have permission to)\s+)*\s*(?:add|adding|put|place|placing|install|installing|furnish|furnishing|set\s+up)\b/i.test(command))return null;
 return String(text||'').trim().slice(0,1800);
}
// Use durable object IDs rather than assuming a scene mutation succeeded.
// Failed variants are temporarily deferred so later requested items can proceed.
export function nextRoomFurnishing(sequence=[],receipts=[],deferred=[],now=Date.now()){
 const placed=new Map();for(const p of receipts)if(p?.id&&ROOM_FURNISHING_VARIANTS.includes(p.variant))placed.set(p.variant,(placed.get(p.variant)||0)+1);
 const outstanding=[];
 for(const variant of sequence){const n=placed.get(variant)||0;if(n){placed.set(variant,n-1);continue;}outstanding.push(variant);}
 if(!outstanding.length)return {done:true,variant:null,nextRetryAt:0};
 const eligible=outstanding.find(variant=>!deferred.some(d=>d.variant===variant&&d.retryAt>now));
 return {done:false,variant:eligible||null,nextRetryAt:eligible?0:Math.min(...deferred.filter(d=>outstanding.includes(d.variant)).map(d=>d.retryAt))};
}

// A closed procedural house may use the realm's actual ground as its floor
// instead of a separately saved cube. Check every footprint corner and edge
// midpoint against the authored room polygon; do not infer an enclosed room
// from a camera photo, object label or an unclosed wall outline.
export function enclosedRoomFootprint(points=[],footprint=[],margin=0){
 if(!Array.isArray(points)||points.length<3||!Array.isArray(footprint)||footprint.length!==4||
  !points.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite))||
  !footprint.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))return false;
 const inside=([x,z])=>{
  let found=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const a=points[i],b=points[j];
   if((a[1]>z)!==(b[1]>z) && x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])found=!found;
  }
  return found;
 };
 const center=[footprint.reduce((n,p)=>n+p[0],0)/4,footprint.reduce((n,p)=>n+p[1],0)/4];
 const probes=[center,...footprint,...footprint.map((p,i)=>[(p[0]+footprint[(i+1)%4][0])/2,(p[1]+footprint[(i+1)%4][1])/2])];
 if(!probes.every(inside))return false;
 if(margin>0){
  // Sample toward the perimeter, not an unverified infinite planar floor.
  for(const [x,z] of footprint){
   const dx=x-center[0],dz=z-center[1],len=Math.hypot(dx,dz)||1;
   if(!inside([x+dx/len*margin,z+dz/len*margin]))return false;
  }
 }
 return true;
}
