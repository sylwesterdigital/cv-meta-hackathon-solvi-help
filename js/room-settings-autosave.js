// Room-scoped, last-write-wins autosave. A local draft survives closing the drawer,
// a failed request, and a page reload. All network writes for a room are serialized.
export function createRoomAutosave({persist,storage,storagePrefix,delay=450,onStatus=()=>{},onSaved=()=>{},
 setTimer=setTimeout,clearTimer=clearTimeout}){
 const states=new Map();
 const key=room=>storagePrefix+room;
 function get(room){
  if(!states.has(room))states.set(room,{draft:null,revision:0,inFlight:false,promise:null,timer:null,status:'idle',error:null});
  return states.get(room);
 }
 function notify(room,state,error=null){const entry=get(room);entry.status=state;entry.error=error;onStatus(room,state,error);}
 function draft(room){return get(room).draft;}
 function pending(room){return get(room).draft!==null;}
 function status(room){const s=get(room);return {state:s.status,error:s.error,pending:pending(room)};}
 function schedule(room,ms=delay){
  const s=get(room);if(s.timer!==null)clearTimer(s.timer);
  s.timer=setTimer(()=>{s.timer=null;void flush(room);},ms);
 }
 function update(room,value,{immediate=false}={}){
  const s=get(room);s.draft=JSON.parse(JSON.stringify(value));s.revision++;
  try{storage.setItem(key(room),JSON.stringify(s.draft));}catch{/* private mode may prohibit storage; still keep the in-memory draft */}
  notify(room,'pending');schedule(room,immediate?0:delay);
 }
 function restore(room){
  const s=get(room);if(s.draft!==null)return s.draft;
  let raw=null;try{raw=storage.getItem(key(room));}catch{}
  if(raw){try{const data=JSON.parse(raw);if(data&&typeof data==='object'&&!Array.isArray(data)){
    s.draft=data;s.revision++;notify(room,'pending');schedule(room);return data;
   }}catch{} }
  return null;
 }
 async function flush(room){
  const s=get(room);if(s.timer!==null){clearTimer(s.timer);s.timer=null;}
  if(s.inFlight)return s.promise;
  if(s.draft===null)return;
  s.inFlight=true;const rev=s.revision,value=JSON.parse(JSON.stringify(s.draft));
  notify(room,'saving');
  const work=(async()=>{
   try{
    const result=await persist(room,value);
    if(s.revision===rev){
     s.draft=null;try{storage.removeItem(key(room));}catch{}
     onSaved(room,value,result);notify(room,'saved');
    }
   }catch(error){
    if(s.revision===rev)notify(room,'error',error);
   }finally{
    s.inFlight=false;s.promise=null;
    // An edit made during the PUT must be sent after it, never concurrently.
    if(s.revision!==rev&&s.draft!==null)schedule(room,0);
   }
  })();
  s.promise=work;
  return work;
 }
 function retry(room){if(pending(room))schedule(room,0);}
 function flushAll(){for(const room of states.keys())if(pending(room))void flush(room);}
 function retryAll(){for(const room of states.keys())retry(room);}
 return {update,restore,flush,flushAll,retry,retryAll,pending,draft,status};
}
