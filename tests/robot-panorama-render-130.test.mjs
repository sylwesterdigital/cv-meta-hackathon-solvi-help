import test from 'node:test';
import assert from 'node:assert/strict';
import {stitchRobotPanorama} from '../js/robot-panorama.js';

// Synthetic photos verify actual pixel placement, blend and wraparound without WebGL.
test('360 stitched panorama places each photo in yaw order, blends 60-degree seams and wraps last into first',async()=>{
 const originalDocument=globalThis.document;
 const originalBitmap=globalThis.createImageBitmap;
 let stitched;
 const palette=[[240,0,0],[0,240,0],[0,0,240],[240,240,0],[240,0,240],[0,240,240]];
 globalThis.createImageBitmap=async blob=>({width:4,height:4,blob,close(){}});
 globalThis.document={createElement(name){
  assert.equal(name,'canvas');
  const canvas={width:0,height:0,source:null};
  const ctx={
   drawImage(bitmap){canvas.source=bitmap.blob;},
   getImageData(){const data=new Uint8ClampedArray(canvas.width*canvas.height*4);const color=canvas.source.color;for(let i=0;i<data.length;i+=4){data.set([...color,255],i);}return {data};},
   createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)};},
   putImageData(image){stitched={width:canvas.width,height:canvas.height,data:image.data};}
  };
  canvas.getContext=()=>ctx;
  canvas.toBlob=callback=>callback({size:1,type:'image/jpeg'});
  return canvas;
 }};
 try{
  const photos=palette.map((color,i)=>({blob:{color},yaw:i*60,pitch:-12}));
  const jpg=await stitchRobotPanorama(photos);
  assert.equal(jpg.size,1);
  assert.equal(stitched.width,1920);
  const rgbAt=degrees=>{
   const x=Math.floor(degrees/360*stitched.width)%stitched.width;
   const offset=(Math.floor(stitched.height/2)*stitched.width+x)*4;
   return [...stitched.data.slice(offset,offset+3)];
  };
  for(let i=0;i<6;i++)assert.deepEqual(rgbAt(i*60),palette[i],`view ${i} at bearing ${i*60} should preserve its photographed colour`);
  const seam=rgbAt(30);
  assert.ok(seam[0]>80 && seam[1]>80 && seam[2]<10,'first seam combines first and second photos');
  const wrap=rgbAt(330);
  assert.ok(wrap[0]>50&&wrap[1]>50&&wrap[2]>50,'last seam blends last and first photos across panorama boundary');
 }finally{globalThis.document=originalDocument;globalThis.createImageBitmap=originalBitmap;}
});
