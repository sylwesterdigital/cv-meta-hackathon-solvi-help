// Strictly ground an explicit, direct single-object transfer in unique scene
// names. Do not infer IDs from the model or treat ordinary conversation as work.
export function chatSingleObjectTransfer(text='',robotName='',objects=[]){
 const message=String(text||'').trim().slice(0,1800);
 if(!robotName||!message.toLowerCase().startsWith('@'+robotName.toLowerCase()+' '))return null;
 const body=message.slice(robotName.length+2);
 const verb=/\b(?:pick\s*up|grab|carry|take|move|put|bring)\b/i.exec(body);
 if(!verb)return null;
 const after=body.slice(verb.index+verb[0].length);
 const separator=/\b(?:into|onto|inside|toward|towards|near|beside|next\s+to|to|by|in|on)\b/i.exec(after);
 if(!separator)return null;
 const sourceText=after.slice(0,separator.index).toLowerCase(),targetText=after.slice(separator.index+separator[0].length).toLowerCase();
 const choices=(part,isTarget=false)=>{
  const specified=part.trim().replace(/^(?:the|a|an|that|this)\s+/i,'').replace(/[?.!,]+$/g,'').replace(/\s+(?:right now|please|now)$/i,'').trim();
  const candidates=objects.filter(o=>o?.kind!=='robot'&&typeof o?.name==='string'&&typeof o?.id==='string'&&
   (isTarget?specified===o.name.toLowerCase():part.includes(o.name.toLowerCase()))&&o.name.trim().length>=3);
  // Prefer a fully specified name over a contained alias like Bin vs Bin - Big Junk.
  candidates.sort((a,b)=>b.name.length-a.name.length);
  if(!candidates.length)return null;
  const longest=candidates[0].name.length;
  return candidates.filter(o=>o.name.length===longest).length===1?candidates[0]:null;
 };
 const source=choices(sourceText),destination=choices(targetText,true);
 if(!source||!destination||source.id===destination.id)return null;
 return {sourceId:source.id,destinationId:destination.id,sourceName:source.name,destinationName:destination.name};
}
