import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const loader=read('js/umami-loader.js');

function browser({readyState='loading', idle=true, throwCreate=false, throwAppend=false}={}) {
  const timers=new Map();
  const listeners=new Map();
  const appended=[];
  const idleCalls=[];
  let nextTimerId=0;
  const window={
    setTimeout(fn,ms) {const id=++nextTimerId;timers.set(id,{fn,ms});return id;},
    clearTimeout(id){timers.delete(id);},
    addEventListener(type,fn){listeners.set(type,fn);}
  };
  if(idle) window.requestIdleCallback=(fn,opts)=>{idleCalls.push({fn,opts});};
  const document={
    readyState,
    head:{appendChild(el){if(throwAppend) throw Error('blocked');appended.push(el);}},
    createElement(type){
      assert.equal(type,'script');
      if(throwCreate) throw Error('DOM disallowed');
      const events=new Map();
      return {
        type,
        async:false,
        dataset:{},
        removed:false,
        addEventListener(name,cb){events.set(name,cb);},
        dispatch(name){events.get(name)?.();},
        remove(){this.removed=true;}
      };
    }
  };
  vm.runInNewContext(loader,{window,document}, {timeout:1000});
  const fireLoad=()=>listeners.get('load')?.();
  const fireIdle=()=>idleCalls.shift()?.fn();
  const runTimer=(ms)=>{
    const found=[...timers].find(([id,entry])=>entry.ms===ms);
    assert.ok(found,`expected ${ms} ms timer`);
    timers.delete(found[0]);
    found[1].fn();
  };
  return {window,document,appended,idleCalls,timers,fireLoad,fireIdle,runTimer};
}

test('Umami uses an independent async local loader, not a render-blocking remote tag or main import',()=>{
  const html=read('index.html');
  assert.match(html,/<script async src="\.\/js\/umami-loader\.js\?v=0\.2\.227"><\/script>/);
  assert.doesNotMatch(html,/src="https:\/\/analytics\.mielniczuk\.com/);
  assert.doesNotMatch(read('js/main.js'),/umami-loader|analytics\.mielniczuk\.com/);
  assert.match(loader,/data|dataset/);
});

test('tracker is never requested before window load and idle scheduling',()=>{
  const b=browser();
  assert.equal(b.appended.length,0);
  b.fireLoad();
  assert.equal(b.appended.length,0);
  assert.equal(b.idleCalls.length,1);
  assert.equal(b.idleCalls[0].opts.timeout,1500);
  b.fireIdle();
  assert.equal(b.appended.length,1);
  const tracker=b.appended[0];
  assert.equal(tracker.src,'https://analytics.mielniczuk.com/script.js');
  assert.equal(tracker.dataset.websiteId,'2e279074-e8b2-46b5-a5d9-d425d0b2b619');
  assert.equal(tracker.async,true);
  b.fireLoad();
  assert.equal(b.appended.length,1,'never inject duplicate tracker');
  assert.ok([...b.timers.values()].some(t=>t.ms===8000));
  tracker.dispatch('load');
  assert.equal(b.timers.size,0,'success clears timeout');
  assert.equal(tracker.removed,false);
});

test('analytics network error cannot affect the app and clears the timeout',()=>{
  const b=browser({readyState:'complete',idle:false});
  assert.equal(b.appended.length,0);
  b.runTimer(0);
  const tracker=b.appended[0];
  tracker.dispatch('error');
  assert.equal(tracker.removed,true);
  assert.equal(b.timers.size,0);
});

test('hung analytics request is abandoned after 8 seconds without retry',()=>{
  const b=browser({readyState:'complete',idle:false});
  b.runTimer(0);
  b.runTimer(8000);
  assert.equal(b.appended[0].removed,true);
  assert.equal(b.appended.length,1);
  assert.equal(b.timers.size,0);
});

test('blocked DOM or failed append cannot throw into application startup',()=>{
  for (const option of [{throwCreate:true},{throwAppend:true}]) {
    const b=browser({readyState:'complete',idle:false,...option});
    assert.doesNotThrow(()=>b.runTimer(0));
    assert.equal(b.appended.length,0);
  }
});
