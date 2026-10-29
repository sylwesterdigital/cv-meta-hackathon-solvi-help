/** Orbit input contract: no pressed pointer means no camera rotation.
 * The editor claims each gesture on pointerdown before OrbitControls sees it.
 * A transform gizmo can never transfer an active press to the orbit camera.
 */
export class OrbitGesture {
 constructor(){this.pointers=new Set();this.mode=null;}
 press(pointerId,allowOrbit){
  if(!this.pointers.size)this.mode=allowOrbit?'orbit':'transform';
  this.pointers.add(pointerId);
  return this.orbiting;
 }
 release(pointerId){
  this.pointers.delete(pointerId);
  if(!this.pointers.size)this.mode=null;
  return this.orbiting;
 }
 cancel(){this.pointers.clear();this.mode=null;}
 get orbiting(){return this.mode==='orbit'&&this.pointers.size>0;}
 get transforming(){return this.mode==='transform'&&this.pointers.size>0;}
 has(pointerId){return this.pointers.has(pointerId);}
 /** A mouse/pen hover (buttons === 0) must never inherit a lost drag. */
 orphanedMove(event){return event.pointerType!=='touch'&&event.buttons===0&&this.has(event.pointerId);}
}

/** Three r180 keeps pointer IDs after a swallowed pointerup. Recover only stale IDs.
 * This runs after the real release has propagated to OrbitControls, never during
 * a valid drag; its internal pointer-up handler performs normal cleanup.
 */
export function recoverStaleOrbitPointers(controls, activePointers){
 const ids=Array.isArray(controls?._pointers)?[...controls._pointers]:[];
 if(activePointers.size)return 0;
 let recovered=0;
 for(const pointerId of ids){
  try {controls._onPointerUp?.({pointerId});recovered++;}
  catch { // A lost capture may make releasePointerCapture throw on some browsers.
   controls.domElement?.removeEventListener?.('pointermove',controls._onPointerMove);
   controls.domElement?.removeEventListener?.('pointerup',controls._onPointerUp);
   if(Array.isArray(controls._pointers))controls._pointers.length=0;
  }
 }
 if(ids.length)controls.state=-1; // THREE OrbitControls STATE.NONE
 return recovered;
}
