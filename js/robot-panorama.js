// Cylindrical horizontal panorama assembled from genuine, partially overlapping
// robot-eye JPEGs. This preview is not a substitute for the higher-detail
// individual image inputs sent to Muse Spark.
export const PANORAMA_FOV_DEGREES=72;
export const PANORAMA_STEP_DEGREES=60;
export function panoramaMode(views){
 const yaw=views?.map(view=>Number(view.yaw));
 if(!yaw?.length||views.some(view=>!Number.isFinite(Number(view.pitch))||Math.abs(Number(view.pitch)-Number(views[0].pitch))>.01))return 0;
 if(yaw.length===6&&yaw.every((value,i)=>Math.abs(value-i*60)<.01))return 360;
 if(yaw.length===3&&yaw.every((value,i)=>Math.abs(value-(i-1)*60)<.01))return 180;
 return 0;
}
export function panoramaProjection(bearing,elevation,viewYaw,viewPitch=-12,fov=PANORAMA_FOV_DEGREES){
 const rad=Math.PI/180;
 const delta=((bearing-viewYaw+540)%360)-180;
 if(Math.abs(delta)>fov/2+1e-9)return null;
 const d=delta*rad,p=viewPitch*rad,e=elevation*rad;
 // Project a spherical ray into the original pitched perspective camera.
 const forward=Math.sin(p)*Math.sin(e)+Math.cos(p)*Math.cos(e)*Math.cos(d);
 if(forward<=0)return null;
 const horizontal=Math.cos(e)*Math.sin(d)/forward;
 const vertical=(Math.cos(p)*Math.sin(e)-Math.sin(p)*Math.cos(e)*Math.cos(d))/forward;
 const tan=Math.tan(fov*rad/2);
 const u=.5+horizontal/(2*tan),v=.5-vertical/(2*tan);
 if(u<0||u>1||v<0||v>1)return null;
 // The 12-degree overlap is gently blended around each 60-degree seam.
 return {u,v,weight:Math.max(.00001,(fov/2-Math.abs(delta))/(fov/2))};
}
async function jpegPixels(blob){
 const bitmap=await createImageBitmap(blob);
 try{
  const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0);
  return {width:bitmap.width,height:bitmap.height,pixels:ctx.getImageData(0,0,bitmap.width,bitmap.height).data};
 }finally{bitmap.close?.();}
}
function sampleBilinear(view,u,v,out){
 const xx=u*(view.width-1),yy=v*(view.height-1),x=Math.floor(xx),y=Math.floor(yy);
 const fx=xx-x,fy=yy-y,xx1=Math.min(view.width-1,x+1),yy1=Math.min(view.height-1,y+1);
 const a=(y*view.width+x)*4,b=(y*view.width+xx1)*4,c=(yy1*view.width+x)*4,d=(yy1*view.width+xx1)*4;
 for(let ch=0;ch<3;ch++)out[ch]=view.pixels[a+ch]*(1-fx)*(1-fy)+view.pixels[b+ch]*fx*(1-fy)+view.pixels[c+ch]*(1-fx)*fy+view.pixels[d+ch]*fx*fy;
}
export async function stitchRobotPanorama(frames){
 const mode=panoramaMode(frames);
 if(!mode)throw Error('Panorama requires six 60° views or three 180° views with a shared camera pitch.');
 const sources=await Promise.all(frames.map(async f=>({...f,...await jpegPixels(f.blob)})));
 const width=mode===360?1920:960,height=384;
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d');const image=ctx.createImageData(width,height),dst=image.data;
 const pitch=Number(frames[0].pitch),temp=[0,0,0];
 for(let x=0;x<width;x++){
  const bearing=(mode===360?0:-90)+(x+.5)/width*mode;
  // Only the closest two camera views can contribute at 60° separation.
  const neighbours=sources.map((view,i)=>({i,delta:Math.abs(((bearing-view.yaw+540)%360)-180)})).sort((a,b)=>a.delta-b.delta).slice(0,2);
  for(let y=0;y<height;y++){
   // The camera is pitched down 12°; crop to the shared vertical coverage.
   const elevation=pitch+28-(y+.5)/height*56;
   let r=0,g=0,b=0,sum=0;
   for(const {i} of neighbours){
    const src=sources[i],projection=panoramaProjection(bearing,elevation,src.yaw,src.pitch);
    if(!projection)continue;
    sampleBilinear(src,projection.u,projection.v,temp);
    const w=projection.weight;r+=temp[0]*w;g+=temp[1]*w;b+=temp[2]*w;sum+=w;
   }
   const at=(y*width+x)*4;
   if(sum){dst[at]=r/sum;dst[at+1]=g/sum;dst[at+2]=b/sum;}else{dst[at]=9;dst[at+1]=17;dst[at+2]=29;}
   dst[at+3]=255;
  }
 }
 ctx.putImageData(image,0,0);
 const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.84));
 if(!blob?.size)throw Error('Panorama stitching could not produce a JPEG.');
 return blob;
}
