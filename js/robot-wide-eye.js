// A bounded six-camera survey, mapped to a 210° × 135° equirectangular
// mosaic. Coverage approximates a human field; it is NOT binocular stereo,
// retinal acuity, or a true one-shot perspective photograph.
export const WIDE_EYE_HORIZONTAL=210;
export const WIDE_EYE_VERTICAL=135;
export const WIDE_EYE_FOV=94;
export const WIDE_EYE_VIEWS=Object.freeze([
 {yaw:0,pitch:0,label:'front'},
 {yaw:90,pitch:0,label:'left'},
 {yaw:-90,pitch:0,label:'right'},
 {yaw:180,pitch:0,label:'rear'},
 {yaw:0,pitch:90,label:'above'},
 {yaw:0,pitch:-90,label:'below'}
]);
export function wideEyeProjection(bearing,elevation,yaw,pitch,fov=WIDE_EYE_FOV){
 const rad=Math.PI/180,b=bearing*rad,e=elevation*rad,y=yaw*rad,p=pitch*rad;
 const relative=b+y,ce=Math.cos(e),se=Math.sin(e),cp=Math.cos(p),sp=Math.sin(p);
 const forward=cp*ce*Math.cos(relative)+sp*se;
 if(forward<=0)return null;
 const tan=Math.tan(fov*rad/2);
 const u=.5-(ce*Math.sin(relative))/(2*tan*forward);
 const v=.5-(cp*se-sp*ce*Math.cos(relative))/(2*tan*forward);
 return u>=0&&u<=1&&v>=0&&v<=1?{u,v,forward}:null;
}
async function imagePixels(blob){
 const bitmap=await createImageBitmap(blob);
 try{const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const c=canvas.getContext('2d',{willReadFrequently:true});c.drawImage(bitmap,0,0);
  return {width:bitmap.width,height:bitmap.height,pixels:c.getImageData(0,0,bitmap.width,bitmap.height).data};
 }finally{bitmap.close?.();}
}
function rgb(view,u,v){const x=Math.min(view.width-1,Math.max(0,Math.floor(u*(view.width-1)))),y=Math.min(view.height-1,Math.max(0,Math.floor(v*(view.height-1)))),i=(y*view.width+x)*4;return [view.pixels[i],view.pixels[i+1],view.pixels[i+2]];}
export async function stitchRobotWideEye(frames,{width=1280,height=832}={}){
 if(!Array.isArray(frames)||frames.length!==WIDE_EYE_VIEWS.length||frames.some((f,i)=>!f?.blob||f.yaw!==WIDE_EYE_VIEWS[i].yaw||f.pitch!==WIDE_EYE_VIEWS[i].pitch))throw Error('Wide eyes require six matching real head-camera images.');
 const sources=await Promise.all(frames.map(imagePixels));
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');const out=ctx.createImageData(width,height);
 for(let y=0;y<height;y++){
  const elevation=WIDE_EYE_VERTICAL/2-(y+.5)/height*WIDE_EYE_VERTICAL;
  for(let x=0;x<width;x++){
   const bearing=-WIDE_EYE_HORIZONTAL/2+(x+.5)/width*WIDE_EYE_HORIZONTAL;
   let best=-1,second=-1,bp=null,sp=null;
   for(let i=0;i<frames.length;i++){
    const p=wideEyeProjection(bearing,elevation,frames[i].yaw,frames[i].pitch);
    if(!p)continue;
    if(p.forward>(bp?.forward??-1)){second=best;sp=bp;best=i;bp=p;}
    else if(p.forward>(sp?.forward??-1)){second=i;sp=p;}
   }
   const at=(y*width+x)*4;
   if(best<0){out.data[at]=9;out.data[at+1]=17;out.data[at+2]=29;out.data[at+3]=255;continue;}
   const first=rgb(sources[best],bp.u,bp.v);
   const blend=second>=0&&bp.forward-sp.forward<.045?(0.045-(bp.forward-sp.forward))/.09:0;
   const other=blend?rgb(sources[second],sp.u,sp.v):first;
   for(let channel=0;channel<3;channel++)out.data[at+channel]=first[channel]*(1-blend)+other[channel]*blend;
   out.data[at+3]=255;
  }
 }
 ctx.putImageData(out,0,0);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));
 if(!blob?.size)throw Error('Wide eye capture could not produce a JPEG');return blob;
}
