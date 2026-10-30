// UI-only chronology: human chat messages stay unmodified; presence markers
// are transient WebSocket observations, not invented database messages.
const validTime=value=>{const d=new Date(value);return Number.isFinite(d.getTime())?d:null;};
export function atChatBottom({scrollTop=0,scrollHeight=0,clientHeight=0},threshold=22){
 return scrollHeight-clientHeight-scrollTop<=threshold;
}
export function chatNextPage({scrollTop=0,scrollHeight=0,clientHeight=0}){
 return Math.max(0,Math.min(scrollHeight-clientHeight,scrollTop+Math.max(120,clientHeight*.88)));
}
export function humanDay(date){return date.toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long',year:'numeric'});}
export function humanHour(date){return date.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit',hour12:false}).replace(/:\d\d$/,'')+':00';}
export function chatTimeline(messages=[],activities=[]){
 const entries=[...messages.map((entry,i)=>({type:'message',entry,created:validTime(entry.created),index:i})),
 ...activities.map((entry,i)=>({type:'presence',entry,created:validTime(entry.created),index:messages.length+i}))]
 .filter(e=>e.created).sort((a,b)=>a.created-b.created||a.index-b.index);
 const out=[];let day='',hour='';
 for(const item of entries){
  const date=item.created;const dayKey=[date.getFullYear(),date.getMonth(),date.getDate()].join('-');
  const hourKey=dayKey+'-'+date.getHours();
  if(dayKey!==day){day=dayKey;out.push({type:'day',text:humanDay(date),created:date});hour='';}
  if(hourKey!==hour){hour=hourKey;out.push({type:'hour',text:humanHour(date),created:date});}
  out.push(item);
 }
 return out;
}
