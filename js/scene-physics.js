import * as THREE from 'three';
import {physicsOptions} from './physics-options.js';
export class ScenePhysics{
 constructor(editor){this.editor=editor;this.enabled=false;this.runtime=null;this.world=null;this.bodies=new Map();this.accumulator=0;this.lastBroadcast=new Map();this.loading=null;}
 async setEnabled(enabled){
  if(!enabled){this.enabled=false;this.clear();return;}
  if(this.enabled&&this.world)return;
  if(this.loading)return this.loading;
  this.loading=(async()=>{
    try{if(!this.runtime){const module=await import('../vendor/rapier/rapier.mjs');this.runtime=module.default||module;await this.runtime.init();}
     this.clear();this.world=new this.runtime.World({x:0,y:-9.81,z:0});
     const floor=this.runtime.ColliderDesc.cuboid(100,.12,100).setTranslation(0,-.12,0);
     this.world.createCollider(floor);this.enabled=true;
     for(const obj of this.editor.items)this.sync(obj);
    }catch(e){this.enabled=false;this.clear();throw e;}
    finally{this.loading=null;}
  })();return this.loading;
 }
 clear(){this.bodies.clear();if(this.world){this.world.free();this.world=null;}this.accumulator=0;this.lastBroadcast.clear();}
 remove(id){const body=this.bodies.get(id);if(body&&this.world){this.world.removeRigidBody(body);this.bodies.delete(id);}this.lastBroadcast.delete(id);}
 sync(obj){
  if(!this.enabled||!this.world||!obj)return;
  const id=obj.userData.editorId;if(!id)return;
  const opts=physicsOptions(obj.userData.physics);
  this.remove(id);
  if(opts.mode==='off'||obj.userData.editorKind==='robot'||obj.userData.editorKind==='light')return;
  // Server-stored objects are only simulated by the owning client. Others render snapshots.
  const localId=window.solviAPI?.auth()?.profile?.id;
  if(obj.userData.ownerId&&localId!==obj.userData.ownerId)return;
  const R=this.runtime;
  let desc=opts.mode==='dynamic'?R.RigidBodyDesc.dynamic():opts.mode==='kinematic'?R.RigidBodyDesc.kinematicPositionBased():R.RigidBodyDesc.fixed();
  desc=desc.setTranslation(obj.position.x,obj.position.y,obj.position.z).setRotation({x:obj.quaternion.x,y:obj.quaternion.y,z:obj.quaternion.z,w:obj.quaternion.w});
  const body=this.world.createRigidBody(desc);
  let geometry;
  if(obj.userData.editorKind==='sphere'){
   geometry=R.ColliderDesc.ball(Math.max(.05,obj.scale.x*.55));
  }else{
   const bounds=new THREE.Box3().setFromObject(obj);const size=bounds.getSize(new THREE.Vector3());
   geometry=R.ColliderDesc.cuboid(Math.max(.05,size.x/2),Math.max(.05,size.y/2),Math.max(.05,size.z/2));
  }
  geometry.setFriction(opts.friction).setRestitution(opts.restitution);
  this.world.createCollider(geometry,body);this.bodies.set(id,body);
 }
 tick(dt){
  if(!this.enabled||!this.world)return;
  this.accumulator=Math.min(.10,this.accumulator+Math.max(0,dt));let steps=0;
  for(const obj of this.editor.items){const body=this.bodies.get(obj.userData.editorId);if(!body)continue;
   if(this.editor.selected===obj&&this.editor.world.editorDragging){body.setTranslation(obj.position,true);body.setRotation(obj.quaternion,true);body.setLinvel({x:0,y:0,z:0},true);}
   if(obj.userData.physics?.mode==='kinematic'){body.setNextKinematicTranslation(obj.position);body.setNextKinematicRotation(obj.quaternion);}
  }
  while(this.accumulator>=1/60&&steps++<6){this.world.timestep=1/60;this.world.step();this.accumulator-=1/60;}
  const now=performance.now();for(const obj of this.editor.items){const id=obj.userData.editorId,body=this.bodies.get(id);if(!body||obj.userData.physics?.mode!=='dynamic')continue;
   if(this.editor.selected===obj&&this.editor.world.editorDragging)continue;
   const p=body.translation(),q=body.rotation();obj.position.set(p.x,p.y,p.z);obj.quaternion.set(q.x,q.y,q.z,q.w);
   if(now-(this.lastBroadcast.get(id)||0)>1100&&!body.isSleeping()&&this.editor.canEdit(obj)){this.lastBroadcast.set(id,now);this.editor.queueSave(obj);}
  }
 }
}
