/** 0..1000 maps geometrically to 0.01..1000 to keep useful precision across sizes. */
export function sliderToScale(t){return Math.pow(10,-2+Math.max(0,Math.min(1000,Number(t)))/200);}
export function scaleToSlider(value){return Math.max(0,Math.min(1000,(Math.log10(Math.max(.01,Number(value)||.01))+2)*200));}
export function linkedScale(vector,axis,next){
 const key=Array.isArray(axis)?axis[0]:axis;
 const previous=Number(vector?.[key]);
 const newValue=Math.max(.001,Math.min(100000,Number(next)));
 if(!Number.isFinite(newValue))return {...vector};
 const factor=previous>0?newValue/previous:1;
 return {x:key==='x'?newValue:previous>0?vector.x*factor:newValue,y:key==='y'?newValue:previous>0?vector.y*factor:newValue,z:key==='z'?newValue:previous>0?vector.z*factor:newValue};
}
