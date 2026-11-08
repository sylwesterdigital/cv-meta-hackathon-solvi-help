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
  const entry={name,kind};
  if(source.id)entry.id=String(source.id);
  if(source.avatar)entry.avatar=String(source.avatar);
  if(seen.has(key)){if(kind==='robot')available[seen.get(key)]=entry;continue;}
  seen.set(key,available.length);available.push(entry);
 }
 return available.sort((a,b)=>Number(b.kind==='robot')-Number(a.kind==='robot')||a.name.localeCompare(b.name));
}
export function insertMention(text,query,name){
 const label='@'+String(name).replace(/\s+/g,' ').trim()+' ';
 const next=String(text).slice(0,query.start)+label+String(text).slice(query.end);
 return {text:next,cursor:query.start+label.length};
}

// $ is an object reference, not an @handle; only objects in this loaded realm
// can be offered. The UUID in the inserted token survives identical names.
export function sceneReferenceQuery(text,cursor){
 const before=String(text||'').slice(0,Math.max(0,cursor??String(text||'').length));
 const match=/(^|[\s(])\$([^$\n]*)$/.exec(before);
 if(!match||match[2].length>90||/[\[\]();!?]/.test(match[2]))return null;
 return {query:match[2],start:before.length-match[0].length+match[1].length,end:before.length};
}
export function sceneReferenceCandidates(objects,query=''){
 const needle=String(query).trim().toLocaleLowerCase();
 return (objects||[]).filter(o=>o&&o.kind!=='robot'&&o.kind!=='light'
  &&/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(String(o.id||''))
  &&(String(o.name||'')+' '+String(o.display||'')).toLocaleLowerCase().includes(needle))
  .sort((a,b)=>(a.display||a.name).localeCompare(b.display||b.name)).slice(0,40);
}
export function insertSceneReference(text,range,item){
 const name=String(item.name||'').replace(/[\[\]()]|\s+/g,c=>/\s/.test(c)?' ':'').trim().slice(0,90);
 const id=String(item.id||'');
 if(!name||!/^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(id))return null;
 const token=`$[${name}](${id}) `;
 return {text:String(text).slice(0,range.start)+token+String(text).slice(range.end),cursor:range.start+token.length};
}

// The last typed trigger wins. A prior @Albert must not hide a later $ query.
export function activeReferenceQuery(text,cursor){
 const mention=mentionQuery(text,cursor),scene=sceneReferenceQuery(text,cursor);
 if(!mention)return scene?{...scene,type:'object'}:null;
 if(!scene)return {...mention,type:'person'};
 return scene.start>mention.start?{...scene,type:'object'}:{...mention,type:'person'};
}
