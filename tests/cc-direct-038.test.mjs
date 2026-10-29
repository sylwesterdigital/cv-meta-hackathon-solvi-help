import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {setupVoiceCaptions} from '../js/voice-captions.js';

function mockElement(id){
 const handlers={};return {
  id,handlers,checked:id==='ccAutoSend',value:id==='ccLanguage'?'en-GB':id==='ccEngine'?'browser':'',
  dataset:{},attributes:{},style:{},textContent:'',hidden:false,
  addEventListener(type,fn){handlers[type]=fn;},
  dispatchEvent(e){handlers[e.type]?.(e);},
  setAttribute(key,value){this.attributes[key]=value;},
  getAttribute(key){return this.attributes[key]||null;},
  querySelector(){return null;},
  click(){handlers.click?.();}
 };}

test('CC is a visible direct composer action immediately before Send, not hidden as a media tool',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const css=fs.readFileSync(new URL('../styles.css',import.meta.url),'utf8');
 const actions=html.slice(html.indexOf('<div class="composer-actions">'),html.indexOf('<small id="chatStatus"'));
 const cc=actions.match(/<button[^>]*id="captionsButton"[^>]*>/);
 assert.ok(cc);assert.match(cc[0],/cc-direct-toggle/);assert.doesNotMatch(cc[0],/media-tool/);
 assert.ok(actions.indexOf('id="captionsButton"')<actions.indexOf('id="sendChat"'));
 assert.match(css,/#chatPanel \.composer-actions #captionsButton\.cc-direct-toggle\s*\{\s*display:inline-flex!important/);
 assert.match(css,/html\[data-button-labels='icon'\] #chatPanel #captionsButton \.ui-button-label/);
});

test('click CC, recognize speech, publish final transcript to room, click again to stop',async()=>{
 const prior={document:globalThis.document,window:globalThis.window,navigator:globalThis.navigator,localStorage:globalThis.localStorage};
 let recognition;
 class Recognition {
  start(){recognition=this;this.started=(this.started||0)+1;}
  stop(){this.stopped=true;}
  abort(){this.aborted=true;}
 }
 const elements=Object.fromEntries(['captionsButton','captionStatus','captionPreview','captionPhase','captionDraft','ccSettingsStatus','voiceWavesButton','ccEngine','ccLanguage','ccAutoSend','ccEngineStatus','chatInput'].map(id=>[id,mockElement(id)]));
 const published=[];
 try{
  globalThis.document={getElementById(id){assert.ok(elements[id],id);return elements[id];}};
  globalThis.localStorage={getItem(){return null;},setItem(){}};
  Object.defineProperty(globalThis,'navigator',{configurable:true,value:{language:'en-GB'}});
  globalThis.window={SpeechRecognition:Recognition,addEventListener(){},solviPublishCaption:async text=>{published.push(text);}};
  setupVoiceCaptions({});
  assert.equal(elements.captionsButton.attributes['aria-pressed'],'false');
  elements.captionsButton.click();
  assert.equal(elements.captionsButton.attributes['aria-pressed'],'true');
  assert.equal(recognition.started,1);
  recognition.onresult({resultIndex:0,results:[{0:{transcript:'Jessica walk to the chair'},isFinal:true}]});
  await new Promise(resolve=>setImmediate(resolve));
  assert.deepEqual(published,['Jessica walk to the chair']);
  assert.match(elements.captionStatus.textContent,/sent to room/i);
  elements.captionsButton.click();
  assert.equal(elements.captionsButton.attributes['aria-pressed'],'false');
  assert.equal(recognition.stopped,true);
 } finally{
  for(const [key,value] of Object.entries(prior)){
   if(key==='navigator')Object.defineProperty(globalThis,key,{configurable:true,value});
   else if(value===undefined)delete globalThis[key];else globalThis[key]=value;
  }
 }
});
