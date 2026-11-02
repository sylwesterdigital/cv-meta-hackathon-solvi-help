import * as THREE from 'three';

// Transient local-only effects. Each emitter accepts a world-space impact point;
// future smoke, debris, or authored particles can register without changing physics.
export class ImpactEffects{
 constructor(scene){this.scene=scene;this.active=[];this.emitters=new Map([['spark',(point)=>this.spark(point)]]);}
 register(name,emitter){if(typeof name==='string'&&typeof emitter==='function')this.emitters.set(name,emitter);}
 emit(point,kind='spark'){
  if(!point||![point.x,point.y,point.z].every(Number.isFinite)||!this.scene)return false;
  const effect=this.emitters.get(kind)?.(new THREE.Vector3(point.x,point.y,point.z));
  if(!effect)return false;
  this.active.push(effect);
  while(this.active.length>24)this.dispose(this.active.shift());
  return true;
 }
 spark(point){
  const count=10,velocities=[],positions=new Float32Array(count*6);
  for(let i=0;i<count;i++){
   const angle=i*Math.PI*2/count,up=.15+Math.random()*.85;
   const direction=new THREE.Vector3(Math.cos(angle),up,Math.sin(angle)).normalize();
   velocities.push(direction.multiplyScalar(1.0+Math.random()*1.8));
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.LineBasicMaterial({color:'#ffd16d',transparent:true,opacity:1,depthWrite:false});
  const mesh=new THREE.LineSegments(geometry,material);
  mesh.position.copy(point);mesh.frustumCulled=false;mesh.renderOrder=990;
  mesh.userData.impactEffect=true;this.scene.add(mesh);
  return {mesh,velocities,age:0,duration:.34};
 }
 tick(dt){
  for(const effect of [...this.active]){
   effect.age+=Math.max(0,Math.min(.1,Number(dt)||0));
   if(effect.age>=effect.duration){this.dispose(effect);this.active.splice(this.active.indexOf(effect),1);continue;}
   const t=effect.age,attr=effect.mesh.geometry.getAttribute('position');
   for(let i=0;i<effect.velocities.length;i++){
    const v=effect.velocities[i],p=t*.9,tail=Math.max(0,p-.09);
    attr.setXYZ(2*i,v.x*tail,v.y*tail-.5*4*tail*tail,v.z*tail);
    attr.setXYZ(2*i+1,v.x*p,v.y*p-.5*4*p*p,v.z*p);
   }
   attr.needsUpdate=true;effect.mesh.material.opacity=1-t/effect.duration;
  }
 }
 dispose(effect){effect?.mesh?.parent?.remove(effect.mesh);effect?.mesh?.geometry?.dispose();effect?.mesh?.material?.dispose();}
 clear(){for(const effect of this.active)this.dispose(effect);this.active=[];}
}
