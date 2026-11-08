// Pointer dragging should move the rendered map WITH the hand, in both axes.
// `panX/panZ` denote the world point at the centre of the map.
export function mapPanAfterDrag(start,dx,dy,zoom,width,height){
 const z=Math.max(.001,Number(zoom)||35);
 const w=Math.max(1,Number(width)||1),h=Math.max(1,Number(height)||1);
 return {panX:Number(start.panX||0)-dx/w*2*z,panZ:Number(start.panZ||0)-dy/h*2*z};
}
export function mapCanvasSize(width,height,dpr=1){
 const ratio=Math.max(1,Math.min(2,Number(dpr)||1));
 return {width:Math.round(Math.max(1,width)*ratio),height:Math.round(Math.max(1,height)*ratio)};
}
