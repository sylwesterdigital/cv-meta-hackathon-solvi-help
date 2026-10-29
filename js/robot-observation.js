// Deterministic, bounded camera scan plans. Each view is a real head-camera
// render; no AI model is allowed to fabricate a camera direction or a hit.
export function observationPlan(message='',proactive=false){
 const t=String(message).toLocaleLowerCase();
 if(proactive)return [0,90,180,270].map(yaw=>({yaw,pitch:-12,label:`heading ${yaw}°`})).concat([{yaw:0,pitch:-38,label:'downward'}]);
 if(/\b(180(?:°| degrees)?|half[- ]?panorama|front half|półokrąg|polokrag)\b/i.test(t)){
  return [-60,0,60].map(yaw=>({yaw,pitch:-12,label:`heading ${yaw}°`}));
 }
 if(/\b(look around|look all around|scan (?:the |your )?(?:room|area|surroundings)|360|panorama|rozejrzyj|rozejrzeć|dookoła|wokół)\b/.test(t)){
  return Array.from({length:6},(_,i)=>({yaw:i*60,pitch:-12,label:`heading ${i*60}°`}));
 }
 if(/\b(ti(?:lt|ld) (?:your )?(?:head |camera )?down|look down|look (?:at |toward )?(?:the )?(?:floor|ground)|sp[oó]jrz w d[oó]ł|popatrz w d[oó]ł)\b/.test(t))return [{yaw:0,pitch:-38,label:'downward 38°'}];
 if(/\b(look up|tilt up|sp[oó]jrz w g[oó]rę)\b/.test(t))return [{yaw:0,pitch:32,label:'upward 32°'}];
 if(/\b(in front|ahead|down low|beneath|below|under)\b/.test(t))return [{yaw:0,pitch:0,label:'forward'},{yaw:0,pitch:-38,label:'downward 38°'}];
 return [{yaw:0,pitch:0,label:'forward'}];
}
export function scanSummary(views){return `${views.length} real JPEG camera views: `+views.map(v=>`${v.yaw}° yaw, ${v.pitch}° pitch`).join('; ');}
