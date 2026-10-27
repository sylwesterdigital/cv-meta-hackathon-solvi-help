// Per-object command history. A missing snapshot means creation/removal.
const copy=value=>value==null?null:JSON.parse(JSON.stringify(value));
export class EditHistory {
 constructor(limit=100){this.limit=limit;this.undoStack=[];this.redoStack=[];}
 push(before,after){if(JSON.stringify(before)===JSON.stringify(after))return false;this.undoStack.push({before:copy(before),after:copy(after)});if(this.undoStack.length>this.limit)this.undoStack.shift();this.redoStack.length=0;return true;}
 undo(apply){const action=this.undoStack.pop();if(!action)return false;apply(copy(action.before),copy(action.after));this.redoStack.push(action);return true;}
 redo(apply){const action=this.redoStack.pop();if(!action)return false;apply(copy(action.after),copy(action.before));this.undoStack.push(action);return true;}
 clear(){this.undoStack.length=0;this.redoStack.length=0;}
}
export function duplicateElevation(height){return Math.max(.32,Number.isFinite(height)?height+.16:.5);}

// Blender-like numbered names, even when cloning an existing copy.
export function nextDuplicateName(name,existing=[]){
 const base=String(name||'Object').replace(/(?:\s+copy\d*)+$/i,'');
 const prefix=base+' copy';let max=0;
 for(const candidate of existing){
  if(candidate===prefix){max=Math.max(max,1);continue;}
  if(!String(candidate).startsWith(prefix))continue;
  const suffix=String(candidate).slice(prefix.length);
  if(/^\d+$/.test(suffix))max=Math.max(max,Number(suffix));
 }
 return prefix+(max+1);
}
