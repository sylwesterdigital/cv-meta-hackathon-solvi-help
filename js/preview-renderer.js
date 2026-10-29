// Both galleries share exactly one offscreen WebGL context, not one context per card.
// Only the selected viewport's cards are rendered; never touch the active world renderer.
import * as THREE from 'three';
let instance=null;
export function renderModelThumbnail(scene,camera,width,height){
 if(!instance){
  const canvas=document.createElement('canvas');
  const renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(1);instance={renderer,canvas};
  window.addEventListener('pagehide',()=>{instance?.renderer.dispose();instance=null;},{once:true});
 }
 const {canvas,renderer}=instance;
 renderer.setSize(width,height,false);renderer.clear();renderer.render(scene,camera);
 return canvas.toDataURL('image/jpeg',.80);
}
