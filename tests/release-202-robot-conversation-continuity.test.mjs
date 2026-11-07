import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from './helpers/subprocess-test.mjs';
import {fileURLToPath} from 'node:url';
const server=new URL('../backend/server.py',import.meta.url);
const script=String.raw`
import ast, math, re, sys
source=open(sys.argv[1],encoding='utf-8').read()
tree=ast.parse(source)
wanted={'plan_robot_command','robot_conversation_excerpt','robot_scene_excerpt'}
functions=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in wanted]
assert len(functions)==3
module=ast.fix_missing_locations(ast.Module(body=functions,type_ignores=[]))
scope={'math':math,'re':re,'ROBOT_COMMAND_GUIDE':'COMMAND GUIDE'}
exec(compile(module,sys.argv[1],'exec'),scope)
command=scope['plan_robot_command']
robot={'id':'s','name':'Sakk','position':[0,0,0]}
examples=[
  '@Sakk I built this whole world with the help of Open AI LLM.',
  '@Sakk I would like some help understanding what I built.',
  '@Sakk help me understand this project.',
  '@Sakk stop by my home when you can.',
  '@Sakk I am waiting at the bus stop.',
  '@Sakk don\'t stop talking about our project.',
  '@Sakk did you tinker anything related to this world?',
]
for example in examples:
    result=command(example,robot,[])
    assert result==(None,None),(example,result)
assert command('@Sakk help',robot,[])==(None,'COMMAND GUIDE')
assert command('@Sakk please show your commands',robot,[])==(None,'COMMAND GUIDE')
assert command('@Sakk stop',robot,[])[0]['kind']=='stop'
assert command('@Sakk can you stop now',robot,[])[0]['kind']=='stop'
peer=[{'id':'other','name':'Jiz','kind':'robot','position':[5,0,5]}]
assert command('@Sakk go to Jiz and stop nearby',robot,peer)[0]['kind']=='go_to'

# Last 8 room messages have pushed the user's personal introduction offscreen:
rows=[{'speaker':'Jiz','role':'assistant','user_id':'other','text':f'Other room chat {i}'} for i in range(10)]
rows += [{'speaker':'Sakk','role':'assistant','user_id':'other','text':'I remember your project.'},
         {'speaker':'Tata','role':'user','user_id':'tata','text':'@Sakk I built this world with the help of Open AI.'},
         {'speaker':'Tata','role':'user','user_id':'tata','text':'@OtherRobot an unrelated private message in the room.'}]
excerpt=scope['robot_conversation_excerpt'](rows,'Sakk','tata')
assert any('I built this world' in item['text'] for item in excerpt),excerpt
assert any(item['speaker']=='Tata' for item in excerpt)
assert excerpt[0]['text'].startswith('@Sakk I built') # chronological order of relevant recalled messages
assert len(excerpt)<=18
# A busy robot can produce many replies; human introductions must still have priority.
busy=[{'speaker':'Sakk','role':'assistant','user_id':'robot-owner','text':f'My previous chat {i}'} for i in range(17)]
busy.append({'speaker':'Tata','role':'user','user_id':'tata','text':'@Sakk I am the creator of this simulated world.'})
assert any('I am the creator' in row['text'] for row in scope['robot_conversation_excerpt'](busy,'Sakk','tata'))
# The malformed torus coordinate from the uploaded log must not be shown.
objects=[{'id':'corrupt','name':'New torus','kind':'torus','position':[22,-532553,-3]},
         {'id':'far','name':'Hospital','kind':'wall','position':[900,0,0]},
         {'id':'near','name':'Desk','kind':'furniture','position':[2,0,3]},
         {'id':'s','name':'Sakk','kind':'robot','position':[0,0,0]}]
scene=scope['robot_scene_excerpt'](objects,robot,'Can you go to Hospital?')
assert [x['name'] for x in scene]==['Hospital','Desk'],scene
assert all(x['name']!='New torus' for x in scene)
print('PASS: conversation, command routing, speaker context and scene filtering')
`;
test('real Python routing and dialogue context preserve human introductions and explicit commands',()=>{
 const r=spawnSync('python3',['-c',script,fileURLToPath(server)],{encoding:'utf8',timeout:15000});
 assert.equal(r.status,0,r.stdout+'\n'+r.stderr);
 assert.match(r.stdout,/PASS: conversation/);
});
test('robot dialogue is scoped to room, actual user names, and enabled work orders',()=>{
 const src=readFileSync(server,'utf8');
 assert.match(src,/JOIN users u ON u\.id=m\.user_id WHERE m\.room_id=\?/);
 assert.match(src,/if saved_order and bool\(saved_order\['enabled'\]\)/);
 assert.match(src,/robot_conversation_excerpt\(history,robot\['name'\],user\['id'\]\)/);
 assert.match(src,/robot_scene_excerpt\(objects,robot,text\)/);
 assert.match(src,/if command is not None:\s*con\.execute\('INSERT INTO robot_memories/);
 assert.match(src,/not str\(r\['event'\]\)\.startswith\(/);
});
