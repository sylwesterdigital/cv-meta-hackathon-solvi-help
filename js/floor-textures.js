import * as THREE from 'three';
export const FLOOR_STYLES=Object.freeze(['none','concrete','soil','tarmac','sand','tiles','gradient-tiles','random-tiles']);
export function floorStyle(value){return FLOOR_STYLES.includes(value)?value:'none';}
const noise=(x,y,seed=0)=>{let n=Math.imul(x+seed*37,374761393)+Math.imul(y+seed*53,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
// Precomputed grayscale microtexture. Tinted entirely by Floor colour; no shader or image downloads.
export function floorPixel(style,x,y,size=128){
 const n=noise(x,y,3),b=noise(x>>2,y>>2,5),coarse=noise(x>>4,y>>4,7);
 if(style==='concrete')return 236+(n-.5)*11+(b-.5)*10+(coarse-.5)*8;
 if(style==='tarmac')return 215+(n-.5)*21+(b-.5)*12;
 if(style==='soil')return 224+(n-.5)*18+(b-.5)*18+(coarse-.5)*16;
 if(style==='sand')return 241+(n-.5)*18+(b-.5)*7;
 const tile=size/4,tx=Math.floor(x/tile),ty=Math.floor(y/tile);
 const seam=(x%tile<1||y%tile<1)?-24:0;
 if(style==='tiles')return 244+seam+(n-.5)*4;
 if(style==='gradient-tiles')return 227+seam+Math.sin((x%tile)/tile*Math.PI)*13+Math.cos((y%tile)/tile*Math.PI)*7+(n-.5)*3;
 if(style==='random-tiles')return 227+seam+noise(tx,ty,11)*24+(n-.5)*5;
 return 255;
}
export function createFloorTexture(style){
 if(floorStyle(style)==='none')return null;
 const size=128,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const p=(y*size+x)*4,v=Math.max(0,Math.min(255,Math.round(floorPixel(style,x,y,size))));
  pixels[p]=pixels[p+1]=pixels[p+2]=v;pixels[p+3]=255;
 }
 const tex=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
 tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;tex.generateMipmaps=true;tex.anisotropy=2;
 tex.needsUpdate=true;return tex;
}
