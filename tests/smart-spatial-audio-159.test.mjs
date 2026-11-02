import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
function audioFunctions(){
 const sounds=[];
 class PositionalAudio{
  constructor(listener){this.listener=listener;this.position={z:0};this.panner={panningModel:'equalpower'};this.connected=false;this.volume=1;sounds.push(this);}
  setMediaElementSource(media){this.source=media;this.connected=true;}
  setDistanceModel(value){this.distanceModel=value;}
  setRefDistance(value){this.refDistance=value;}
  setMaxDistance(value){this.maxDistance=value;}
  setRolloffFactor(value){this.rolloffFactor=value;}
  setDirectionalCone(...args){this.cone=args;}
  setVolume(value){this.volume=value;}
  disconnect(){this.connected=false;}
  removeFromParent(){this.detached=true;}
 }
 const THREE={PositionalAudio};
 const source=read('js/smart-media-playlist.js').replace(/^import .*?;\s*$/gm,'').replaceAll('export ','');
 const result=vm.runInNewContext(source+'\n({createSmartSpatialAudio,setSmartSpatialMuted,disposeSmartSpatialAudio,openSmartChannel,syncSmartScreen,toggleSmartScreenAudio})', {THREE,URL,WeakMap,Map,Object,Array,Math,Number,String,console});
 return {...result,sounds};
}
test('smart TV uses screen-anchored WebAudio MediaElement source, stereo HRTF, distance rolloff and forward cone',()=>{
 const {createSmartSpatialAudio,sounds}=audioFunctions();
 const video={tagName:'VIDEO'},listener={context:{}};
 const screen={geometry:{boundingBox:{max:{z:0.08}}},add(node){this.sound=node;}};
 const sound=createSmartSpatialAudio(screen,video,listener);
 assert.equal(sounds.length,1);
 assert.equal(sound.source,video);
 assert.equal(sound.listener,listener);
 assert.equal(sound.distanceModel,'inverse');
 assert.equal(sound.panner.panningModel,'HRTF');
 assert.equal(sound.refDistance,2.5);
 assert.equal(sound.maxDistance,35);
 assert.equal(sound.rolloffFactor,1);
 assert.deepEqual(Array.from(sound.cone),[240,330,0.35]);
 assert.equal(sound.position.z,0.12);
 assert.equal(screen.sound,sound);
});
test('existing mute control also mutes the spatial graph and channel cleanup disconnects it',()=>{
 const {createSmartSpatialAudio,setSmartSpatialMuted,disposeSmartSpatialAudio}=audioFunctions();
 const sound=createSmartSpatialAudio({add(){}},{},{});
 setSmartSpatialMuted(sound,true);assert.equal(sound.volume,0);
 setSmartSpatialMuted(sound,false);assert.equal(sound.volume,1);
 disposeSmartSpatialAudio(sound);assert.equal(sound.connected,false);assert.equal(sound.detached,true);
});
test('world listener is threaded to procedural TV, monitor and media-frame channel player',()=>{
 const sm=read('js/smart-media-playlist.js'),equipment=read('js/equipment-media.js'),media=read('js/scene-media.js'),world=read('js/world.js');
 assert.match(world,/this\.camera\.add\(this\.audioListener\)/);
 assert.match(equipment,/syncSmartScreen\(group,screen,p\.channels,!p\.mediaId,p,editor\?\.world\?\.audioListener\)/);
 assert.match(media,/syncSmartScreen\(mesh,mesh,media\.channels,!media\.id,media,world\?\.audioListener\)/);
 assert.match(sm,/s\.sound=createSmartSpatialAudio\(s\.screen,v,s\.audioListener\)/);
 assert.match(sm,/disposeSmartSpatialAudio\(s\.sound\)/);
 assert.match(sm,/s\.video\.muted=!s\.video\.muted/);
 assert.match(sm,/setSmartSpatialMuted\(s\.sound,s\.video\.muted\)/);
});
