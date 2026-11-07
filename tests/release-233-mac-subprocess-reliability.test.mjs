import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync,MIN_CHILD_TIMEOUT_MS,MAX_TRANSIENT_ATTEMPTS} from './helpers/subprocess-test.mjs';

const transient=(code='EAGAIN')=>({status:null,signal:null,stdout:'',stderr:'',error:Object.assign(new Error('transient launch'),{code})});
const result=status=>({status,signal:null,stdout:'ok',stderr:''});
test('transient child launch failure is retried, never reported as success itself',()=>{
 let calls=0;
 const r=spawnSync('python3',['-c','pass'],{timeout:5000},(_cmd,_args,settings)=>{
  assert.equal(settings.timeout,MIN_CHILD_TIMEOUT_MS);
  return ++calls===1?transient():result(0);
 });
 assert.equal(calls,2);
 assert.equal(r.status,0);
});
test('a real nonzero child exit is never retried or suppressed',()=>{
 let calls=0;
 const r=spawnSync('python3',[],{},()=>{calls++;return result(7);});
 assert.equal(calls,1);assert.equal(r.status,7);
});
test('permanent child timeout keeps null status, fails caller assertion, and provides diagnostics',()=>{
 let calls=0;
 const r=spawnSync('python3',['-c','pass'],{},()=>{calls++;return transient('ETIMEDOUT');});
 assert.equal(calls,MAX_TRANSIENT_ATTEMPTS);
 assert.equal(r.status,null);
 assert.match(r.stderr,/status=null.*ETIMEDOUT/);
 assert.throws(()=>assert.equal(r.status,0));
});
test('unexpected child signal does not retry or pass tests',()=>{
 let calls=0;
 const r=spawnSync('node',[],{},()=>{calls++;return {status:null,signal:'SIGSEGV',stdout:'',stderr:''};});
 assert.equal(calls,1);
 assert.equal(r.status,null);
 assert.match(r.stderr,/signal=SIGSEGV/);
});
test('Node syntax tests continue to invoke the real JavaScript parser',()=>{
 const r=spawnSync(process.execPath,['--check','--input-type=module'],{input:'export const x = ;',encoding:'utf8'});
 assert.notEqual(r.status,0);
});
