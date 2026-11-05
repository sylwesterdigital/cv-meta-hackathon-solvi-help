// Reject malformed, unexpectedly destructive server snapshots before touching a
// rendered room. The server owns the authoritative scene, but a broken GET must
// never be mistaken for an intentional clear/revision reconciliation.
export function validateSceneSnapshot(data,{localCount=0,sameRoom=false}={}){
 if(!data||typeof data!=='object'||!Number.isSafeInteger(data.revision)||data.revision<0||!Array.isArray(data.objects))
  return {ok:false,reason:'Malformed scene response'};
 if(data.objects.length>512)return {ok:false,reason:'Scene response exceeds room object limit'};
 if(sameRoom&&localCount>=4&&data.objects.length===0)
  return {ok:false,reason:'Empty server scene would erase an already populated room; review server backups'};
 const ids=new Set();
 for(const entry of data.objects){
  if(!entry||typeof entry!=='object'||typeof entry.id!=='string'||entry.id.length<1||ids.has(entry.id)||typeof entry.kind!=='string')
   return {ok:false,reason:'Scene response contains missing or duplicate object identifiers'};
  ids.add(entry.id);
  if(!['cube','sphere','cylinder','plane','torus','curve','surface','text','points','light','robot','model','media','wall','stairs','ladder','portal','furniture'].includes(entry.kind)||
     !['position','rotation','scale'].every(field=>Array.isArray(entry[field])&&entry[field].length===3&&entry[field].every(n=>typeof n==='number'&&Number.isFinite(n))))
   return {ok:false,reason:'Scene response contains invalid object geometry or transform'};
 }
 return {ok:true,count:ids.size};
}
