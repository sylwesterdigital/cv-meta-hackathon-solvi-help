// Pure floor-panel model. Both mouse and WebXR drive the same target.
export const LIFT_BUTTON_COLORS=Object.freeze({idle:0x228e53,destination:0xdc3547,passing:0xf3a43b});
export function liftPanelState(lift={},runtime={}){
 const count=Math.max(2,Math.min(12,Math.round(Number(lift.levels)||2)));
 const spacing=Math.max(1.8,Math.min(8,Number(lift.levelHeight)||3));
 const height=Math.max(0,Math.min((count-1)*spacing,Number(runtime.height)||0));
 const target=Math.max(0,Math.min(count-1,Math.round(Number(runtime.target??lift.target)||0)));
 const moving=runtime.moving===true;
 const nearby=Math.max(0,Math.min(count-1,Math.round(height/spacing)));
 return {count,target,moving,nearby,display:nearby+1,
  colors:Array.from({length:count},(_,i)=>moving&&i===nearby?'passing':runtime.commanded===true&&i===target?'destination':'idle')};
}
export function liftButtonRequest(lift,button){
 const level=Number(button?.userData?.liftLevel);
 if(!Number.isInteger(level)||level<0||level>=Math.max(2,Math.min(12,Number(lift?.levels)||2)))return null;
 return level;
}
