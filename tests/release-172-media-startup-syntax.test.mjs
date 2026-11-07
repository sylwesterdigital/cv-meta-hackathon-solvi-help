import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {spawnSync} from './helpers/subprocess-test.mjs';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
function smartFunctions(globals={}){
 const source=read('js/smart-media-playlist.js').replace(/^import .*?;\s*$/gm,'').replaceAll('export ','');
 return vm.runInNewContext(source+'\n({waitForStreamReady,attachRemoteStream,startStreamPlayback})',
  {URL,WeakMap,Map,Object,Array,Math,Number,String,Error,Promise,setTimeout,clearTimeout,console,...globals});
}
function video(){
 const listeners=new Map();
 const result={readyState:0,muted:false,canPlayType:()=>'',
  addEventListener(name,fn){const s=listeners.get(name)||new Set();s.add(fn);listeners.set(name,s);},
  removeEventListener(name,fn){listeners.get(name)?.delete(fn);},
  emit(name){for(const fn of listeners.get(name)||[])fn({type:name});},
  load(){},play(){return Promise.resolve();}};
 return result;
}
test('every packaged JavaScript module and Node test passes syntax check',()=>{
 for(const directory of ['js','scripts','tests']){
  for(const filename of fs.readdirSync(path.join(root,directory))){
   if(!/\.(?:js|mjs)$/.test(filename))continue;
   const file=path.join(root,directory,filename);
   const result=spawnSync(process.execPath,['--check',file],{encoding:'utf8'});
   assert.equal(result.status,0,`${directory}/${filename}\n${result.stderr}`);
  }
 }
});
test('HLS attaches media before requesting manifest and waits until media is ready',async()=>{
 const actions=[];
 class Hls{
  static Events={MEDIA_ATTACHED:'attached',MANIFEST_PARSED:'manifest',ERROR:'error'};
  static isSupported(){return true;}
  constructor(){this.handlers=new Map();}
  on(event,callback){this.handlers.set(event,callback);}
  attachMedia(v){actions.push('attach');this.media=v;
   queueMicrotask(()=>this.handlers.get('attached')?.());}
  loadSource(url){actions.push('load');assert.equal(url,'https://cdn.example.com/live.m3u8');
   queueMicrotask(()=>{actions.push('manifest');this.handlers.get('manifest')?.();
    this.media.readyState=2;this.media.emit('loadedmetadata');});}
 }
 const {attachRemoteStream}=smartFunctions({Hls});
 const v=video();let saved=null;
 const played=await attachRemoteStream(v,'https://cdn.example.com/live.m3u8',{storeHls:hls=>{saved=hls;}});
 assert.equal(played,true);assert.ok(saved);
 assert.deepEqual(actions,['attach','load','manifest']);
});
test('direct MP4 waits for metadata instead of trying to play an unready video',async()=>{
 const {attachRemoteStream}=smartFunctions();const v=video();
 v.load=()=>queueMicrotask(()=>{v.readyState=2;v.emit('loadedmetadata');});
 assert.equal(await attachRemoteStream(v,'https://cdn.example.com/movie.mp4'),true);
 assert.equal(v.src,'https://cdn.example.com/movie.mp4');
});
test('autoplay restriction retries muted playback and marks the UI muted',async()=>{
 const {startStreamPlayback}=smartFunctions();const v=video();let attempts=0,notified=0;
 v.play=()=>{attempts++;return attempts===1?Promise.reject(Object.assign(new Error('Autoplay blocked'),{name:'NotAllowedError'})):Promise.resolve();};
 assert.equal(await startStreamPlayback(v,{onMuted:()=>notified++}),true);
 assert.equal(v.muted,true);assert.equal(attempts,2);assert.equal(notified,1);
});
test('monitor and TV use repaired shared channel loader; HLS failure returns a visible menu',()=>{
 const src=read('js/smart-media-playlist.js'),equipment=read('js/equipment-media.js'),editor=read('js/editor.js');
 assert.match(src,/await attachRemoteStream\(v,channel\.url/);
 assert.match(src,/if\(v\.readyState>=2\)draw\(\)/);
 assert.match(src,/showSmartStreamError/);
 assert.match(equipment,/await attachRemoteStream\(video,item\.url/);
 assert.match(editor,/\/\/ history\/save entry on every pointer movement\./);
});
