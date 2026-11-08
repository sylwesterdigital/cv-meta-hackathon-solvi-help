// /ai is an explicit human-to-Meta request. Never dispatch it to robot tasks.
export function parseAiChatCommand(text){
 const source=String(text||'').trim(),match=/^\/ai(?:\s+|$)([\s\S]*)/i.exec(source);if(!match)return null;
 let prompt=match[1].trim(),mode='ask',robot='';
 if(/^--file\s+/i.test(prompt)){mode='file';prompt=prompt.replace(/^--file\s+/i,'').trim();}
 else if(/^--image\s+/i.test(prompt)){mode='image-generate';prompt=prompt.replace(/^--image\s+/i,'').trim();}
 else if(/^--eyes(?:\s+|$)/i.test(prompt)){
  mode='eyes';prompt=prompt.replace(/^--eyes\s*/i,'');const named=/^@([\p{L}\p{N}_ -]{1,80})\s*:\s*/u.exec(prompt);
  if(named){robot=named[1].trim();prompt=prompt.slice(named[0].length);}
 }
 if((prompt.startsWith('"')&&prompt.endsWith('"'))||(prompt.startsWith("'")&&prompt.endsWith("'")))prompt=prompt.slice(1,-1);
 return {mode,prompt:prompt.trim(),robot};
}
export function safeAiFileName(input){return String(input||'solvi-ai-draft.txt').replace(/[^\w.\-]/g,'_').slice(0,80)||'solvi-ai-draft.txt';}
