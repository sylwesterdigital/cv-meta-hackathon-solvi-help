import {collectionOf} from './scene-collections.js';

// A folder is only a label over real objects. Deletion must target every
// independently persisted member, never a partial filtered/search result.
export function collectionDeletionPlan(items, requestedIds, canEdit){
 const ids=[...new Set(Array.from(requestedIds||[]).filter(id=>typeof id==='string'))];
 const permitted=[],blocked=[],objects=[],seen=new Set();
 for(const id of ids){
  const members=(items||[]).filter(obj=>collectionOf(obj)?.id===id);
  if(!members.length||members.some(obj=>obj.userData?.editorKind==='robot'||!canEdit(obj))){
   blocked.push(id);continue;
  }
  permitted.push(id);
  for(const object of members){const key=object.userData?.editorId;
   if(!key||seen.has(key))continue;
   seen.add(key);objects.push(object);
  }
 }
 return {permitted,blocked,objects};
}
