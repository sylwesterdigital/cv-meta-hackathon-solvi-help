// Lightweight local recognition from MediaPipe HandLandmarker landmarks.
// A 3D emoji is visual feedback only, not a medical or accessibility input.
export function classifyHandGesture(points){
 if(!Array.isArray(points)||points.length!==21)return null;
 const distance=(i,j)=>Math.hypot(points[i].x-points[j].x,points[i].y-points[j].y);
 const extended=(tip,pip,mcp)=>distance(tip,mcp)>distance(pip,mcp)*1.3;
 const extendedFingers=[extended(8,6,5),extended(12,10,9),extended(16,14,13),extended(20,18,17)];
 const count=extendedFingers.filter(Boolean).length;
 const thumbOut=distance(4,5)>distance(3,5)*1.2;
 // Thumbs-up needs thumb above (in image coordinates) the other curled fingers.
 if(count===0 && thumbOut && points[4].y<points[3].y-0.08)return 'thumbs-up';
 if(count===0 && distance(8,0)<distance(5,0)*1.6)return 'fist';
 if(extendedFingers[0]&&!extendedFingers[1]&&!extendedFingers[2]&&!extendedFingers[3])return 'point';
 if(count===4)return 'open-hand';
 return null;
}
export function showGestureInWorld(THREE,world,gesture){
 const emoji={'thumbs-up':'👍',fist:'✊',point:'☝️','open-hand':'👋'}[gesture];if(!emoji||!world?.scene||!world?.camera)return;
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
 const context=canvas.getContext('2d');context.font='170px sans-serif';context.textAlign='center';context.textBaseline='middle';context.fillText(emoji,128,133);
 const texture=new THREE.CanvasTexture(canvas);const material=new THREE.SpriteMaterial({map:texture,transparent:true,depthTest:false});const sprite=new THREE.Sprite(material);
 const camera=world.camera;const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
 sprite.position.copy(camera.position).addScaledVector(forward,2.4).add(new THREE.Vector3(0,.25,0));sprite.scale.set(.52,.52,1);sprite.renderOrder=200;world.scene.add(sprite);
 setTimeout(()=>{world.scene.remove(sprite);texture.dispose();material.dispose();},2100);
}
