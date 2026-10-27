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
