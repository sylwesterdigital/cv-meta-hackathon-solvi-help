/** Screen-space trackpad scrolling translates camera and target together. */
export function isTrackpadPan(event){
 if(event.ctrlKey)return false; // Browser pinch gesture -> native OrbitControls zoom.
 const dx=Math.abs(Number(event.deltaX)||0),dy=Math.abs(Number(event.deltaY)||0);
 return event.deltaMode===0&&(dx>0||dy>0)&&(dx>0||dy<70);
}
export function trackpadPanDelta(dx,dy,distance,fovDegrees,viewportHeight){
 const vertical=2*Math.tan(Math.PI*Math.max(1,Math.min(160,fovDegrees))/360)*Math.max(.35,distance);
 const factor=vertical/Math.max(1,viewportHeight);
 return {x:-(Number(dx)||0)*factor,y:(Number(dy)||0)*factor};
}
