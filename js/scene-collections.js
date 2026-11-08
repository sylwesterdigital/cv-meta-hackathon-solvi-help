// v0.2.243: A collection is metadata on independently persisted scene objects.
// No pseudo-object is added to the authoritative scene or robot pathfinding.
const ID=/^[A-Za-z0-9_.:-]{8,90}$/;
export function cleanSceneCollection(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['id','name'].includes(k)))return null;
 const id=String(value.id||''),name=String(value.name||'').replace(/\s+/g,' ').trim();
 return ID.test(id)&&name.length>0&&name.length<=80?{id,name}:null;
}
export function legacyCreativeCollection(object){
 const match=/^SOLVI Creative · ([\w:.-]{8,90}) · \d+ · /.exec(String(object?.name||''));
 if(!match)return null;
 let hash=0;for(const ch of match[1])hash=(hash*31+ch.charCodeAt(0))%25974;
 const label=String(hash%999+1).padStart(3,'0')+String.fromCharCode(65+Math.floor(hash/999));
 return {id:'legacy:'+match[1],name:'Creative build '+label};
}
export function collectionOf(object){return object?.userData?.sceneCollectionOptOut===true?null:(cleanSceneCollection(object?.userData?.sceneCollection)||legacyCreativeCollection(object));}
export function memberDisplayName(object){
 const name=String(object?.name||'');
 const part=/^SOLVI Creative · [\w:.-]+ · \d+ · (.+)$/.exec(name);
 return part?part[1]:name;
}
export function creativeCollectionTitle(robot,design,tag,series=0){
 const who=String(robot||'Robot').trim().slice(0,25)||'Robot';
 const what=String(design||'Creative build').trim().replace(/\s+/g,' ').slice(0,42)||'Creative build';
 // Letter differentiates separately authorised projects without exposing a UUID.
 let code=0;for(const char of String(tag||''))code=(code*33+char.charCodeAt(0))%26;
 const marker=String(Math.min(999,Math.max(1,Number(series)+1))).padStart(3,'0')+String.fromCharCode(65+code);
 return `${who} - ${what} ${marker}`.slice(0,80);
}
export function groupSceneItems(items){
 const folders=new Map(),ungrouped=[];
 for(const object of items||[]){const group=collectionOf(object);
  if(!group){ungrouped.push(object);continue;}
  if(!folders.has(group.id))folders.set(group.id,{...group,items:[]});
  folders.get(group.id).items.push(object);
 }
 return {folders:[...folders.values()],ungrouped};
}

// Find an object row by its opaque ID without interpolating the ID into a CSS selector.
// Object IDs may contain colons or other CSS metacharacters.
export function findSceneObjectRow(list, objectId){
 if(!list||typeof list.querySelectorAll!=='function'||typeof objectId!=='string')return null;
 for(const row of list.querySelectorAll('[data-object-id]')){
  if(row.dataset?.objectId===objectId)return row;
 }
 return null;
}
