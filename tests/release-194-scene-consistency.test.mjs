import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {LiveRoom} from '../js/live.js';
import {presetEntry} from '../js/object-preset-data.js';
import {sanitiseStairs} from '../js/office-stairs-math.js';
import {stairGeometryKey} from '../js/stair-extensions.js';
import {safeDiagnosticDetail,formatDiagnosticEntry} from '../js/room-diagnostics.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

class BrowserEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
class Socket{
 static CONNECTING=0; static OPEN=1;static instances=[];
 constructor(){this.readyState=Socket.CONNECTING;Socket.instances.push(this);this.outgoing=[];}
 open(){this.readyState=Socket.OPEN;this.onopen?.();}
 inbound(data){this.onmessage?.({data:JSON.stringify(data)});}
 send(data){this.outgoing.push(JSON.parse(data));}
 close(){this.readyState=3;this.onclose?.({code:1000});}
}
function browser(){
 Socket.instances.length=0;const events=[];
 globalThis.CustomEvent=BrowserEvent;globalThis.WebSocket=Socket;globalThis.location={protocol:'https:',host:'solvi.help'};
 globalThis.document={querySelector:()=>({classList:{toggle(){}}}),getElementById:()=>null};
 globalThis.window={WebSocket:Socket,solviRoom:'main',solviAPI:{auth:()=>({token:'fixture',tab:'tab',profile:{id:'userA'}})},dispatchEvent:e=>events.push(e)};
 return events;
}
test('room presence checkpoints trigger scene reconciliation, rather than masquerading as scene health',()=>{
 const events=browser();const live=new LiveRoom(()=>{},()=>{});live.connect();const socket=Socket.instances.at(-1);socket.open();
 socket.inbound({type:'snapshot',room:'main',peers:[{id:'FireTata',name:'FireTata'}]});
 assert.ok(events.some(e=>e.type==='solvi:scene-resync'&&e.detail.room==='main'));
 socket.inbound({type:'scene-changed',room:'main',revision:11,by:'userB',action:'upsert',id:'cube-12345',object:{id:'cube-12345',kind:'cube',name:'Cube'}});
 assert.ok(events.some(e=>e.type==='solvi:scene-changed'&&e.detail.revision===11));
 assert.ok(events.some(e=>e.detail?.event==='scene-revision-received'&&e.detail.kind==='cube'));
 socket.inbound({type:'scene-changed',room:'other',revision:12,by:'userB',action:'remove',id:'cube-12345'});
 assert.equal(events.filter(e=>e.type==='solvi:scene-changed').length,1);
 live.close();
});
test('scene diagnostics show object saves and errors, without leaking credentials',()=>{
 const safe=safeDiagnosticDetail({event:'scene-save-failed',room:'main',id:'cube-12345',kind:'cube',name:'My cube',revision:25,action:'upsert',reason:'Request failed token=secret',accessToken:'should-not-render'});
 assert.equal(safe.id,'cube-12345');assert.equal(safe.revision,25);assert.equal(safe.kind,'cube');
 assert.doesNotMatch(JSON.stringify(safe),/secret|should-not-render/);
 assert.match(formatDiagnosticEntry('2026-11-05T02:40:00Z','Room',safe),/scene-save-failed.*kind: cube/);
});
test('cube preset openings are preserved as arrays and backend uses scene-equivalent opening validation',()=>{
 const value={kind:'cube',name:'Cut cube',scale:[1,1,1],rotation:[0,0,0],color:'#ff00aa',texture:'none',openings:[{axis:'x',u:0,v:0,width:1,height:1}],primitive:{bevel:0}};
 assert.deepEqual(presetEntry(value).openings,value.openings);
 const server=read('backend/server.py');
 assert.match(server,/if 'openings' in entry and \(entry\['kind'\]!='cube' or not valid_cube_openings\(entry\['openings'\]\)\)/);
 assert.doesNotMatch(server,/for key in \('furniture','primitive','curve','text','openings'/);
 const python=`import ast,sys,re,math
root=ast.parse(open(sys.argv[1]).read())
funcs=[n for n in root.body if isinstance(n,ast.FunctionDef) and n.name in {'valid_cube_openings','_preset_finite'}]
ns={'re':re,'math':math};exec(compile(ast.Module(body=funcs,type_ignores=[]),'<validators>','exec'),ns)
assert ns['valid_cube_openings']([{'axis':'x','u':0,'v':0,'width':1,'height':1}])
assert not ns['valid_cube_openings']({'axis':'x'})
assert not ns['valid_cube_openings']([{'axis':'x','u':0,'v':0,'width':-1,'height':1}])
print('preset openings OK')`;
 const out=spawnSync('python3',['-c',python,new URL('../backend/server.py',import.meta.url).pathname],{encoding:'utf8'});
 assert.equal(out.status,0,out.stderr);assert.match(out.stdout,/preset openings OK/);
});
test('single-flight stairs keep surface colour and texture in their own procedural configuration',()=>{
 const state=sanitiseStairs({points:[[0,0],[0,3]],width:1.1,height:2.8,steps:12,color:'#914dc8',surface:{color:'#914dc8',texture:'wood',material:'matte'}});
 assert.equal(state.surface.color,'#914dc8');assert.equal(state.surface.texture,'wood');
 const recoloured=sanitiseStairs({...state,color:'#00cc88',surface:{...state.surface,color:'#00cc88'}});
 assert.equal(recoloured.surface.color,'#00cc88');assert.notEqual(stairGeometryKey(state),stairGeometryKey(recoloured));
 const ed=read('js/editor.js');assert.match(ed,/rebuildOfficeStairs\(obj,\{\.\.\.state,color:e\.target\.value,surface:\{\.\.\.state\.surface,color:e\.target\.value\}\}\)/);
 assert.match(ed,/rebuildOfficeStairs\(obj,\{\.\.\.state,surface:\{\.\.\.state\.surface,texture:name\}\}\)/);
});
test('scene saves are per-object, locally dirty edits survive incoming snapshots, and failed writes are logged',()=>{
 const src=read('js/editor.js');
 assert.match(src,/this\.dirtyGenerations=new Map\(\)/);
 assert.match(src,/this\.inFlightSaves=new Map\(\)/);
 assert.match(src,/if\(!this\.dirtyGenerations\.has\(entry\.id\)&&!this\.pendingRemovals\.has\(entry\.id\)\)this\.applyObjectPatch/);
 assert.match(src,/scene-revision-gap/);assert.match(src,/scene-conflict-preserved/);
 assert.match(src,/scene-save-failed/);assert.match(src,/scene-object-saved/);
 assert.match(src,/Promise\.allSettled\(ids\.map/);
 assert.doesNotMatch(src,/api\.req\('\/api\/scene',\{method:'PUT'/);
});
test('object capacity is consistent for scene save, incremental patches, realm clone and archive import',()=>{
 const server=read('backend/server.py'),archives=read('backend/realm_archives.py');
 assert.match(server,/MAX_ROOM_SCENE_OBJECTS = 512/);
 assert.match(server,/len\(objects\)>MAX_ROOM_SCENE_OBJECTS/);
 assert.match(server,/len\(items\)>=MAX_ROOM_SCENE_OBJECTS/);
 assert.match(archives,/len\(objects\)>512/);
 assert.match(server,/con\.execute\('BEGIN IMMEDIATE'\)\n        old=con\.execute\('SELECT revision FROM room_scenes/);
});
