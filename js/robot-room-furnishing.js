// Bounded, inspectable intent rules. Human text selects known procedural tools;
// the scene editor, not this parser or a language model, authorises mutations.
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
export function roomFurnishingSequence(text=''){
 const message=String(text||'').slice(0,1800);
 if(!/\b(?:add|adding|put|place|placing|install|installing|furnish|furnishing|set\s+up)\b/i.test(message))return [];
 // Require an actual placement directive, not a negation or quoted discussion.
 if(/\b(?:do\s+not|don't|never|stop|avoid)\s+(?:adding|add|put|place|install|furnish)\b/i.test(message))return [];
 const mentions=TERMS.map(([variant,expr])=>({variant,match:expr.exec(message)}))
  .filter(item=>item.match).sort((a,b)=>a.match.index-b.match.index);
 return mentions.map(item=>item.variant).slice(0,6);
}
export function namedRoomFurnishingInstruction(text='',robotName=''){
 const message=String(text||'').trim().slice(0,1800);
 const addressed=/^@([\p{L}\p{N}_-]+)(?:[,:\s]+)(.+)$/u.exec(message);
 if(!addressed||!robotName||addressed[1].toLowerCase()!==String(robotName).trim().toLowerCase())return null;
 const command=addressed[2].trim();
 if(!roomFurnishingSequence(command).length)return null;
 // A directly addressed request, even when phrased "what about adding ...?",
 // is executable. Pure descriptions and generic future speculation are not.
 if(!/^(?:(?:hey|but|and|so|btw|please|now|just|right now|actually|what about|how about|go and|go ahead and|can you|could you|would you|why not|i'd like you to|i want you to|you can|feel free to)\s+)*\s*(?:add|adding|put|place|placing|install|installing|furnish|furnishing|set\s+up)\b/i.test(command))return null;
 return message;
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
