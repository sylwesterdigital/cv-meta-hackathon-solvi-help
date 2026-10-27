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
health=r.get_json();assert health['service']=='solvi-help-api' and health['version']==__import__('os').environ.get('SOLVI_EXPECTED_VERSION','0.2.5')
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
assert c.put('/api/scene',headers=headers,json={'room':'lab','revision':0,'objects':[]}).status_code==200
assert c.get('/api/scene?room=lab',headers=headers).get_json()['revision']==1
assert c.get('/api/scene?room=main',headers=headers).get_json()['revision']==0
# Atomic per-object updates preserve changes and remain room-specific.
obj={'id':'testcube-001','kind':'cube','name':'Test cube','position':[1,1,0],
     'rotation':[0,0,0],'scale':[1,1,1],'color':'#abcdef','texture':'checker'}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':obj})
assert r.status_code==200,(r.status_code,r.data)
lab_obj=c.get('/api/scene?room=lab',headers=headers).get_json()['objects']
assert len(lab_obj)==1 and lab_obj[0]['texture']=='checker'
assert c.get('/api/scene?room=main',headers=headers).get_json()['objects']==[]
obj['position']=[2,1,0]
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':obj}).status_code==200
assert len(c.get('/api/scene?room=lab',headers=headers).get_json()['objects'])==1
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'testcube-001'}}).status_code==200
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects']==[]
print('PASS: atomic object create/update/delete with room isolation')
print('PASS: rooms and isolation')
print('PASS: Flask health, SQLite profile, auth, human chat, messages, scene and admin protection')

# Expired/rotated token and conflicting tabs must return explicit auth failures.
r=c.post('/api/onboard',json={'name':name,'id':data['user']['id'],'recovery':data['recovery'],'tab':'second-tab-test-002'},headers={'Origin':origin})
assert r.status_code==200,(r.status_code,r.data)
newtoken=r.get_json()['token']
assert c.get('/api/me',headers=headers).status_code==401
assert c.get('/api/me',headers={'Authorization':'Bearer '+newtoken,'X-Solvi-Tab':'test-tab-unique-001'}).status_code==409
assert c.get('/api/me',headers={'Authorization':'Bearer '+newtoken,'X-Solvi-Tab':'second-tab-test-002'}).status_code==200
print('PASS: expired token 401, different tab 409, recovered login succeeds')
