// Local, bounded browser/room diagnostics visible to every SOLVI participant.
// Never log authorization tokens, full WebSocket payloads or model prompts.
const MAX_ENTRIES=160;
export function safeDiagnosticDetail(data={}){
 const allowed=['event','room','attempt','participants','peers','seconds','code','reason','expected','actual','name'];
 const clean={};for(const key of allowed){if(data[key]===undefined)continue;
  const value=data[key];if(Array.isArray(value))clean[key]=value.slice(0,12).map(x=>String(x).slice(0,50));
  else if(typeof value==='number'&&Number.isFinite(value))clean[key]=value;
  else if(typeof value==='string')clean[key]=value.slice(0,160).replace(/(?:bearer\s+|token[=: ]+)[^\s;,]+/gi,'[credential hidden]');
 }
 return clean;
}
export function formatDiagnosticEntry(date,source,detail){
 const stamp=new Date(date).toLocaleTimeString('en-GB',{hour12:false});
 const safe=safeDiagnosticDetail(detail);
 const label=String(source).slice(0,30);
 return `${stamp} [${label}] ${safe.event||'event'}${Object.keys(safe).filter(k=>k!=='event').length?' · '+Object.entries(safe).filter(([k])=>k!=='event').map(([k,v])=>`${k}: ${Array.isArray(v)?v.join(', '):v}`).join(' · '):''}`;
}
export function initRoomDiagnostics(){
 const $=id=>document.getElementById(id);
 const box=$('devDiagnosticEntries'),status=$('devDiagnosticStatus');if(!box||!status)return;
 const entries=[];let connected=false;let count=0;let room='main';
 function render(){box.textContent=entries.join('\n');box.scrollTop=box.scrollHeight;status.textContent=connected?`${room} · ${count} in room · Connected`:`${room} · Connection not confirmed`;}
 function record(source,detail){const safe=safeDiagnosticDetail(detail);entries.push(formatDiagnosticEntry(Date.now(),source,safe));if(entries.length>MAX_ENTRIES)entries.splice(0,entries.length-MAX_ENTRIES);
  if(safe.room)room=safe.room;if(safe.event==='presence-sync'){connected=true;count=safe.participants||1;}
  else if(safe.event==='member-joined'||safe.event==='member-left'||safe.event==='member-discovered')count=safe.participants||count;
  else if(['disconnected','authentication-rejected','switch-room','connecting'].includes(safe.event))connected=false;
  render();
 }
 window.addEventListener('solvi:room-diagnostic',e=>record('Room',e.detail||{}));
 window.addEventListener('error',e=>record('Browser',{event:'script-error',reason:String(e.message||'Script error').slice(0,160)}));
 window.addEventListener('unhandledrejection',e=>record('Browser',{event:'unhandled-promise',reason:String(e.reason?.message||e.reason?.name||'Promise rejected').slice(0,160)}));
 window.addEventListener('solvi:room-changed',e=>record('Room',{event:'room-selected',room:e.detail?.room||'main'}));
 window.addEventListener('solvi:brain-trace',e=>{const d=e.detail||{};
  // Safe, metadata-only trace for ordinary users. Full model I/O remains in
  // the existing opt-in robot trace; never display prompts or credentials here.
  record('Robot',{event:String(d.step||d.action||d.status||'brain-event').slice(0,60),name:String(d.robotName||'Robot').slice(0,70),room:window.solviRoom||'main'});
 });
 window.addEventListener('solvi:robot-route',e=>{const d=e.detail||{};record('Robot',{event:'route-'+(d.status||'updated'),name:String(d.name||'Robot').slice(0,70),room:window.solviRoom||'main'});});
 $('devDiagnosticClear').addEventListener('click',()=>{entries.length=0;record('Browser',{event:'log-cleared',room});});
 $('devDiagnosticCopy').addEventListener('click',()=>{const text=entries.join('\n');if(navigator.clipboard?.writeText)navigator.clipboard.writeText(text).catch(()=>{});
  else{const sel=window.getSelection();const range=document.createRange();range.selectNodeContents(box);sel.removeAllRanges();sel.addRange(range);}});
 record('Browser',{event:'diagnostics-ready',room:window.solviRoom||'main'});
 return {record,entries};
}
