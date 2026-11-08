// Use a single isotropic world-to-pixel scale for both map dimensions.
// Resizing a rectangular viewport reveals more map in the long direction,
// never stretching circles into ellipses or changing drag speed per axis.
export function mapPixelsPerMeter(zoom,width,height){
 const z=Math.max(.001,Number(zoom)||35);
 const side=Math.max(1,Math.min(Number(width)||1,Number(height)||1));
 return side/(2*z);
}
export function mapPanAfterDrag(start,dx,dy,zoom,width,height){
 const scale=mapPixelsPerMeter(zoom,width,height);
 return {panX:Number(start.panX||0)-dx/scale,panZ:Number(start.panZ||0)-dy/scale};
}
export function mapCanvasSize(width,height,dpr=1){
 const ratio=Math.max(1,Math.min(2,Number(dpr)||1));
 return {width:Math.round(Math.max(1,width)*ratio),height:Math.round(Math.max(1,height)*ratio)};
}
