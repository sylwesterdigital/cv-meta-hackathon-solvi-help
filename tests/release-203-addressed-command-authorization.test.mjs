import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const server=fs.readFileSync(path.join(root,'backend/server.py'),'utf8');
const backendTest=fs.readFileSync(path.join(root,'backend/test_api.py'),'utf8');
test('captioned/untagged robot name is removed before imperative matching',()=>{
  assert.match(server,/robot_name=str\(robot\.get\('name',''\)\)\.strip\(\)/);
  assert.match(server,/re\.match\(r'\^@\?'\+re\.escape\(alias\)/);
  assert.match(server,/words=words\[direct\.end\(\):\]\.strip\(\)/);
  assert.match(server,/words=words\.casefold\(\)/);
  assert.match(backendTest,/for speech in \('Jessica, stop','@Jessica stop','CC: Jessica, please stop'\)/);
});
test('non-owner robot command rejection clears reserved reaction slot',()=>{
  assert.match(server,/if command and not may_edit\(user\['id'\],robot,room_policy\(room_id\)\):[\s\S]{0,350}DELETE FROM robot_reactions/);
  assert.match(backendTest,/assert denied\.status_code==403/);
});

test('actual Python command parser distinguishes STOP from ordinary dialogue',()=>{
 const script=String.raw`import ast,re,sys
source=open(sys.argv[1],encoding='utf8').read()
node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='plan_robot_command')
ns={'re':re,'ROBOT_COMMAND_GUIDE':'COMMAND GUIDE'}
exec(compile(ast.fix_missing_locations(ast.Module(body=[node],type_ignores=[])),sys.argv[1],'exec'),ns)
f=ns['plan_robot_command']; r={'id':'j','name':'Jessica','position':[0,0,0]}
for phrase in ['CC: Jessica, stop','Jessica, stop','@Jessica stop','CC: Jessica, please stop','Jessica, can you stop now']:
 result=f(phrase,r,[])
 assert result[0] and result[0]['kind']=='stop',(phrase,result)
for phrase in ['CC: Jessica, I built this world with the help of OpenAI',
               'Jessica, I am walking to the bus stop','Jessica, stop by my home',
               'Jessica, don\'t stop discussing the world','Jessica, I need help understanding this world']:
 result=f(phrase,r,[])
 assert result==(None,None),(phrase,result)
assert f('CC: Jessica, help',r,[])==(None,'COMMAND GUIDE')
print('PASS: captioned command and dialogue parsing')`;
 const result=spawnSync('python3',['-c',script,path.join(root,'backend/server.py')],{encoding:'utf8',timeout:15000});
 assert.equal(result.status,0,result.stdout+'\n'+result.stderr);
 assert.match(result.stdout,/PASS: captioned command/);
});
