"""Run in a temporary data directory, never the production SQLite directory."""
import json
import os
from server import app

c=app.test_client()
# Regression: do not collide with Flask's built-in static endpoint.
assert 'static' in app.view_functions and 'public_asset' in app.view_functions
assert c.get('/').status_code == 200
assert c.get('/styles.css').status_code == 200
r=c.get('/api/health')
assert r.status_code==200,r.data
# The macOS watcher omits SOLVI_EXPECTED_VERSION during local tests.
# Derive it from release metadata rather than carrying a stale hard-coded default.
from pathlib import Path
expected_version = os.environ.get('SOLVI_EXPECTED_VERSION') or json.loads((Path(__file__).resolve().parent.parent / 'package.json').read_text())['version']
health = r.get_json()
assert health['service'] == 'solvi-help-api' and health['version'] == expected_version, (health, expected_version)
assert c.get('/api/messages').status_code==401
name='Solvi test user'
# The watcher provides a constrained origin for isolated integration tests.
# A real browser Origin includes a scheme and optional port; it must match exactly.
origin = os.environ.get('SOLVI_ALLOWED_ORIGINS', 'https://solvi.help').split(',')[0].strip()
assert origin
assert c.post('/api/onboard',json={'name':name,'tab':'test-tab-unique-001'},headers={'Origin':'https://evil.example'}).status_code==403
r=c.post('/api/onboard',json={'name':name,'tab':'test-tab-unique-001'},headers={'Origin':origin})
assert r.status_code==200,(r.status_code,r.data)
data=r.get_json();assert data['user']['name']==name and data['token'] and data['recovery']
headers={'Authorization':'Bearer '+data['token'],'X-Solvi-Tab':'test-tab-unique-001','Origin':origin}
assert c.get('/api/me',headers=headers).status_code==200
r=c.post('/api/message',json={'text':'Hello SOLVI world','media':[]},headers=headers)
assert r.status_code==200,(r.status_code,r.data)
assert r.get_json()['message']['text']=='Hello SOLVI world'
r=c.get('/api/messages',headers=headers)
assert r.status_code==200 and len(r.get_json()['messages'])==1
assert c.get('/api/scene',headers=headers).status_code==200
r=c.get('/api/models',headers=headers)
assert r.status_code in (200,502),r.data
assert c.post('/api/admin/login',headers=headers,json={'password':'guess'}).status_code in (403,429)
r=c.post('/api/rooms',headers=headers,json={'id':'lab','title':'Robot Lab'})
assert r.status_code==200,(r.status_code,r.data)
assert any(x['id']=='lab' for x in c.get('/api/rooms',headers=headers).get_json()['rooms'])
assert c.post('/api/message',headers=headers,json={'room':'lab','text':'Only lab'}).status_code==200
main=c.get('/api/messages?room=main',headers=headers).get_json()['messages']
lab=c.get('/api/messages?room=lab',headers=headers).get_json()['messages']
assert len(main)==1 and len(lab)==1 and main[0]['text']!=lab[0]['text']
assert main[0]['speaker']==name and lab[0]['speaker']==name
# Regression: the SQL NULLIF empty-string literal must remain correctly quoted.
# Exercise both ordinary human names and an AI robot's speaker override.
from server import db
with db() as con:
    con.execute('INSERT INTO messages(id,user_id,role,model,text,media,created,room_id,speaker_override) VALUES(?,?,?,?,?,?,?,?,?)',
                ('test-robot-speaking',data['user']['id'],'assistant','test-model',
                 'Hello from Jessica','[]','2026-10-28T05:00:00Z','lab','Jessica'))
lab_with_robot=c.get('/api/messages?room=lab',headers=headers)
assert lab_with_robot.status_code==200,(lab_with_robot.status_code,lab_with_robot.data)
robot_reply=next(m for m in lab_with_robot.get_json()['messages'] if m['id']=='test-robot-speaking')
assert robot_reply['speaker']=='Jessica' and robot_reply['role']=='assistant'
assert c.put('/api/scene',headers=headers,json={'room':'lab','revision':0,'objects':[]}).status_code==200
assert c.get('/api/scene?room=lab',headers=headers).get_json()['revision']==1
assert c.get('/api/scene?room=main',headers=headers).get_json()['revision']==0
# Atomic per-object updates preserve changes and remain room-specific.
obj={'id':'testcube-001','kind':'cube','name':'Test cube','position':[1,1,0],
     'rotation':[0,0,0],'scale':[1,1,1],'color':'#abcdef','texture':'checker'}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':obj})
assert r.status_code==200,(r.status_code,r.data)
lab_obj=c.get('/api/scene?room=lab',headers=headers).get_json()['objects']
assert len(lab_obj)==1 and lab_obj[0]['texture']=='checker' and lab_obj[0]['owner']==data['user']['id']
assert c.get('/api/scene?room=main',headers=headers).get_json()['objects']==[]
obj['position']=[2,1,0]
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':obj}).status_code==200
assert len(c.get('/api/scene?room=lab',headers=headers).get_json()['objects'])==1
obj['physics']={'mode':'dynamic','friction':.7,'restitution':.15}
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':obj}).status_code==200
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects'][0]['physics']['mode']=='dynamic'
obj['physics']['mode']='invalid'
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':obj}).status_code==400
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'testcube-001'}}).status_code==200
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects']==[]
light={'id':'testlight-001','kind':'light','name':'Lamp','position':[0,2,0],
       'rotation':[0,0,0],'scale':[1,1,1],
       'light':{'type':'spot','intensity':3.5,'range':15,'decay':2,'angle':35,'penumbra':.3,
                'color':'#ffe7aa','groundColor':'#46566d'}}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':light})
assert r.status_code==200,(r.status_code,r.data)
stored_light=c.get('/api/scene?room=lab',headers=headers).get_json()['objects'][0]
assert stored_light['light']['type']=='spot' and stored_light['light']['intensity']==3.5
light['light']['type']='invalid'
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':light}).status_code==400
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'testlight-001'}}).status_code==200
robot={'id':'testrobot-001','kind':'robot','name':'Pilot','position':[0,0,0],
       'rotation':[0,0,0],'scale':[1,1,1],'speed':1.65}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot})
assert r.status_code==200,(r.status_code,r.data)
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects'][0]['speed']==1.65
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'testrobot-001'}}).status_code==200
# Every room defaults to shared editing; owners can be enforced independently.
settings=c.get('/api/room/settings?room=lab',headers=headers)
assert settings.status_code==200 and settings.get_json()['policy']=={'objects':'open','robots':'open','physics':0}
assert c.put('/api/room/settings',headers=headers,json={'room':'lab','objects':'invalid','robots':'open'}).status_code==400
r=c.put('/api/room/settings',headers=headers,json={'room':'lab','objects':'owned','robots':'open'})
assert r.status_code==200,(r.status_code,r.data)
assert c.get('/api/room/settings?room=lab',headers=headers).get_json()['policy']['objects']=='owned'
assert c.get('/api/room/settings?room=main',headers=headers).get_json()['policy']['objects']=='open'
assert c.put('/api/room/settings',headers=headers,json={'room':'lab','objects':'owned','robots':'open','physics':1}).status_code==200
assert c.get('/api/room/settings?room=lab',headers=headers).get_json()['policy']['physics']==1
assert c.get('/api/room/settings?room=main',headers=headers).get_json()['policy']['physics']==0
assert c.put('/api/room/settings',headers=headers,json={'room':'lab','objects':'owned','robots':'open','physics':4}).status_code==400
# Another user cannot modify an owned object, but can once objects are opened.
second=c.post('/api/onboard',json={'name':'Second editor','tab':'other-tab-123'},headers={'Origin':origin})
assert second.status_code==200
other_headers={'Authorization':'Bearer '+second.get_json()['token'],'X-Solvi-Tab':'other-tab-123','Origin':origin}
original={'id':'ownedcube-200','kind':'cube','name':'Owned cube','position':[0,1,0],'rotation':[0,0,0],'scale':[1,1,1],'color':'#abcdef','texture':'none'}
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':original}).status_code==200
original['position']=[2,1,0]
assert c.post('/api/scene/object',headers=other_headers,json={'room':'lab','action':'upsert','object':original}).status_code==403
assert c.put('/api/room/settings',headers=headers,json={'room':'lab','objects':'open','robots':'open'}).status_code==200
assert c.post('/api/scene/object',headers=other_headers,json={'room':'lab','action':'upsert','object':original}).status_code==200
assert c.post('/api/scene/object',headers=other_headers,json={'room':'lab','action':'remove','object':{'id':'ownedcube-200'}}).status_code==200
# 3D asset storage: model bytes stay server-side; only reference+transforms enter room messages.
from io import BytesIO
import struct
scene_doc=b'{"asset":{"version":"2.0"},"scene":0,"scenes":[{"nodes":[]}]}'
scene_doc+=b' ' * ((-len(scene_doc))%4)
glb=(b'glTF'+struct.pack('<II',2,20+len(scene_doc))+struct.pack('<I',len(scene_doc))+b'JSON'+scene_doc)
assert c.get('/api/scene/models',headers=headers).status_code==200
assert c.post('/api/scene/models',headers=headers,data={'model':(BytesIO(b'hello'),'evil.exe')},content_type='multipart/form-data').status_code==400
assert c.post('/api/scene/models',headers=headers,data={'model':(BytesIO(b'garbage'),'bad.glb')},content_type='multipart/form-data').status_code==400
assert c.post('/api/scene/models',headers=headers,data={'model':(BytesIO(b'not fbx'),'bad.fbx')},content_type='multipart/form-data').status_code==400
assert c.post('/api/scene/models',headers={**headers,'Origin':'https://invalid.test'},data={'model':(BytesIO(glb),'bad.glb')},content_type='multipart/form-data').status_code==403
r=c.post('/api/scene/models',headers=headers,data={'model':(BytesIO(glb),'mesh.glb')},content_type='multipart/form-data')
assert r.status_code==201,(r.status_code,r.data)
model=r.get_json()['model'];asset=model['url']
assert c.get(asset).status_code==200
assert c.get('/api/scene/models/'+('0'*32)+'.glb').status_code==404
assert c.get('/api/scene/models',headers=headers).get_json()['models'][0]['url']==asset
placed={'id':'modelitem-001','kind':'model','name':'Shared mesh','model':asset,
        'position':[1,0,1],'rotation':[0,0,0],'scale':[1,1,1]}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':placed})
assert r.status_code==200,(r.status_code,r.data)
entry=next(o for o in c.get('/api/scene?room=lab',headers=headers).get_json()['objects'] if o['id']=='modelitem-001')
assert entry['model']==asset and entry['position']==[1,0,1]
placed['model']='/api/scene/models/'+('f'*32)+'.glb'
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':placed}).status_code==400
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'modelitem-001'}}).status_code==200
assert not any(o['id']=='modelitem-001' for o in c.get('/api/scene?room=lab',headers=headers).get_json()['objects'])
fbx=b'Kaydara FBX Binary  \x00\x1a\x00'+bytes(100)
r=c.post('/api/scene/models',headers=headers,data={'model':(BytesIO(fbx),'model.fbx')},content_type='multipart/form-data')
assert r.status_code==201,(r.status_code,r.data)
assert c.get(r.get_json()['model']['url']).data==fbx
print('PASS: shared GLB/FBX uploads, validation, room references and file serving')
print('PASS: room-scoped ownership policies, shared editing and independent access')
print('PASS: typed light settings and robot speed persist per object')
print('PASS: atomic object create/update/delete with room isolation')
print('PASS: rooms and isolation')
print('PASS: Flask health, SQLite profile, auth, human chat, messages, scene and admin protection')
# v0.2.22 Robot eye vision: test both models offline with mocked Meta responses.
# Meta Responses may supply results only in output[0].content[0].text, not top-level output_text.
from unittest.mock import patch
import base64 as _b64
sample_eye='data:image/jpeg;base64,'+_b64.b64encode(b'\xff\xd8\xff\xd9').decode('ascii')
sam_result={'id':'resp-test-sam','status':'completed','output':[{'type':'message','content':[{
    'type':'output_text','text':'<0f>0<|box;x1=10;y1=20;x2=100;y2=120;w=512;h=512|><|mask;x=0;y=0;data=5,5,!!!!!|>'}]}],
    'usage':{'input_tokens':0,'output_tokens':0,'images_processed':1}}
muse_result={'id':'resp-test-muse','status':'completed','output':[{'type':'message','content':[{
    'type':'output_text','text':'A blue cube stands to the left of a robot.'}]}],
    'usage':{'input_tokens':100,'output_tokens':15}}
with patch('server.active_model_key',return_value='test-secret-not-persisted'), patch('server.meta_request') as meta_mock:
    meta_mock.return_value=sam_result
    r=c.post('/api/ai/vision',headers=headers,json={'mode':'segment','image':sample_eye,'prompt':'blue cube'})
    assert r.status_code==200,(r.status_code,r.data)
    answer=r.get_json()
    assert answer['result']['match_count']==1 and answer['result']['boxes'][0]['x1']==10
    assert answer['request']['model']=='sam-3.1' and answer['request']['prompt']=='blue cube'
    assert answer['request']['image']['mime']=='image/jpeg' and answer['usage']['estimated_usd']==.0025
    assert 'image_url' not in str(answer)
    sent=meta_mock.call_args.args[2]
    assert sent['input'][0]['content'][0]['text']=='blue cube'
    assert sent['input'][0]['content'][1]['image_url']==sample_eye and sent['store'] is False
    meta_mock.return_value={'id':'resp-no-matches','status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':''}]}]}
    r=c.post('/api/ai/vision',headers=headers,json={'mode':'segment','image':sample_eye,'prompt':'elephant'})
    assert r.status_code==200 and r.get_json()['result']['no_matches'] is True
    meta_mock.return_value=muse_result
    r=c.post('/api/ai/vision',headers=headers,json={'mode':'describe','image':sample_eye,'prompt':'What is visible?'})
    assert r.status_code==200,(r.status_code,r.data)
    answer=r.get_json()
    assert 'blue cube' in answer['description'] and answer['request']['model']=='muse-spark-1.3'
    assert answer['usage']['input_tokens']==100 and answer['usage']['images']==1
    assert c.post('/api/ai/vision',headers=headers,json={'mode':'not-supported','image':sample_eye,'prompt':'robot'}).status_code==400
    assert c.post('/api/ai/vision',headers=headers,json={'mode':'segment','image':sample_eye,'prompt':'What is in the image?'}).status_code==400
    assert c.post('/api/ai/vision',headers=headers,json={'mode':'describe','image':'data:image/jpeg;base64,AAAA','prompt':'what?'}).status_code==400
print('PASS: SAM nested mask grammar, geometry, no-match result; Muse image description, prompt echo and usage without calling Meta')

# v0.2.22 robot identity, permission checks and AI accounting without paid API calls.
assert c.get('/api/ai/usage',headers=headers).status_code==200
assert c.get('/api/ai/logs',headers=headers).status_code==403
assert c.post('/api/ai/config',headers=headers,json={'key':'untrusted-client-key-value'}).status_code==403
assert c.post('/api/robots/scenario',headers=headers,json={'room':'lab','id':'not-a-robot'}).status_code==404
brain={'personality':'Curious observer','history':'Raised in a virtual workshop',
       'beliefs':'Help others learn','triggers':'hello, discovery','scenario':'Examine a cube'}
robot={'id':'testrobot-0220','kind':'robot','name':'Jessica','position':[0,0,0],
       'rotation':[0,0,0],'scale':[1,1,1],'speed':1.2,'strafeSpeed':1.8,'turnSpeed':3.0,'brain':brain}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot})
assert r.status_code==200,(r.status_code,r.data)
read_robot=[x for x in c.get('/api/scene?room=lab',headers=headers).get_json()['objects'] if x['kind']=='robot'][0]
assert read_robot['turnSpeed']==3.0 and read_robot['brain']==brain
assert c.get('/api/robots/memory?room=lab&id=testrobot-0220',headers=headers).status_code==200
robot['turnSpeed']=5
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot}).status_code==400
robot['turnSpeed']=3;robot['brain']['personality']='x'*1001
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot}).status_code==400
robot['brain']['personality']='Curious observer'
message=c.post('/api/message',headers=headers,json={'room':'lab','text':'A normal conversation without mention'}).get_json()['message']
with patch('server.active_model_key',return_value=''):
    result=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':message['text'],'message_id':message['id']})
assert result.status_code==200 and result.get_json()['triggered'] is False,(result.status_code,result.data)
# Addressing must work through text, CC captions, and one unambiguous spelling slip.
# Grounding is the actual scene catalogue: do not pretend SAM found objects.
sofa={'id':'testsofa-0222','kind':'cube','name':'Red Sofa','position':[4,1,0],
      'rotation':[0,0,0],'scale':[2,1,1],'color':'#d52231'}
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':sofa}).status_code==200
speech='CC: Jessia please walk around, find the red sofa and sit on it'
spoken=c.post('/api/message',headers=headers,json={'room':'lab','text':speech}).get_json()['message']
with patch('server.active_model_key',return_value=''):
    result=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':speech,'message_id':spoken['id']})
assert result.status_code==200,(result.status_code,result.data)
reply=result.get_json()
assert reply['triggered'] and reply['command']['robot_id']=='testrobot-0220'
assert reply['command']['kind']=='go_sit' and reply['command']['target_id']=='testsofa-0222'
assert reply['answer']['speaker']=='Jessica' and reply['answer']['model']=='scene-command'
assert reply.get('usage') is None  # scene actions must not consume LLM tokens
assert any(m['speaker']=='Jessica' for m in c.get('/api/messages?room=lab',headers=headers).get_json()['messages'])
# Prevent moving owner-only robots from someone else's conversation.
assert c.put('/api/room/settings',headers=headers,json={'room':'lab','objects':'open','robots':'owned','physics':0}).status_code==200
other_speech='CC: Jessica, stop'
other_message=c.post('/api/message',headers=other_headers,json={'room':'lab','text':other_speech}).get_json()['message']
with patch('server.active_model_key',return_value=''):
    other_reply=c.post('/api/robots/react',headers=other_headers,json={'room':'lab','text':other_speech,'message_id':other_message['id']})
assert other_reply.status_code==403,(other_reply.status_code,other_reply.data)
assert c.put('/api/room/settings',headers=headers,json={'room':'lab','objects':'owned','robots':'open','physics':0}).status_code==200
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'testsofa-0222'}}).status_code==200
# v0.2.24: a real task result writes persistent chat/memory and rejects replay.
assert c.post('/api/robots/task-result',headers=other_headers,json={'room':'lab','task_id':reply['command']['id'],'status':'sitting'}).status_code==403
completed=c.post('/api/robots/task-result',headers=headers,json={'room':'lab','task_id':reply['command']['id'],'status':'sitting'})
assert completed.status_code==200,(completed.status_code,completed.data)
assert 'played my Sit animation' in completed.get_json()['answer']['text']
assert c.post('/api/robots/task-result',headers=headers,json={'room':'lab','task_id':reply['command']['id'],'status':'sitting'}).status_code==403
# With the sofa removed, the server must START a real camera scan, never tell the human to rename objects.
missing='CC: @Jessica please find the red sofa and sit on it'
new_message=c.post('/api/message',headers=headers,json={'room':'lab','text':missing}).get_json()['message']
with patch('server.active_model_key',return_value=''):
    vision_task=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':missing,'message_id':new_message['id']})
assert vision_task.status_code==200,(vision_task.status_code,vision_task.data)
visual=vision_task.get_json()
assert visual['command']['kind']=='vision_search' and visual['command']['target_phrase']=='red sofa' and visual['command']['sit'] is True
assert visual['trace'][1]['result']=='vision_search'
assert visual['command']['id']
failed=c.post('/api/robots/task-result',headers=headers,json={'room':'lab','task_id':visual['command']['id'],'status':'not-found'})
assert failed.status_code==200 and 'scanned four directions' in failed.get_json()['answer']['text']
assert c.get('/api/robots/memory?room=lab&id=testrobot-0220',headers=headers).status_code==200
# Muse supplies character-language plans only, with the deterministic motion command unchanged.
spoken_ai=c.post('/api/message',headers=headers,json={'room':'lab','text':'@Jessica stop'}).get_json()['message']
with patch('server.active_model_key',return_value='fake-key-test-only'), patch('server.meta_request',return_value={
    'id':'resp-intent-plan','output_text':'I will stop and watch the room.',
    'usage':{'input_tokens':44,'output_tokens':9}}) as fake_model:
    planned=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':spoken_ai['text'],'message_id':spoken_ai['id']})
assert planned.status_code==200,(planned.status_code,planned.data)
assert planned.get_json()['command']['kind']=='stop' and 'My plan:' in planned.get_json()['answer']['text']
assert any(x['step']=='muse-plan' for x in planned.get_json()['trace'])
assert planned.get_json()['usage']['input_tokens']==44
assert fake_model.call_args.args[2]['model']=='muse-spark-1.3'
# v0.2.32: robot eye image is a robot-authored media message, not a human statement.
from io import BytesIO as _BytesIO
up=c.post('/api/media',headers=headers,data={'file':(_BytesIO(b'\xff\xd8\xff\xdbtest-camera-frame\xff\xd9'),'head-eye.jpg','image/jpeg')})
assert up.status_code==200,(up.status_code,up.data)
mid=up.get_json()['media']['id']
with patch('server.active_model_key',return_value=''):
    eyes=c.post('/api/robots/eyes',headers=headers,json={'room':'lab','robot_id':'testrobot-0220','media_id':mid})
assert eyes.status_code==200,(eyes.status_code,eyes.data)
assert eyes.get_json()['answer']['speaker']=='Jessica' and mid in eyes.get_json()['answer']['media']
assert eyes.get_json()['answer']['text'].startswith('I see this:')
with patch('server.active_model_key',return_value='test-key'), patch('server.meta_request',return_value={
    'id':'resp-eye','output':[{'type':'message','content':[{'type':'output_text','text':'I see a table and a lamp.'}]}],
    'usage':{'input_tokens':100,'output_tokens':15,'images_processed':1}}) as fake_eye:
    eyes=c.post('/api/robots/eyes',headers=headers,json={'room':'lab','robot_id':'testrobot-0220','media_id':mid})
assert eyes.status_code==200,(eyes.status_code,eyes.data)
assert 'I see a table' in eyes.get_json()['answer']['text']
assert fake_eye.call_args.args[2]['input'][0]['content'][1]['type']=='input_image'
assert c.post('/api/robots/initiative',headers=headers,json={'room':'lab','robot_id':'testrobot-0220'}).status_code==403
robot['brain']['initiative']=True
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot}).status_code==200
with patch('server.active_model_key',return_value='test-key'), patch('server.meta_request',return_value={
    'id':'resp-proactive','output_text':'Could we inspect the sphere together?',
    'usage':{'input_tokens':80,'output_tokens':11}}) as proactive_mock:
    initiative=c.post('/api/robots/initiative',headers=headers,json={'room':'lab','robot_id':'testrobot-0220'})
    again=c.post('/api/robots/initiative',headers=headers,json={'room':'lab','robot_id':'testrobot-0220'})
assert initiative.status_code==200,(initiative.status_code,initiative.data)
assert initiative.get_json()['answer']['speaker']=='Jessica'
assert again.status_code==200 and again.get_json()['triggered'] is False
assert proactive_mock.call_count==1
# A short unambiguous vocative is routed to the full robot name.
from server import _robot_address
assert _robot_address('hi Jess how are you?', [robot]) is robot
# v0.2.35: Visual conversation MUST capture a JPEG before Muse responds,
# and the server must reject forged/unrelated requests or duplicate paid inferences.
from server import is_robot_visual_question, chat_attempts
assert is_robot_visual_question('Jessica, what do you see now? I put a chair in front of you')
assert is_robot_visual_question('CC: @Jessica can you see the chair?')
assert not is_robot_visual_question('@Jessica how are you?')
vision_text='Jessica, what do you see now? I put a chair in front of you'
question=c.post('/api/message',headers=headers,json={'room':'lab','text':vision_text}).get_json()['message']
with patch('server.active_model_key',return_value='test-key'):
    routed=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':vision_text,'message_id':question['id']})
assert routed.status_code==200,(routed.status_code,routed.data)
assert routed.get_json()['needs_vision'] is True and not routed.get_json().get('answer')
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':question['id'],'robot_id':'testrobot-0220','media_id':'fake'}).status_code==400
jpeg=b'\xff\xd8'+(b'\x00'*420)+b'\xff\xd9'
photo=c.post('/api/media',headers=headers,data={'file':(_BytesIO(jpeg),'vision.jpg','image/jpeg')})
assert photo.status_code==200,(photo.status_code,photo.data)
photo_id=photo.get_json()['media']['id']
with patch('server.active_model_key',return_value='test-key'),patch('server.meta_request',return_value={
    'id':'resp-vision-chat','output':[{'type':'message','content':[{'type':'output_text','text':'I see a chair directly ahead of me.'}]}],
    'usage':{'input_tokens':180,'output_tokens':12,'images_processed':1}}) as vision_mock:
    chat_attempts[data['user']['id']]=[]
    seen=c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':question['id'],'robot_id':'testrobot-0220','media_id':photo_id})
assert seen.status_code==200,(seen.status_code,seen.data)
assert 'chair directly ahead' in seen.get_json()['answer']['text']
assert photo_id in seen.get_json()['answer']['media']
assert vision_mock.call_count==1
parts=vision_mock.call_args.args[2]['input'][0]['content']
assert [part['type'] for part in parts]==['input_text','input_image']
assert parts[1]['image_url'].startswith('data:image/jpeg;base64,')
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':question['id'],'robot_id':'testrobot-0220','media_id':photo_id}).status_code==409
# The saved portrait is represented as a room-scoped media ID rather than a user avatar.
robot['brain']['portrait']=photo_id
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot}).status_code==200
saved=c.get('/api/messages?room=lab',headers=headers).get_json()['messages']
assert next(m for m in saved if m['id']==seen.get_json()['answer']['id'])['avatar']==photo_id
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'testrobot-0220'}}).status_code==200
print('PASS: robot Brains persisted, validated and permissioned; usage and diagnostics secured')

# Expired/rotated token and conflicting tabs must return explicit auth failures.
r=c.post('/api/onboard',json={'name':name,'id':data['user']['id'],'recovery':data['recovery'],'tab':'second-tab-test-002'},headers={'Origin':origin})
assert r.status_code==200,(r.status_code,r.data)
newtoken=r.get_json()['token']
assert c.get('/api/me',headers=headers).status_code==401
assert c.get('/api/me',headers={'Authorization':'Bearer '+newtoken,'X-Solvi-Tab':'test-tab-unique-001'}).status_code==409
assert c.get('/api/me',headers={'Authorization':'Bearer '+newtoken,'X-Solvi-Tab':'second-tab-test-002'}).status_code==200
# Subsequent avatar/STT tests must use the recovered session, not the intentionally
# invalidated token from the expired-session regression immediately above.
headers = {**headers, 'Authorization': 'Bearer '+newtoken, 'X-Solvi-Tab': 'second-tab-test-002'}
assert c.get('/api/me',headers=headers).status_code==200
print('PASS: expired token 401, different tab 409, recovered login succeeds')

# STT requires login and strictly checks language and MIME without running inference.
assert c.post('/api/stt',headers={'Origin':origin}).status_code==401
assert c.get('/api/health').get_json()['stt']['engine']=='whisper.cpp'
r=c.get('/api/avatars',headers=headers)
assert r.status_code==200,(r.status_code,r.data)
from io import BytesIO
# A valid GLB v2 requires a 12-byte file header followed by a 4-byte-aligned
# JSON chunk (8-byte chunk header + JSON bytes). The previous fixture had a
# 20-byte length field but provided only 16 bytes; rejection was correct.
import json as _json
scene_json=_json.dumps({'asset':{'version':'2.0'},'scene':0,'scenes':[{'nodes':[]}]},separators=(',',':')).encode('utf-8')
scene_json+=b' '*((-len(scene_json))%4)
glb_size=12+8+len(scene_json)
glb=b'glTF'+(2).to_bytes(4,'little')+glb_size.to_bytes(4,'little')+len(scene_json).to_bytes(4,'little')+b'JSON'+scene_json
assert len(glb)==glb_size and len(glb)%4==0
# Malformed uploads must still be rejected (the former test incorrectly expected 201).
invalid_glb=b'glTF'+(2).to_bytes(4,'little')+(20).to_bytes(4,'little')+(8).to_bytes(4,'little')
r=c.post('/api/avatars',headers=headers,data={'avatar':(BytesIO(invalid_glb),'invalid.glb')})
assert r.status_code==400,(r.status_code,r.data)
r=c.post('/api/avatars',headers=headers,data={'avatar':(BytesIO(glb),'unit-test.glb')})
assert r.status_code==201,(r.status_code,r.data)
asset_url=r.get_json()['avatar']['url']
assert c.get(asset_url).status_code==200
assert len(c.get('/api/avatars',headers=headers).get_json()['avatars'])>=1

print('PASS: speech endpoint authentication, STT health and valid GLB avatar upload')

# Logging out revokes the token server-side; the same browser tab cannot use it again.
assert c.post('/api/logout',headers=headers,json={}).status_code==200
assert c.get('/api/me',headers=headers).status_code==401
print('PASS: logout invalidates browser session token')
