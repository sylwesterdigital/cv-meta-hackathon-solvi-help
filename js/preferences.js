// User-local appearance preferences. No profile secrets are stored here.
export const DEFAULT_PREFERENCES=Object.freeze({accent:'#79cde5',theme:'midnight',opacity:78,backgrounds:true,borders:true,group:true,sounds:true,flipHead:true});
const key=()=>{try{const id=JSON.parse(localStorage.getItem('solvi-profile')||'null')?.id;return 'solvi-ui-prefs-v1'+(id?'-'+id:'');}catch{return 'solvi-ui-prefs-v1';}};
const validColour=c=>/^#[0-9a-fA-F]{6}$/.test(c);
export function readPreferences(){try{return {...DEFAULT_PREFERENCES,...JSON.parse(localStorage.getItem(key())||'{}')};}catch{return {...DEFAULT_PREFERENCES};}}
export function updatePreferences(p){const next={...readPreferences(),...p};localStorage.setItem(key(),JSON.stringify(next));return applyPreferences(next);}
export const THEME_PRESETS=Object.freeze({
 midnight:{background:'#101b2e',panel:'#17243a',foreground:'#f4f8ff',button:'#20344e',accent:'#79cde5'},
 light:{background:'#f2f6fc',panel:'#ffffff',foreground:'#142235',button:'#e0e9f4',accent:'#145b9a'},
 dark:{background:'#101217',panel:'#1c2027',foreground:'#f7f9fd',button:'#2a303a',accent:'#82cead'},
 ocean:{background:'#071f2c',panel:'#102e3c',foreground:'#ebfbff',button:'#174254',accent:'#73dfeb'},
 forest:{background:'#0c241d',panel:'#163c2b',foreground:'#f1fff5',button:'#27543d',accent:'#b3ef84'},
 dusk:{background:'#272037',panel:'#392e4c',foreground:'#fff3fb',button:'#514061',accent:'#ffbc87'},
 contrastDark:{background:'#000000',panel:'#090909',foreground:'#ffffff',button:'#1f1f1f',accent:'#ffff49'},
 contrastLight:{background:'#ffffff',panel:'#ffffff',foreground:'#000000',button:'#e4e4e4',accent:'#084a9c'}
});
const linear=x=>{const a=parseInt(x,16)/255;return a<=.04045?a/12.92:((a+.055)/1.055)**2.4;};
export function luminance(hex){if(!validColour(hex))return 0;return .2126*linear(hex.slice(1,3))+.7152*linear(hex.slice(3,5))+.0722*linear(hex.slice(5,7));}
export function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export function readableText(background){return contrast(background,'#000000')>=contrast(background,'#ffffff')?'#000000':'#ffffff';}
export function applyPreferences(p=readPreferences()){
 const theme=THEME_PRESETS[p.theme]||THEME_PRESETS.midnight;
 const vars={'--ui-bg':theme.background,'--ui-panel':theme.panel,'--ui-fg':theme.foreground,'--ui-button':theme.button,'--ui-button-text':readableText(theme.button),'--ui-accent-text':readableText(theme.accent)};
 for(const [k,v] of Object.entries(vars))document.documentElement.style.setProperty(k,v);
 document.documentElement.dataset.solviTheme=p.theme||'midnight';
 const d=document.documentElement;
 const colour=validColour(p.accent)?p.accent:theme.accent;
 d.style.setProperty('--solvi-accent',colour);
 d.style.setProperty('--ui-accent-text',readableText(colour));
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
