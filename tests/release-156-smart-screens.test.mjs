import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const evaluate=(name,expression)=>{
 const code=read(name).replace(/^import .*?;\s*$/gm,'').replaceAll('export ','');
 return vm.runInNewContext(code+'\n'+expression,{URL,console,WeakMap,Map,Math,String,Array,Object,Number});
};
test('remote stream links accept https HLS and reject unsafe input',()=>{
 const api=evaluate('js/smart-media-playlist.js','({safeChannelUrl,cleanChannels,parseChannel})');
 const url='https://rantlist.me/media/051ddbe8-32ba-4d6b-ba99-c8122f69ac64/index.m3u8';
 assert.equal(api.safeChannelUrl(url),true);
 assert.equal(api.parseChannel(url).title,'rantlist.me');
 for(const bad of ['http://x.com/live.m3u8','javascript:alert(1)','https://user:pass@example.com/stream.m3u8','https://example.com/script.js'])assert.equal(api.safeChannelUrl(bad),false);
 const entries=api.cleanChannels(Array.from({length:15},(_,i)=>({url,title:'Channel '+i})));
 assert.equal(entries.length,12);
});
test('smart screens show named menu and allow a hit-driven return to menu',()=>{
 const screen=read('js/smart-media-playlist.js');
 for(const keyword of ['CanvasTexture','smartScreenClick','backToSmartMenu','openSmartChannel','hlsLibrary','Hls','VideoTexture','disposeSmartScreen'])assert.ok(screen.includes(keyword),keyword);
 assert.match(screen,/smartMuted/);assert.match(screen,/vendor\/hls\/hls\.min\.js/);
});
test('TV and monitor retain uploaded media IDs when channel gallery is absent',()=>{
 const code=read('js/equipment-media.js');assert.match(code,/syncSmartScreen\(group,screen,p\.channels,!p\.mediaId,p\)/);assert.match(code,/if\(!p\.mediaId\)return/);assert.match(code,/mediaBlobInfo/);
});
test('video frame can hold HTTPS channels independently of an uploaded media ID',()=>{
 const source=read('js/scene-media.js'),server=read('backend/server.py'),editor=read('js/editor.js');
 assert.match(source,/syncSmartScreen\(mesh,mesh,media\.channels,!media\.id,media\)/);
 assert.match(source,/id:'',mime:'video\/mp4'/);
 assert.match(server,/if media\.get\('id'\) and/);
 assert.match(editor,/mediaSmartChannelControls/);
 assert.match(editor,/event\.clipboardData\?\.getData\('text\/plain'\)/);
});
test('back and front wearable slots support configurable bone and pose without GLB mutation',()=>{
 const api=evaluate('js/robot-inventory.js','({cleanInventory,cleanWearAttachment,ATTACH_BONES})');
 const cfg=api.cleanWearAttachment({bone:'spine2',followRotation:false,position:[.1,-.3,.2],rotation:[0,90,0]});
 assert.equal(cfg.bone,'spine2');assert.equal(cfg.followRotation,false);
 assert.equal(cfg.position[1],-.3);
 assert.equal(api.cleanWearAttachment({bone:'malformed',position:[Infinity,90,-90]}).bone,'auto');
 assert.equal(api.cleanInventory().attachment,undefined);
 assert.equal(api.ATTACH_BONES.includes('leftShoulder'),true);
 const src=read('js/robot-inventory.js');assert.match(src,/yawDefault=slot==='back'\?90:-90/);
 assert.match(src,/bodyBackBone\(robot,settings\.bone\)/);
});
test('outdoor furniture is procedural with independently collidable pieces and recline',()=>{
 const mesh=read('js/procedural-equipment.js'),furniture=read('js/primitive-properties.js'),seating=read('js/robot-seating.js');
 for(const variant of ['sunbed','deckChair','beachUmbrella']){assert.ok(mesh.includes("'"+variant+"'"));assert.ok(furniture.includes(variant));}
 assert.match(mesh,/ConeGeometry/);assert.match(mesh,/back\.rotation\.x=-angle/);
 assert.match(seating,/robotReclineAngle/);assert.match(seating,/reclined/);
 assert.match(read('js/robots.js'),/robotSitPose==='reclined'/);
});
test('preset thumbnail uses actual projected bounds and regenerates older furniture gallery images',()=>{
 const code=read('js/object-presets.js');
 assert.match(code,/new THREE\.OrthographicCamera/);
 assert.match(code,/radius\*1\.48/);
 assert.match(code,/thumbnailFor\(preset\)/);assert.match(code,/makeFurniture\(preset\.payload\.furniture\)/);
 assert.match(code,/setScissorTest\?\.\(false\)/);
});
test('backend validators accept equipment, streams and finite wearable offsets while rejecting invalid values',()=>{
 const script=`import ast,math,re,sys\nsrc=open(sys.argv[1]).read()\nneed={'valid_smart_channels','valid_smart_options','valid_wear_attachment','valid_inventory_item','valid_basic_furniture'}\ntree=ast.parse(src)\nnodes=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in need]\nnamespace={'math':math,'re':re}\nexec(compile(ast.Module(body=nodes,type_ignores=[]),'<validators>','exec'),namespace)\nu='https://rantlist.me/media/051ddbe8-32ba-4d6b-ba99-c8122f69ac64/index.m3u8'\nch=[{'title':'Live','url':u}]\nassert namespace['valid_smart_channels'](ch)\nassert not namespace['valid_smart_channels']([{'title':'unsafe','url':'http://evil.example/live.m3u8'}])\nfor variant in ['sunbed','deckChair','beachUmbrella','tv']:\n assert namespace['valid_basic_furniture']({'variant':variant,'channels':ch})\nassert not namespace['valid_basic_furniture']({'variant':'tv','channels':[{'title':'bad','url':'javascript:1'}]})\nwear={'bone':'spine2','followRotation':False,'position':[0,-.3,0],'rotation':[0,90,0]}\nassert namespace['valid_inventory_item']({'category':'backpack','size':'bag','consumable':False,'attachment':wear})\nwear['position'][0]=float('nan')\nassert not namespace['valid_wear_attachment'](wear)\nprint('backend smart-channel and wearable validators passed')`;
 const result=spawnSync('python3',['-c',script,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr||result.stdout);
});
