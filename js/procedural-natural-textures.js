import * as THREE from 'three';

// Deterministic, tileable value noise. One 128x128 RGBA texture costs 64 KiB CPU-side;
// no large bundled textures, network requests or per-frame procedural shader work.
export const NATURAL_MATERIALS=['wood','marble','granite'];
const fract=v=>v-Math.floor(v);
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
function hash(x,y,seed){let v=Math.imul((x|0)+seed*71,374761393)^Math.imul((y|0)-seed*37,668265263);v=Math.imul(v^(v>>>13),1274126177);return ((v^(v>>>16))>>>0)/4294967295;}
function valueNoise(x,y,period,seed){
 const ix=Math.floor(x),iy=Math.floor(y),fx=fract(x),fy=fract(y);
 const u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy);
 const wrap=k=>((k%period)+period)%period;
 const a=hash(wrap(ix),wrap(iy),seed),b=hash(wrap(ix+1),wrap(iy),seed),c=hash(wrap(ix),wrap(iy+1),seed),d=hash(wrap(ix+1),wrap(iy+1),seed);
 return (a+(b-a)*u)*(1-v)+(c+(d-c)*u)*v;
}
function fbm(u,v,seed){let value=0,weight=.55;for(let octave=0;octave<4;octave++){const period=4*(1<<octave);value+=weight*valueNoise(u*period,v*period,period,seed+octave);weight*=.5;}return value/1.03125;}
export function naturalPixel(kind,x,y,size=128,options={}){
 const scale=clamp(Number(options.scale)||1,.25,5),distortion=clamp(Number(options.distortion??.38),0,2);
 const contrast=clamp(Number(options.contrast??1),.2,3);
 const u=fract(x/size),v=fract(y/size),n=fbm(u,v,9);
 let rgb;
 if(kind==='wood'){
  const grain=Math.sin((u*Math.round(11*scale)+distortion*(fbm(u,v,25)-.5)*3)*Math.PI*2+Math.sin(v*6.283)*.4);
  const bands=.5+.5*grain,variation=.18*(n-.5);
  rgb=[128+74*bands+variation*180,72+65*bands+variation*100,37+38*bands+variation*65];
 }else if(kind==='marble'){
  const wave=Math.sin((u*Math.round(3*scale)+v*Math.round(2*scale)+distortion*(fbm(u,v,33)-.5)*5)*Math.PI*2);
  const veins=Math.pow(Math.max(0,wave),9),shade=.85+.18*n-.44*veins;
  rgb=[229*shade+12,228*shade+11,220*shade+13];
 }else{
  const mineral=fbm(u,v,71),speck=hash(Math.floor(u*size*scale),Math.floor(v*size*scale),93);
  const light=.58+.5*mineral+(speck>.93?.3:0)-(speck<.12?.27:0);
  rgb=[178*light,171*light,160*light];
 }
 return rgb.map(c=>Math.round(clamp(128+(c-128)*contrast,0,255)));
}
export function naturalTexture(kind,options={}){
 if(!NATURAL_MATERIALS.includes(kind))return null;
 const size=128,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const color=naturalPixel(kind,x,y,size,options),i=(y*size+x)*4;
  pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];pixels[i+3]=255;
 }
 const tex=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);
 tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;
 tex.magFilter=THREE.LinearFilter;tex.minFilter=THREE.LinearMipmapLinearFilter;
 tex.generateMipmaps=true;tex.anisotropy=2;tex.needsUpdate=true;
 return tex;
}
