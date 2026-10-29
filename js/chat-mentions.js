/** @name completion works for multiword names, people and robots. */
export function mentionQuery(text,cursor){
 const before=String(text||'').slice(0,Math.max(0,cursor??text.length));
 const match=/(^|[\s(])@([^@\n]*)$/.exec(before);
 if(!match)return null;
 const query=match[2];
 // Stop after punctuation or more than 64 typed characters.
 if(query.length>64||/[.,:;!?]/.test(query))return null;
 const start=before.length-match[0].length+match[1].length;
 return {query,start,end:before.length};
}
export function mentionCandidates(names,query=''){
 const seen=new Map(),search=String(query).trim().toLocaleLowerCase();
 const available=[];
 if('all'.includes(search))available.push({name:'All',kind:'broadcast'});
 for(const source of names||[]){const name=String(source?.name||'').trim();const key=name.toLocaleLowerCase();
  if(!name||!key.includes(search))continue;
  const kind=source.kind==='robot'?'robot':'user';
  if(seen.has(key)){if(kind==='robot')available[seen.get(key)]={name,kind};continue;}
  seen.set(key,available.length);available.push({name,kind});
 }
 return available.sort((a,b)=>Number(b.kind==='robot')-Number(a.kind==='robot')||a.name.localeCompare(b.name));
}
export function insertMention(text,query,name){
 const label='@'+String(name).replace(/\s+/g,' ').trim()+' ';
 const next=String(text).slice(0,query.start)+label+String(text).slice(query.end);
 return {text:next,cursor:query.start+label.length};
}
