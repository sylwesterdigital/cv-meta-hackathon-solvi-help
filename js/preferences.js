// User-local appearance preferences. No profile secrets are stored here.
export const DEFAULT_PREFERENCES=Object.freeze({accent:'#79cde5',opacity:78,backgrounds:true,borders:true,group:true,sounds:true,flipHead:true});
const key=()=>{try{const id=JSON.parse(localStorage.getItem('solvi-profile')||'null')?.id;return 'solvi-ui-prefs-v1'+(id?'-'+id:'');}catch{return 'solvi-ui-prefs-v1';}};
const validColour=c=>/^#[0-9a-fA-F]{6}$/.test(c);
export function readPreferences(){try{return {...DEFAULT_PREFERENCES,...JSON.parse(localStorage.getItem(key())||'{}')};}catch{return {...DEFAULT_PREFERENCES};}}
export function updatePreferences(p){const next={...readPreferences(),...p};localStorage.setItem(key(),JSON.stringify(next));return applyPreferences(next);}
export function applyPreferences(p=readPreferences()){
 const d=document.documentElement;
 const colour=validColour(p.accent)?p.accent:DEFAULT_PREFERENCES.accent;
 d.style.setProperty('--solvi-accent',colour);
 d.style.setProperty('--bubble-alpha',String(Math.max(0,Math.min(1,Number(p.opacity)/100))));
 d.dataset.chatBg=String(!!p.backgrounds);d.dataset.chatBorder=String(!!p.borders);
 window.dispatchEvent(new CustomEvent('solvi:prefs-changed',{detail:p}));return p;
}
export function shouldGroupMessages(previous,current,enabled=true){
 if(!enabled||!previous||!current)return false;
 const prev=Date.parse(previous.created||''),next=Date.parse(current.created||'');
 return Number.isFinite(prev)&&Number.isFinite(next)&&next>=prev&&next-prev<=90_000 &&
 previous.role===current.role&&previous.speaker===current.speaker&&previous.user_id===current.user_id&&previous.model===current.model;
}
export function exportRoomTranscript(messages,room,format='json'){
 const entries=messages.map(m=>({date:m.created||'',speaker:m.speaker||m.model||'AI',role:m.role||'user',text:m.text||'',model:m.model||null,media:m.media||[]}));
 if(format==='md')return `# SOLVI.help — ${room} messages\n\n`+entries.map(m=>`### ${m.speaker} · ${m.date}\n\n${m.text}\n`).join('\n');
 return JSON.stringify({format:'solvi-chat-v1',room,exportedAt:new Date().toISOString(),messages:entries},null,2);
}
export function themePalette(index){const hue=((index*137.508)%360+360)%360;const colour=(h,s,l)=>{const a=s*Math.min(l,1-l);const f=n=>{const k=(n+h/30)%12;return Math.round(255*(l-a*Math.max(-1,Math.min(k-3,9-k,1)))).toString(16).padStart(2,'0');};return '#'+f(0)+f(8)+f(4);};return colour(hue,.55,.68);}
