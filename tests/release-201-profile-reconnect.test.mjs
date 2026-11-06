import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {claimProfileTab,clearOnlyCurrentToken,requireSharedBackend} from '../js/profile-session-ownership.js';
const src = name => readFileSync(new URL('../'+name, import.meta.url), 'utf8');

class FakeChannel {
 static channels=[];
 constructor(name){this.name=name;this.closed=false;FakeChannel.channels.push(this);}
 postMessage(data){for(const other of FakeChannel.channels){if(other!==this&&other.name===this.name&&!other.closed)other.onmessage?.({data});}}
 close(){this.closed=true;}
}

test('newly signed-in tab takes ownership; old tab yields, new tab is NOT invalidated',()=>{
 FakeChannel.channels=[];
 const events=[];
 const old=claimProfileTab('profile','old-page',FakeChannel,()=>events.push('old-yielded'));
 const fresh=claimProfileTab('profile','fresh-page',FakeChannel,()=>events.push('fresh-yielded'));
 assert.deepEqual(events,['old-yielded']);
 assert.ok(!fresh.closed);
 old.close();fresh.close();
});

test('old tab cannot delete the new tab login in shared localStorage',()=>{
 const recent={id:'p',name:'Tata',token:'new-login',recovery:'safe-backup'};
 const result=clearOnlyCurrentToken(recent,'old-login');
 assert.equal(result.changed,false);assert.equal(result.profile.token,'new-login');
 assert.deepEqual(result.profile,recent);
 const own=clearOnlyCurrentToken(recent,'new-login');
 assert.equal(own.changed,true);assert.equal('token' in own.profile,false);
 assert.equal(own.profile.recovery,'safe-backup');assert.equal(recent.token,'new-login');
});

test('other profiles do not interfere and broadcasts never include credentials',()=>{
 FakeChannel.channels=[];const events=[];
 const old=claimProfileTab('alice','first',FakeChannel,()=>events.push('alice'));
 const other=claimProfileTab('bob','second',FakeChannel,()=>events.push('bob'));
 assert.deepEqual(events,[]);
 assert.equal(old.name,'solvi-active-alice');assert.equal(other.name,'solvi-active-bob');
 assert.equal(requireSharedBackend('solvi.help'),true);
 assert.equal(requireSharedBackend('www.solvi.help'),true);
 assert.equal(requireSharedBackend('localhost'),false);
});

test('profile sign-in is recoverable, backend-first, and scene startup is not hostage to optional fetches',()=>{
 const studio=src('js/studio.js'),html=src('index.html');
 assert.match(studio,/claimProfileTab\(uid,pageNonce,window\.BroadcastChannel/);
 assert.doesNotMatch(studio,/type:'ACTIVE'/);
 assert.match(studio,/clearOnlyCurrentToken\(saved,activeToken\)/);
 assert.match(studio,/if\(!online&&requireSharedBackend\(location\.hostname\)\)/);
 assert.match(studio,/let profileSubmitBusy=false;/);
 const start=studio.indexOf('async function afterLogin()'),end=studio.indexOf('async function submitProfile()',start);
 assert.ok(!studio.slice(start,end).includes("api.req('/api/models'"),'AI catalog must not block sign-in');
 assert.match(studio,/finally\{\s*if\(auth&&me\)\{\s*window\.dispatchEvent\(new CustomEvent\('solvi:scene-ready'\)\)/);
 assert.match(studio,/Sign-in failed:/);
 assert.match(html,/profile-session-ownership\.js\?v=0\.2\.219/);
});

import vm from 'node:vm';
function runRealAfterLogin({failWorldSettings=false,failRoomList=false}={}){
 const text=src('js/studio.js'),start=text.indexOf('async function afterLogin(){'),end=text.indexOf('let profileSubmitBusy=false;',start);
 const implementation=text.slice(start,end).trim();
 const events=[],calls=[];
 const select={replaceChildren(){},hidden:false,disabled:true,value:'initial'};
 const chatStatus={textContent:''};
 const context={
  sessionPrompt:true,me:{id:'p1'},auth:{token:'current'},activeRoom:'main',
  window:{dispatchEvent:e=>events.push(e.type)},
  CustomEvent:class{constructor(type){this.type=type;}},
  localStorage:{getItem:()=>null},Option:class{constructor(label,value){this.label=label;this.value=value;}},
  $:id=>id==='modelSelect'?select:chatStatus,
  show:(id,visible)=>calls.push(['show',id,visible]),
  identity:()=>calls.push(['identity']),establishTabChannel:()=>calls.push(['claim']),
  configureRooms:async()=>{calls.push(['rooms']);if(failRoomList)throw Error('Room list unavailable');},
  loadWorldSettings:async()=>{calls.push(['settings']);if(failWorldSettings)throw Error('Settings unavailable');},
  loadMessages:async()=>calls.push(['messages']),
  toast:m=>calls.push(['toast',m]),
  api:{req:async path=>{calls.push(['api',path]);if(path==='/api/models')return new Promise(()=>{});throw Error('Unexpected '+path);}},
 };
 const fn=vm.runInNewContext('('+implementation+')',context);
 return {ready:fn(),events,calls,select};
}

test('real post-login function starts world without querying remote Meta model catalogue',async()=>{
 const run=runRealAfterLogin();await run.ready;
 assert.deepEqual(run.events,['solvi:authenticated','solvi:scene-ready']);
 assert.deepEqual(run.calls.filter(c=>c[0]==='api'),[]);
 assert.equal(run.select.value,'');
});
test('real post-login function still starts world when optional settings or realm list fails',async()=>{
 for(const flag of [{failWorldSettings:true},{failRoomList:true}]){
  const run=runRealAfterLogin(flag);await run.ready;
  assert.ok(run.events.includes('solvi:scene-ready'));
  assert.ok(run.calls.some(c=>c[0]==='toast'));
 }
});

test('reconnect screen allows exporting saved recovery details without active login and prevents accidental logout',()=>{
 const studio=src('js/studio.js');
 assert.match(studio,/function exportProfile\(\)\{const p=stored\(\)\|\|me;/);
 assert.doesNotMatch(studio,/function exportProfile\(\)\{if\(!me\)return;/);
 assert.match(studio,/async function logoutProfile\(\)\{\s*if\(!me\)/);
 assert.match(studio,/auth=null;me=null;\$\('profileLogout'\)\.hidden=true;/);
});


test('a tab takeover with the SAME still-valid token does not erase localStorage',()=>{
 const studio=src('js/studio.js');
 assert.match(studio,/preserveSharedProfile:true/);
 const start=studio.indexOf('function needSignIn('),end=studio.indexOf('const api=',start);
 const code=studio.slice(start,end).trim();
 const current={id:'p',name:'Tata',token:'shared-valid-token',recovery:'private-key'};
 let savedCount=0;
 const fields={
  profileBackdrop:{classList:{remove(){}},hidden:false},
  profileStatus:{textContent:''},profileName:{focus(){}},
  profileLogout:{hidden:false},chatStatus:{textContent:''},backendLabel:{textContent:''}
 };
 const context={
  sessionPrompt:false,auth:{token:'shared-valid-token'},me:{id:'p'},tabChannel:{close(){}},
  stored:()=>({...current}),saveLocal:()=>{savedCount++},
  clearOnlyCurrentToken,clearAdminSession(){},clearPortraitCache(){},releaseChatAttachments(){},
  window:{dispatchEvent(){}},Event:class{constructor(type){this.type=type;}},
  fillProfile(){},show(){},toast(){},$:id=>fields[id],
 };
 const fn=vm.runInNewContext('('+code+')',context);
 fn('Newer tab took control',{preserveSharedProfile:true});
 assert.equal(savedCount,0,'old tab must not erase shared profile even with identical tokens');
 assert.equal(fields.profileLogout.hidden,true);
});
