import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {LiveRoom} from '../js/live.js';
import {safeDiagnosticDetail,formatDiagnosticEntry} from '../js/room-diagnostics.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
class BrowserEvent{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
class Socket{
 static CONNECTING=0;static OPEN=1;static CLOSED=3;static instances=[];
 constructor(url){this.url=url;this.readyState=Socket.CONNECTING;this.outgoing=[];Socket.instances.push(this);}
 send(data){this.outgoing.push(JSON.parse(data));}
 open(){this.readyState=Socket.OPEN;this.onopen?.();}
 inbound(data){this.onmessage?.({data:JSON.stringify(data)});}
 close(){this.readyState=Socket.CLOSED;this.onclose?.({code:1000});}
}
function setup(){
 Socket.instances.length=0;
 const events=[];globalThis.CustomEvent=BrowserEvent;globalThis.WebSocket=Socket;
 globalThis.location={protocol:'https:',host:'solvi.help'};
 let current={profile:{id:'brave'},token:'secret',tab:'tab'};
 const elements={networkStatus:{textContent:''}};
 globalThis.document={querySelector:()=>({classList:{toggle(){}}}),getElementById:id=>elements[id]||null};
 globalThis.window={WebSocket:Socket,solviRoom:'room-a',solviAPI:{auth:()=>current},dispatchEvent:event=>events.push(event)};
 return {events,elements,setAuth:id=>{current={...current,profile:{id}};}};
}
test('two browser clients converge to two participants and do not count socket open as a join',()=>{
 const env=setup(),braveCounts=[],safariCounts=[];
 const brave=new LiveRoom(peers=>braveCounts.push(peers.size+1),()=>{});
 brave.connect();const ws1=Socket.instances.at(-1);ws1.open();
 assert.match(env.elements.networkStatus.textContent,/Joining/);
 assert.equal(brave.joined,false);
 ws1.inbound({type:'snapshot',room:'room-a',peers:[]});assert.equal(braveCounts.at(-1),1);
 env.setAuth('safari');const safari=new LiveRoom(peers=>safariCounts.push(peers.size+1),()=>{});
 safari.connect();const ws2=Socket.instances.at(-1);ws2.open();
 ws2.inbound({type:'snapshot',room:'room-a',peers:[{id:'brave',name:'Brave user',state:{}}]});
 ws1.inbound({type:'presence',event:'joined',id:'safari',name:'Safari user'});
 assert.equal(braveCounts.at(-1),2);assert.equal(safariCounts.at(-1),2);
 assert.equal(brave.peers.size,1);assert.equal(safari.peers.size,1);
 assert.ok(env.events.some(e=>e.type==='solvi:room-diagnostic'&&e.detail.event==='presence-sync'));
 brave.close();safari.close();
});
test('missing join notifications recover from state update and authoritative snapshot',()=>{
 const env=setup(),counts=[];const browser=new LiveRoom(peers=>counts.push(peers.size+1),()=>{});
 browser.connect();const ws=Socket.instances.at(-1);ws.open();ws.inbound({type:'snapshot',room:'room-a',peers:[]});
 ws.inbound({type:'state',id:'safari',name:'Safari',state:{x:1,y:2,z:3,yaw:0}});
 assert.equal(counts.at(-1),2,'late state refreshes room count');
 ws.inbound({type:'snapshot',room:'room-a',peers:[{id:'safari',name:'Safari',state:{x:1}},{id:'firefox',name:'Firefox',state:{}}]});
 assert.equal(counts.at(-1),3);
 ws.inbound({type:'snapshot',room:'room-a',peers:[]});assert.equal(counts.at(-1),1);
 assert.ok(env.events.some(e=>e.detail?.event==='member-discovered'));
 browser.close();
});
test('disconnected clients schedule retry rather than permanently giving up after two failures',()=>{
 setup();const browser=new LiveRoom(()=>{},()=>{});browser.attempts=7;
 browser.connect();const ws=Socket.instances.at(-1);ws.open();ws.close();
 assert.equal(browser.stopped,false);assert.equal(browser.joined,false);assert.ok(browser.timer);
 assert.equal(browser.attempts,8);browser.close();assert.equal(browser.timer!==null,true);
});
test('normal user diagnostics are safe, bounded, selectable and do not require admin authentication',()=>{
 const source=read('js/room-diagnostics.js'),html=read('index.html'),dev=read('js/devlog.js');
 for(const id of ['devDiagnosticsTab','devReleasesTab','devDiagnosticCopy','devDiagnosticClear','devDiagnosticEntries'])assert.ok(html.includes(`id="${id}"`));
 assert.match(dev,/initRoomDiagnostics\(\)/);
 assert.match(source,/MAX_ENTRIES=160/);assert.match(source,/solvi:room-diagnostic/);
 assert.doesNotMatch(source,/adminToken|X-Solvi-Admin/);
 assert.doesNotMatch(JSON.stringify(safeDiagnosticDetail({event:'status',token:'secret',url:'https://token'})),/secret|https/);
 assert.match(formatDiagnosticEntry('2026-11-04T12:00:00Z','Room',{event:'presence-sync',participants:2}),/presence-sync.*participants: 2/);
});
test('server validates same-room snapshots and keeps reconnect replacement alive',()=>{
 const server=read('backend/server.py');
 assert.match(server,/if msg\.get\('type'\)=='presence-sync':/);
 assert.match(server,/if removed:publish\(\{'type':'presence','event':'left'/);
 assert.match(server,/current\['ws'\] is ws/);
 assert.match(server,/if not active or active\['ws'\] is not ws:break/);
});
test('profile-specific room preference resolves BEFORE websocket authentication event',()=>{
 const studio=read('js/studio.js');const start=studio.indexOf('async function afterLogin()');const end=studio.indexOf('async function submitProfile()',start);const body=studio.slice(start,end);
 assert.ok(body.indexOf('await configureRooms()')<body.indexOf("window.dispatchEvent(new CustomEvent('solvi:authenticated'))"));
});
