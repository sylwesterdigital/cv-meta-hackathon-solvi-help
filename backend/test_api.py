"""Run in a temporary data directory, never the production SQLite directory."""
import json
import os
# Deployment contract: every local Python helper imported by server.py must be
# installed alongside it, not merely included in the tested release ZIP.
import ast
from pathlib import Path as _Path
_backend_dir=_Path(__file__).resolve().parent
_server_ast=ast.parse((_backend_dir/'server.py').read_text(encoding='utf-8'))
_installer=(_backend_dir/'install-ubuntu.sh').read_text(encoding='utf-8')
_local_imports={node.module.split('.')[0] for node in ast.walk(_server_ast)
                if isinstance(node,ast.ImportFrom) and node.module
                and (_backend_dir/(node.module.split('.')[0]+'.py')).is_file()}
assert _local_imports, 'No local backend modules found; check backend import detection'
for _module in _local_imports:
    assert f'{_module}.py' in _installer, f'Installer missing {_module}.py'
    assert 'BACKEND_PY_MODULES=' in _installer and 'install -m 644 "$SRC/$module" "$TARGET/$module"' in _installer, 'Installer must deploy local Python modules'
assert "DEPLOY_PHASE='Python backend import preflight'" in _installer
print('PASS: local backend modules deployed, rollback protected and import preflight configured')
from server import app, patch_scene_object, valid_robot_combat, db
# Regression: the Flask POST decorator must belong to the HTTP handler,
# never to the combat-settings validator (the latter takes a settings arg).
scene_object_rules=[rule for rule in app.url_map.iter_rules()
                    if rule.rule=='/api/scene/object' and 'POST' in rule.methods]
assert len(scene_object_rules)==1 and app.view_functions[scene_object_rules[0].endpoint] is patch_scene_object, scene_object_rules
assert not hasattr(valid_robot_combat, 'view_class') and callable(valid_robot_combat)
assert valid_robot_combat({'punch': {'key':'KeyP', 'force':6.0}, 'kick': {'key':'KeyK', 'force':9}})
assert not valid_robot_combat({'punch': {'key':'Key-P', 'force':6.0}})
assert not valid_robot_combat({'kick': {'key':'KeyK', 'force':float('nan')}})
print('PASS: combat validator separate from Flask route and scene-object POST correctly registered')
from server import valid_curve_geometry, valid_cube_openings, valid_surface_mount
_curve={'points':[[0,0,0],[1,0,2]],'offset':0,'extrude':.15,'bevel':.02,'bevelResolution':4,'resolution':30}
assert valid_curve_geometry(_curve)
assert not valid_curve_geometry({**_curve,'points':[[0,0,0],[float('inf'),0,0]]})
assert valid_cube_openings([{'axis':'z','u':0,'v':0,'width':.4,'height':.6}])
assert not valid_cube_openings([{'axis':'z','u':0,'v':0,'width':float('nan'),'height':.6}])
assert valid_surface_mount({'target':'model-abc123','localPoint':[0,0,.5],'localNormal':[0,0,1],'width':1,'height':1})
assert not valid_surface_mount({'target':'model-abc123','localPoint':[0,0,float('inf')],'localNormal':[0,0,1],'width':1,'height':1})
assert '/api/media/room' in {r.rule for r in app.url_map.iter_rules()}
print('PASS: 3D curves, cube cutouts, mounted media bounds and room-media browser')

from server import robot_command_clause
_multiples=[{'id':'e','name':'Elox'},{'id':'c','name':'Cybert'}]
_split='@Elox go to Black Sofa and @Cybert please follow Elox'
assert robot_command_clause(_split,_multiples[0],_multiples)=='go to Black Sofa'
assert robot_command_clause(_split,_multiples[1],_multiples)=='please follow Elox'
assert robot_command_clause('@Elox go to @Cybert and stop nearby',_multiples[0],_multiples)=='@Elox go to @Cybert and stop nearby'
assert robot_command_clause('@All go to Red Shere',_multiples[0],_multiples)=='@All go to Red Shere'
print('PASS: independent multi-robot commands and shared/group intentions stay correctly scoped')

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
# Shared library: action counts, owner-checked export, referenced-file protection,
# confirmed deletion, and no modification of bundled release avatars.
import io as _io, struct as _struct, zipfile as _zipfile
_test_json=json.dumps({'asset':{'version':'2.0'},'animations':[{'name':'Walking'},{'name':'Running'}]}).encode()
_test_json+=b' ' * ((-len(_test_json))%4)
_test_glb=b'glTF'+_struct.pack('<II',2,20+len(_test_json))+_struct.pack('<I',len(_test_json))+b'JSON'+_test_json
av_response=c.post('/api/avatars',headers=headers,data={'avatar':(_io.BytesIO(_test_glb),'manage-avatar.glb')},content_type='multipart/form-data')
assert av_response.status_code==201,(av_response.status_code,av_response.data)
av_id=av_response.get_json()['avatar']['id']
assert av_response.get_json()['avatar']['actions']==2
av_list=c.get('/api/avatars',headers=headers).get_json()
assert next(a for a in av_list['avatars'] if a['id']==av_id)['canManage'] is True
assert isinstance(av_list['bundled'],list)
model_response=c.post('/api/scene/models',headers=headers,data={'model':(_io.BytesIO(_test_glb),'manage-model.glb')},content_type='multipart/form-data')
assert model_response.status_code==201,(model_response.status_code,model_response.data)
model_id=model_response.get_json()['model']['id']
for kind,ident in [('avatars',av_id),('models',model_id)]:
    request={'kind':kind,'ids':[ident]}
    assert c.post('/api/library/delete',headers=headers,json=request).status_code==400,'Deletion must require confirmation'
    export=c.post('/api/library/export',headers=headers,json=request)
    assert export.status_code==200,(export.status_code,export.data[:150])
    with _zipfile.ZipFile(_io.BytesIO(export.data)) as archive:
        assert 'library.json' in archive.namelist()
        assert any(name.startswith('models/'+ident+'.') for name in archive.namelist())
    reference='/api/avatars/'+ident+'.glb' if kind=='avatars' else '/api/scene/models/'+ident+'.glb'
    field='avatar' if kind=='avatars' else 'model'
    robot_record={'id':'preserved-robot','kind':'robot','name':'Sofia',
                  'position':[4,0,8],'rotation':[0,1,0],'scale':[1,1,1],
                  'avatar':reference,'brain':{'personality':'Keep this robot alive'},'speed':2.1}
    with db() as con:
        before_revision=con.execute('SELECT revision FROM room_scenes WHERE room_id=?',('main',)).fetchone()['revision']
        con.execute('UPDATE room_scenes SET payload=? WHERE room_id=?',
                    (json.dumps([robot_record] if kind=='avatars' else [{field:reference}]),'main'))
    if kind=='models':
        blocked=c.post('/api/library/delete',headers=headers,json={**request,'confirm':True})
        assert blocked.status_code==409,(kind,blocked.status_code,blocked.data)
        with db() as con:con.execute('UPDATE room_scenes SET payload=? WHERE room_id=?',('[]','main'))
    removed=c.post('/api/library/delete',headers=headers,json={**request,'confirm':True})
    if kind=='avatars':
        assert removed.status_code==200,(removed.status_code,removed.data)
        assert removed.get_json()['replacedRobots']==1
        assert removed.get_json()['affectedRealms']==1
        with db() as con:
            updated=con.execute('SELECT revision,payload FROM room_scenes WHERE room_id=?',('main',)).fetchone()
            assert updated['revision']==before_revision+1
            objects=json.loads(updated['payload'])
            assert objects==[{**robot_record,'avatar':'./assets/solvi-character.glb'}],objects
            con.execute('UPDATE room_scenes SET payload=? WHERE room_id=?',('[]','main'))
    assert removed.status_code==200,(kind,removed.status_code,removed.data)
    assert ident in removed.get_json()['deleted']
assert c.post('/api/library/export',headers=headers,json={'kind':'avatars','ids':[],'bundled':['fake-builtin']}).status_code==400
# Permanent bundled deletion is administrator-only, removes the server file,
# updates the catalog, and survives the next static asset deployment.
from unittest.mock import patch as _patch
from tempfile import TemporaryDirectory as _Temp
from server import sha as _sha
with _Temp() as scratch:
    static=_Path(scratch)
    folder=static/'assets/avatars';folder.mkdir(parents=True)
    sample='test-bundled-delete'
    file=folder/(sample+'.glb');file.write_bytes(_test_glb)
    catalog=folder/'catalog.json'
    catalog.write_text(json.dumps({'version':1,'avatars':[{'id':sample,'label':'Removable model','url':'./assets/avatars/'+sample+'.glb'}]}))
    with _patch('server.ROOT',static):
        bad=c.post('/api/library/delete',headers=headers,json={'kind':'avatars','ids':[],'bundled':[sample],'confirm':True})
        assert bad.status_code==403,(bad.status_code,bad.data)
        secret='temporary-admin-library-delete'
        with db() as con:con.execute('INSERT INTO admin_sessions(token_hash,expires) VALUES(?,?)',(_sha(secret),float('4102444800')))
        adm={**headers,'X-Solvi-Admin':secret}
        found=c.get('/api/avatars',headers=adm).get_json()['bundled']
        assert len(found)==1 and found[0]['canManage'] is True
        original={'id':'special-robot','kind':'robot','name':'Persistent robot',
                  'avatar':'./assets/avatars/'+sample+'.glb','owner':'creator',
                  'position':[5,2,6],'brain':{'history':'Unchanged history'},'animationSpeed':{'walk':1,'run':1,'jump':1}}
        with db() as con:
            before=con.execute('SELECT revision FROM room_scenes WHERE room_id=?',('main',)).fetchone()['revision']
            con.execute('UPDATE room_scenes SET payload=? WHERE room_id=?',(json.dumps([original]),'main'))
        removed=c.post('/api/library/delete',headers=adm,json={'kind':'avatars','ids':[],'bundled':[sample],'confirm':True})
        assert removed.status_code==200,(removed.status_code,removed.data)
        assert removed.get_json()['replacedRobots']==1
        with db() as con:
            saved=con.execute('SELECT revision,payload FROM room_scenes WHERE room_id=?',('main',)).fetchone()
            assert saved['revision']==before+1
            assert json.loads(saved['payload'])==[{**original,'avatar':'./assets/solvi-character.glb'}]
            con.execute('UPDATE room_scenes SET payload=? WHERE room_id=?',('[]','main'))
        assert not file.exists() and json.loads(catalog.read_text())['avatars']==[]
        file.write_bytes(_test_glb)
        catalog.write_text(json.dumps({'version':1,'avatars':[{'id':sample,'url':'./assets/avatars/'+sample+'.glb'}]}))
        from prune_removed_avatars import prune
        assert prune(str(__import__('server').DB),str(static))==1
        assert not file.exists() and json.loads(catalog.read_text())['avatars']==[]
        assert c.get('/api/avatars',headers=adm).get_json()['bundled']==[]
print('PASS: permanent bundled-avatar deletion, admin permission, catalog and redeploy tombstones')
print('PASS: library bulk management, action counts, protected deletion and ZIP export')
# Administrator is a separate, short-lived, revocable permission on the same signed-in user.
assert c.post('/api/admin/logout',headers=headers,json={}).status_code==403
with db() as con:con.execute('INSERT OR REPLACE INTO admin_sessions(token_hash,expires) VALUES(?,?)',(_sha('profile-admin-token'),float('4102444800')))
admin_headers={**headers,'X-Solvi-Admin':'profile-admin-token'}
assert c.get('/api/admin/stats',headers=admin_headers).status_code==200
assert c.post('/api/admin/logout',headers=admin_headers,json={}).get_json()=={'ok':True,'admin':False}
assert c.get('/api/admin/stats',headers=admin_headers).status_code==403
assert c.post('/api/admin/logout',headers=admin_headers,json={}).status_code==403
print('PASS: global Profile administrator session can unlock server operations and revoke without logging out user')

assert c.get('/api/me',headers=headers).status_code==200
# v0.2.57: favorite chat color persists, is validated, and flows into messages.
color_response=c.put('/api/profile',headers=headers,json={'name':name,'color':'#eb6f8a'})
assert color_response.status_code==200,(color_response.status_code,color_response.data)
assert color_response.get_json()['user']['color']=='#eb6f8a'
assert c.put('/api/profile',headers=headers,json={'name':name,'color':'not-a-color'}).status_code==400
r=c.post('/api/message',json={'text':'Hello SOLVI world','media':[]},headers=headers)
assert r.status_code==200,(r.status_code,r.data)
assert r.get_json()['message']['text']=='Hello SOLVI world'
assert c.get('/api/messages',headers=headers).get_json()['messages'][-1]['speaker_color']=='#eb6f8a'
r=c.get('/api/messages',headers=headers)
assert r.status_code==200 and len(r.get_json()['messages'])==1
assert c.get('/api/scene',headers=headers).status_code==200
r=c.get('/api/models',headers=headers)
assert r.status_code in (200,502),r.data
assert c.post('/api/admin/login',headers=headers,json={'password':'guess'}).status_code in (403,429)
r=c.post('/api/rooms',headers=headers,json={'id':'lab','title':'Robot Lab'})
assert r.status_code==200,(r.status_code,r.data)
assert any(x['id']=='lab' for x in c.get('/api/rooms',headers=headers).get_json()['rooms'])
assert next(r for r in c.get('/api/rooms',headers=headers).get_json()['rooms'] if r['id']=='lab')['owner_id']==data['user']['id']
assert c.patch('/api/rooms/lab',headers=headers,json={'title':'Renamed laboratory'}).status_code==200
assert next(r for r in c.get('/api/rooms',headers=headers).get_json()['rooms'] if r['id']=='lab')['title']=='Renamed laboratory'
assert c.delete('/api/rooms/lab',headers=headers,json={'confirm_title':'wrong'}).status_code==400
assert c.delete('/api/rooms/main',headers=headers,json={'confirm_title':'Main realm'}).status_code==403
assert c.post('/api/rooms',headers=headers,json={'id':'temporary-realm','title':'Temporary Realm'}).status_code==200
assert c.delete('/api/rooms/temporary-realm',headers=headers,json={'confirm_title':'wrong'}).status_code==400
assert c.delete('/api/rooms/temporary-realm',headers=headers,json={'confirm_title':'Temporary Realm'}).status_code==200
assert not any(r['id']=='temporary-realm' for r in c.get('/api/rooms',headers=headers).get_json()['rooms'])
clone_a=c.post('/api/rooms/lab/clone',headers=headers)
assert clone_a.status_code==200,(clone_a.status_code,clone_a.data)
assert clone_a.get_json()['room']['title']=='Renamed laboratory copy (1)'
clone_b=c.post('/api/rooms/lab/clone',headers=headers)
assert clone_b.status_code==200,(clone_b.status_code,clone_b.data)
assert clone_b.get_json()['room']['title']=='Renamed laboratory copy (2)'
assert c.post('/api/rooms/not-a-realm/clone',headers=headers).status_code==404
assert c.get('/api/scene?room='+clone_a.get_json()['room']['id'],headers=headers).status_code==200
print('PASS: realm ownership, rename, protected main realm and exact-name double-confirmation delete')
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
# Avatar-deletion regression fixtures above legitimately incremented the main
# realm revision. A write to lab must not change main; it need not be revision 0.
main_revision_before_lab=c.get('/api/scene?room=main',headers=headers).get_json()['revision']
assert c.put('/api/scene',headers=headers,json={'room':'lab','revision':0,'objects':[]}).status_code==200
assert c.get('/api/scene?room=lab',headers=headers).get_json()['revision']==1
assert c.get('/api/scene?room=main',headers=headers).get_json()['revision']==main_revision_before_lab
print('PASS: avatar fallback scene revisions remain intact; lab writes do not modify main')
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
# Transform locks are validated on the server and survive individual patches and full-room saves.
fixture={'id':'lockcube-0049','kind':'cube','name':'Large model lock test',
         'position':[0,0,0],'rotation':[0,0,0],'scale':[1,1,1],'transformLocked':True}
req={'room':'lab','action':'upsert','object':fixture}
r=c.post('/api/scene/object',headers=headers,json=req)
assert r.status_code==200,(r.status_code,r.data)
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects'][0]['transformLocked'] is True
bad={**fixture,'transformLocked':'yes'}
r=c.post('/api/scene/object',headers=headers,json={**req,'object':bad})
assert r.status_code==400,(r.status_code,r.data)
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects'][0]['transformLocked'] is True
fixture['transformLocked']=False
assert c.post('/api/scene/object',headers=headers,json=req).status_code==200
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects'][0]['transformLocked'] is False
scene=c.get('/api/scene?room=lab',headers=headers).get_json()
fixture['transformLocked']=True
r=c.put('/api/scene',headers=headers,json={'room':'lab','revision':scene['revision'],'objects':[fixture]})
assert r.status_code==200,(r.status_code,r.data)
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects'][0]['transformLocked'] is True
scene=c.get('/api/scene?room=lab',headers=headers).get_json()
fixture['transformLocked']='yes'
r=c.put('/api/scene',headers=headers,json={'room':'lab','revision':scene['revision'],'objects':[fixture]})
assert r.status_code==400,(r.status_code,r.data)
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'lockcube-0049'}}).status_code==200
print('PASS: per-object transform locks, bool validation and bulk/patch persistence')
robot={'id':'testrobot-001','kind':'robot','name':'Pilot','position':[0,0,0],
       'rotation':[0,0,0],'scale':[1,1,1],'speed':1.65}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot})
assert r.status_code==200,(r.status_code,r.data)
assert c.get('/api/scene?room=lab',headers=headers).get_json()['objects'][0]['speed']==1.65
# Persist combat bindings through both the atomic object endpoint and full-scene PUT.
robot['combat']={'punch':{'key':'KeyP','force':6},'kick':{'key':'KeyK','force':8.5},'throw':{'key':'','force':4}}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot})
assert r.status_code==200,(r.status_code,r.data)
scene=c.get('/api/scene?room=lab',headers=headers).get_json()
assert scene['objects'][0]['combat']==robot['combat']
r=c.put('/api/scene',headers=headers,json={'room':'lab','revision':scene['revision'],'objects':[robot]})
assert r.status_code==200,(r.status_code,r.data)
for bad_combat in ({'punch':{'key':'Key-P','force':6}}, {'kick':{'key':'KeyK','force':float('nan')}}, {'kick':{'key':'KeyK','force':90}}):
    invalid={**robot,'combat':bad_combat}
    r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':invalid})
    assert r.status_code==400,(bad_combat,r.status_code,r.data)
    scene=c.get('/api/scene?room=lab',headers=headers).get_json()
    r=c.put('/api/scene',headers=headers,json={'room':'lab','revision':scene['revision'],'objects':[invalid]})
    assert r.status_code==400,(bad_combat,r.status_code,r.data)
print('PASS: robot combat controls persist via atomic/bulk saves and reject invalid bindings')
# Animation playback settings persist per robot and reject malformed profiles.
robot['animationSpeed']={'walk':.7,'run':1.1,'jump':.85}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot})
assert r.status_code==200,(r.status_code,r.data)
scene=c.get('/api/scene?room=lab',headers=headers).get_json()
assert scene['objects'][0]['animationSpeed']==robot['animationSpeed']
r=c.put('/api/scene',headers=headers,json={'room':'lab','revision':scene['revision'],'objects':[robot]})
assert r.status_code==200,(r.status_code,r.data)
for bad_speed in ({'walk':1,'run':1}, {'walk':0,'run':1,'jump':1}, {'walk':1,'run':1,'jump':3},
                  {'walk':True,'run':1,'jump':1}, {'walk':1,'run':1,'jump':float('nan')}):
    invalid={**robot,'animationSpeed':bad_speed}
    assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':invalid}).status_code==400
    scene=c.get('/api/scene?room=lab',headers=headers).get_json()
    assert c.put('/api/scene',headers=headers,json={'room':'lab','revision':scene['revision'],'objects':[invalid]}).status_code==400
print('PASS: per-robot walking/running/jump playback speed persist via object/bulk saves with bounded validation')

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
# Room-scoped sky, fog and ground settings survive a reload without changing policy schema.
assert c.get('/api/room/environment',headers=headers).status_code==200
assert c.get('/api/room/environment?room=lab',headers=headers).get_json()['environment']['floorSize']==70
appearance={'fogEnabled':False,'gridEnabled':False,'floorSize':2400,
            'fogColor':'#8899aa','fogNear':35,'fogFar':9000,
            'backgroundColor':'#223344','skyType':'nebula','skyTop':'#123456',
            'skyHorizon':'#778899','skySpeed':1.2,'skyIntensity':1.5,
            'starDensity':0.9,'viewDistance':20000}
r=c.put('/api/room/environment',headers=headers,json={'room':'lab','environment':appearance})
assert r.status_code==200,(r.status_code,r.data)
saved=c.get('/api/room/environment?room=lab',headers=headers).get_json()['environment']
assert saved['floorSize']==2400 and saved['skyType']=='nebula' and saved['fogEnabled'] is False
assert saved['skySpeed']==1.2 and saved['viewDistance']==20000
assert c.get('/api/room/environment?room=main',headers=headers).get_json()['environment']['floorSize']==70
for bad in [{'skyType':'external-url'},{'fogColor':'not-a-color'},{'fogFar':10,'fogNear':20},
            {'floorSize':99999999},{'gridEnabled':'false'},{'starDensity':float('nan')},
            {'invalidSetting':1}]:
    assert c.put('/api/room/environment',headers=headers,json={'room':'lab','environment':bad}).status_code==400,bad
assert c.get('/api/room/environment?room=unknown',headers=headers).status_code==404
print('PASS: room-specific fog/grid/floor/sky appearance, persistence, validation and isolation')
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
# A second uploaded model can replace the first without changing object identity, pose or scale.
second_upload=c.post('/api/scene/models',headers=headers,data={'model':(BytesIO(glb),'new-sofa.glb')},content_type='multipart/form-data')
assert second_upload.status_code==201
second_asset=second_upload.get_json()['model']['url']
assert {asset,second_asset}.issubset({entry['url'] for entry in c.get('/api/scene/models',headers=headers).get_json()['models']})
placed={'id':'modelitem-001','kind':'model','name':'Shared mesh','model':asset,
        'position':[1,0,1],'rotation':[0,0,0],'scale':[1,1,1]}
r=c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':placed})
assert r.status_code==200,(r.status_code,r.data)
entry=next(o for o in c.get('/api/scene?room=lab',headers=headers).get_json()['objects'] if o['id']=='modelitem-001')
assert entry['model']==asset and entry['position']==[1,0,1]
placed['model']=second_asset
placed['scale']=[2.5,1.3,4]
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':placed}).status_code==200
swapped=next(o for o in c.get('/api/scene?room=lab',headers=headers).get_json()['objects'] if o['id']=='modelitem-001')
assert swapped['model']==second_asset and swapped['scale']==[2.5,1.3,4] and swapped['position']==[1,0,1]
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
# v0.2.39 voice: only the saved robot's own reply can be rendered as sound.
from unittest.mock import patch as speech_patch
robot['brain']={**brain,'voiceProvider':'local','voiceLang':'en','voicePitch':'0.85','voiceRate':'1.15'}
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot}).status_code==200
speech_calls=[]
def mock_speech(provider, text, voice, lang, rate, pitch, key, gender='auto'):
    # Keep the mock in sync with the production speech synthesizer's gender argument.
    speech_calls.append({'provider':provider,'rate':rate,'pitch':pitch,'text':text,'gender':gender})
    return ((b'RIFF'+b'\x00'*500,'audio/wav'),None,200)
with speech_patch('server._robot_speech_audio',side_effect=mock_speech):
    ok=c.post('/api/robots/speech',headers=headers,json={'room':'lab','robot_id':robot['id'],
        'message_id':'test-robot-speaking'})
    assert ok.status_code==200 and ok.mimetype=='audio/wav',(ok.status_code,ok.data)
    assert c.post('/api/robots/speech',headers=headers,json={'room':'main','robot_id':robot['id'],
        'message_id':'test-robot-speaking'}).status_code==404
    assert c.post('/api/robots/speech',headers=headers,json={'room':'lab','robot_id':robot['id'],
        'message_id':'not-a-real-message'}).status_code==403
    preview=c.post('/api/robots/speech',headers=headers,json={'room':'lab','robot_id':robot['id'],'test':True})
    assert preview.status_code==200,(preview.status_code,preview.data)
    assert preview.mimetype=='audio/wav'
    assert speech_calls[-1]['rate']==1.15 and speech_calls[-1]['pitch']==0.85,speech_calls[-1]
    assert speech_calls[-1]['gender']=='auto',speech_calls[-1]
    # Isolate the added preview calls from the normal per-user speech throttle;
    # later ElevenLabs tests still exercise their own rate budget.
    with speech_patch('server.SPEECH_TIMES', {}):
        # Preview gender should not overwrite the saved profile.
        preview_female=c.post('/api/robots/speech',headers=headers,json={
            'room':'lab','robot_id':robot['id'],'test':True,'gender':'female'})
        assert preview_female.status_code==200,(preview_female.status_code,preview_female.data)
        assert speech_calls[-1]['gender']=='female',speech_calls[-1]
        # Robot identity and voice presentation are independently persisted, and
        # voice presentation wins when explicitly configured.
        robot['brain']['gender']='female'
        assert c.post('/api/scene/object',headers=headers,json={
            'room':'lab','action':'upsert','object':robot}).status_code==200
        from_identity=c.post('/api/robots/speech',headers=headers,json={
            'room':'lab','robot_id':robot['id'],'test':True})
        assert from_identity.status_code==200,(from_identity.status_code,from_identity.data)
        assert speech_calls[-1]['gender']=='female',speech_calls[-1]
        robot['brain']['voiceGender']='male'
        assert c.post('/api/scene/object',headers=headers,json={
            'room':'lab','action':'upsert','object':robot}).status_code==200
        explicit_voice=c.post('/api/robots/speech',headers=headers,json={
            'room':'lab','robot_id':robot['id'],'test':True})
        assert explicit_voice.status_code==200,(explicit_voice.status_code,explicit_voice.data)
        assert speech_calls[-1]['gender']=='male',speech_calls[-1]
    # Unprovided preview rate/pitch must use the saved robot settings. Explicit
    # preview overrides are independent, including one-axis-only overrides.
    for overrides,rate,pitch in (({'rate':1.25},1.25,.85),({'pitch':1.15},1.15,1.15),
                                  ({'rate':0.8,'pitch':1.3},.8,1.3),
                                  ({'rate':None,'pitch':None},1.15,.85)):
        payload={'room':'lab','robot_id':robot['id'],'test':True,**overrides}
        r=c.post('/api/robots/speech',headers=headers,json=payload)
        assert r.status_code==200,(payload,r.status_code,r.data)
        # A duplicate parameter set may hit the cache without synthesizing again.
        assert r.mimetype=='audio/wav'
        if overrides != {'rate':None,'pitch':None}:
            assert speech_calls[-1]['rate']==rate and speech_calls[-1]['pitch']==pitch,speech_calls[-1]
    invalid=c.post('/api/robots/speech',headers=headers,json={
        'room':'lab','robot_id':robot['id'],'test':True,'rate':'not-a-number'})
    assert invalid.status_code==400,(invalid.status_code,invalid.data)
print('PASS: robot speech honours saved messages, room isolation, preview defaults and overrides')

# v0.2.41: ElevenLabs errors are explicit, and authenticated voice selection
# does not expose the API key to other users or store it in room data.
from io import BytesIO as SpeechBytesIO
from urllib.error import HTTPError as SpeechHTTPError
class FakeElevenAudio:
    headers={'Content-Type':'audio/mpeg'}
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def read(self,size=-1):return b'ID3'+b'x'*500
with speech_patch('server.urlopen',return_value=FakeElevenAudio()) as client:
    generated=c.post('/api/robots/speech',headers={**headers,'X-Solvi-Voice-Key':'a'*24},json={
        'room':'lab','robot_id':robot['id'],'test':True,'provider':'elevenlabs',
        'voice_id':'21m00Tcm4TlvDq8ikWAM'})
    assert generated.status_code==200,(generated.status_code,generated.get_data(as_text=True))
    assert generated.mimetype=='audio/mpeg' and generated.headers['X-Solvi-Voice-Provider']=='elevenlabs'
    sent=client.call_args.args[0]
    assert 'api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM' in sent.full_url
    assert sent.get_header('Xi-api-key')=='a'*24
    assert json.loads(sent.data)['model_id']=='eleven_multilingual_v2'
err=SpeechHTTPError('https://api.elevenlabs.io',401,'Unauthorized',{},SpeechBytesIO(b'{"detail":{"status":"invalid_api_key","message":"bad key"}}'))
with speech_patch('server.urlopen',side_effect=err):
    rejected=c.post('/api/robots/speech',headers={**headers,'X-Solvi-Voice-Key':'b'*24},json={
        'room':'lab','robot_id':robot['id'],'test':True,'provider':'elevenlabs',
        'voice_id':'21m00Tcm4TlvDq8ikWAM'})
    assert rejected.status_code==401,(rejected.status_code,rejected.data)
    assert 'ElevenLabs rejected' in rejected.get_json()['error']
    assert 'bad key' not in rejected.get_json()['error']
class FakeVoiceList:
    def __enter__(self):return self
    def __exit__(self,*args):return False
    def read(self,size=-1):return json.dumps({'voices':[{'voice_id':'21m00Tcm4TlvDq8ikWAM','name':'Example Voice','other':'secret'}],'has_more':False}).encode()
with speech_patch('server.urlopen',return_value=FakeVoiceList()):
    voices=c.get('/api/robots/voices',headers={**headers,'X-Solvi-Voice-Key':'a'*24})
    assert voices.status_code==200,(voices.status_code,voices.data)
    assert voices.get_json()['voices']==[{'id':'21m00Tcm4TlvDq8ikWAM','name':'Example Voice','languages':[],'accent':''}]
    assert c.get('/api/robots/voices').status_code==401
print('PASS: ElevenLabs generation, sanitized errors, and voice selection')


# v0.2.38: speech must execute Cybert's physical turn/walk commands, not
# fall through to a plausible but idle Muse Spark conversational answer.
# v0.2.57: no silent 6m cap; long routes and return cycles are accepted and bounded.
from server import plan_robot_command
long_command,long_ack=plan_robot_command('Cybert, can you walk 100m away from me?',{'name':'Cybert'},[])
assert long_command['kind']=='walk_forward' and long_command['distance']==100,(long_command,long_ack)
cycle_command,cycle_ack=plan_robot_command('Cybert, walk 15m and back 3 times',{'name':'Cybert'},[])
assert cycle_command['kind']=='walk_forward' and cycle_command['repeat']==3 and cycle_command['return_to_start'],(cycle_command,cycle_ack)
random_command,_=plan_robot_command('Cybert, do something random 3 times',{'name':'Cybert'},[])
assert random_command['kind']=='random_action' and random_command['repeat']==3,random_command
assert plan_robot_command('Cybert, walk 800m',{'name':'Cybert'},[])[0] is None
print('PASS: 100m distances, repeat-return cycles, bounded random actions, validated author color')
cybert={'id':'testrobot-cybert037' ,'kind':'robot','name':'Cybert','position':[0,0,0],
        'rotation':[0,0,0],'scale':[1,1,1],'speed':1.0}
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':cybert}).status_code==200
for instruction,kind in [
    ('Cybert, turn and walk for a while','turn_walk'),
    ('Cybert, turn right 90 degrees and walk 3 metres','turn_walk'),
    ('Cybert, turn left','turn'),
    ('CC: Cybert, roll forward for a while','walk_forward'),
    ('Cybert, jump','jump')]:
    posted=c.post('/api/message',headers=headers,json={'room':'lab','text':instruction}).get_json()['message']
    with patch('server.active_model_key',return_value=''):
        response=c.post('/api/robots/react',headers=headers,json={
            'room':'lab','text':instruction,'message_id':posted['id']})
    assert response.status_code==200,(instruction,response.status_code,response.data)
    payload=response.get_json()
    assert payload['command']['kind']==kind,(instruction,payload)
    assert payload['command']['robot_id']==cybert['id']
    assert payload['answer']['model']=='scene-command'
    if kind=='turn_walk':
        assert payload['command']['degrees']==90 and payload['command']['distance']==3
    completed=c.post('/api/robots/task-result',headers=headers,json={
        'room':'lab','task_id':payload['command']['id'],'status':'arrived'})
    assert completed.status_code==200,(instruction,completed.data)
# Literal imported-object labels such as 'chair1o' remain valid navigation goals.
chair={'id':'testchair-cybert037','kind':'cube','name':'chair1o','position':[3,0,1],
       'rotation':[0,0,0],'scale':[1,1,1]}
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':chair}).status_code==200
instruction='@Cybert roll to chair1o'
posted=c.post('/api/message',headers=headers,json={'room':'lab','text':instruction}).get_json()['message']
with patch('server.active_model_key',return_value=''):
    response=c.post('/api/robots/react',headers=headers,json={
        'room':'lab','text':instruction,'message_id':posted['id']})
assert response.status_code==200,(response.status_code,response.data)
assert response.get_json()['command']['target_id']==chair['id']
assert response.get_json()['command']['kind']=='go_to'
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':chair['id']}}).status_code==200
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':cybert['id']}}).status_code==200
assert c.get('/api/robots/memory?room=lab&id=testrobot-0220',headers=headers).status_code==200
robot['turnSpeed']=11
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
assert any(step.get('step')=='parse' and step.get('result')=='vision_search' for step in visual['trace']),visual['trace']
assert visual['command']['id']
failed=c.post('/api/robots/task-result',headers=headers,json={'room':'lab','task_id':visual['command']['id'],'status':'not-found'})
assert failed.status_code==200 and 'scanned six directions' in failed.get_json()['answer']['text'], (failed.status_code, failed.data)
print('PASS: six-direction SAM search failure reports its actual scan coverage')
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
assert is_robot_visual_question('@Elox powiedz co teraz widzisz?')
assert is_robot_visual_question('@Elox co widzisz?')
assert is_robot_visual_question('@Elox how are you? There are some new objects in the surroundings?')
assert is_robot_visual_question('@Elox can you see any new objects?')
assert not is_robot_visual_question('@Elox how are you?')
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
assert [part['type'] for part in parts]==['input_text','input_text','input_image']
assert parts[2]['image_url'].startswith('data:image/jpeg;base64,')
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':question['id'],'robot_id':'testrobot-0220','media_id':photo_id}).status_code==409
# v0.2.42: Eight-frame scan (2 frames in this fixture) is supplied in a
# SINGLE labelled Muse request. Only owned JPEGs, never image URLs from the client.
assert is_robot_visual_question('Paris please tilt down and take a look')
assert is_robot_visual_question('Paris, look around and find a chair')
assert not is_robot_visual_question('Paris, good morning')
scan_question=c.post('/api/message',headers=headers,json={'room':'lab','text':'Jessica look around and find a chair'}).get_json()['message']
photo2=c.post('/api/media',headers=headers,data={'file':(_BytesIO(jpeg),'scan2.jpg','image/jpeg')})
assert photo2.status_code==200,(photo2.status_code,photo2.data)
photo2_id=photo2.get_json()['media']['id']
with patch('server.active_model_key',return_value='test-key'), patch('server.meta_request',return_value={
    'id':'resp-360','output':[{'type':'message','content':[{'type':'output_text','text':'Ahead: grid; at 90 degrees: a chair.'}]}],
    'usage':{'input_tokens':180,'output_tokens':16,'images_processed':2}}) as panorama_mock:
    chat_attempts[data['user']['id']]=[]
    scan=c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':scan_question['id'],
        'robot_id':'testrobot-0220','media_ids':[photo_id,photo2_id],'views':['heading 0°','heading 90°']})
assert scan.status_code==200,(scan.status_code,scan.data)
assert scan.get_json()['request']['images']==2
assert all(m in scan.get_json()['answer']['media'] for m in (photo_id,photo2_id))
content=panorama_mock.call_args.args[2]['input'][0]['content']
assert [part['type'] for part in content]==['input_text','input_text','input_image','input_text','input_image']
assert '90°' in content[3]['text'] and len(content[4]['image_url'])>100
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':scan_question['id'],
        'robot_id':'testrobot-0220','media_ids':[photo_id,photo2_id],'views':['heading 0°','heading 90°']}).status_code==409
# Opt-in proactive visual inspection reserves one short-lived, owner-bound nonce.
from server import ROBOT_INITIATIVE_LAST
robot['brain']['initiativeVision']=True
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot}).status_code==200
ROBOT_INITIATIVE_LAST.clear()
with patch('server.active_model_key',return_value='test-key'):
    initiative_scan=c.post('/api/robots/initiative',headers=headers,json={'room':'lab','robot_id':'testrobot-0220'})
assert initiative_scan.status_code==200 and initiative_scan.get_json()['needs_vision'],initiative_scan.data
capture_token=initiative_scan.get_json()['vision_token']
with patch('server.active_model_key',return_value='test-key'),patch('server.meta_request',return_value={
    'id':'resp-autonomy','output_text':'I spotted a seat to my right. Should I approach it?',
    'usage':{'input_tokens':120,'output_tokens':16,'images_processed':2}}):
    chat_attempts[data['user']['id']]=[]
    spontaneous=c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab',
        'robot_id':'testrobot-0220','proactive':True,'vision_token':capture_token,
        'media_ids':[photo_id,photo2_id],'views':['heading 0°','heading 90°']})
assert spontaneous.status_code==200,(spontaneous.status_code,spontaneous.data)
assert 'seat' in spontaneous.get_json()['answer']['text']
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab',
    'robot_id':'testrobot-0220','proactive':True,'vision_token':capture_token,
    'media_ids':[photo_id],'views':['forward']}).status_code==403
# v0.2.44: manually initiated 180/360 camera scans are permitted only
# for an authenticated editor, with owned JPEGs and replay prevention.
assert is_robot_visual_question('Jessica, look around 180 degrees')
with patch('server.active_model_key',return_value='test-key'),patch('server.meta_request',return_value={
    'id':'resp-manual-scan','output_text':'Ahead: chair, right: doorway.',
    'usage':{'input_tokens':120,'output_tokens':12,'images_processed':2}}) as manual_mock:
    chat_attempts[data['user']['id']]=[]
    manual_scan=c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab',
        'robot_id':'testrobot-0220','manual':True,'question':'What can you see in the front half of this room?',
        'media_ids':[photo_id,photo2_id],'views':['heading -90°','heading 0°']})
assert manual_scan.status_code==200,(manual_scan.status_code,manual_scan.data)
assert 'chair' in manual_scan.get_json()['answer']['text']
assert manual_mock.call_count==1
# A real stitched preview is shared with humans but must NOT be uploaded
# as a fourth Muse input; only original direction-labelled source frames count.
photo3=c.post('/api/media',headers=headers,data={'file':(_BytesIO(jpeg),'scan3.jpg','image/jpeg')})
assert photo3.status_code==200,(photo3.status_code,photo3.data)
photo3_id=photo3.get_json()['media']['id']
pano_preview=c.post('/api/media',headers=headers,data={'file':(_BytesIO(jpeg),'stitched-panorama.jpg','image/jpeg')})
assert pano_preview.status_code==200,(pano_preview.status_code,pano_preview.data)
panorama_id=pano_preview.get_json()['media']['id']
with patch('server.active_model_key',return_value='test-key'),patch('server.meta_request',return_value={
    'id':'resp-stitched-scan','output_text':'I can see three distinct directions.',
    'usage':{'input_tokens':100,'output_tokens':11}}) as panorama_mock:
    chat_attempts[data['user']['id']]=[]
    stitched_scan=c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab',
        'robot_id':'testrobot-0220','manual':True,'question':'Describe the surroundings',
        'media_ids':[photo_id,photo2_id,photo3_id],
        'views':['heading 0°','heading 60°','heading 120°'],
        'panorama_media_id':panorama_id})
assert stitched_scan.status_code==200,(stitched_scan.status_code,stitched_scan.data)
assert json.loads(stitched_scan.get_json()['answer']['media'])==[panorama_id,photo_id,photo2_id,photo3_id]
assert stitched_scan.get_json()['request']['images']==3
assert panorama_mock.call_count==1
content=panorama_mock.call_args.args[2]['input'][0]['content']
assert sum(x['type']=='input_image' for x in content)==3
print('PASS: stitched preview appears first in chat while Muse receives only three source images')
# Preview references must belong to the current user, and cannot be confused
# with Muse's original direction-labelled image batch.
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab',
    'robot_id':'testrobot-0220','manual':True,'question':'Describe the room',
    'media_ids':[photo_id,photo2_id],'views':['heading 0°','heading 60°'],
    'panorama_media_id':'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}).status_code==400
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab',
    'robot_id':'testrobot-0220','manual':True,'question':'Replay',
    'media_ids':[photo_id,photo2_id],'views':['heading -90°','heading 0°']}).status_code==409
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab',
    'robot_id':'testrobot-0220','manual':True,'proactive':True,
    'media_ids':[photo_id],'views':['forward']}).status_code==400
# v0.2.66: autonomous camera perception is separate from social chat and
# uses a transient JPEG, per-robot nonce, visual memory and hard cooldown.
from server import ROBOT_PERCEPTION_LAST, ROBOT_PERCEPTION_USER_LAST, ROBOT_PERCEPTION_PENDING, latest_robot_visual_memory
ROBOT_PERCEPTION_LAST.clear();ROBOT_PERCEPTION_USER_LAST.clear();ROBOT_PERCEPTION_PENDING.clear()
with patch('server.active_model_key',return_value='test-key'):
    reservation=c.post('/api/robots/perception/start',headers=headers,json={'room':'lab','robot_id':'testrobot-0220'})
assert reservation.status_code==200 and reservation.get_json()['ready'],(reservation.status_code,reservation.data)
vision_token=reservation.get_json()['token']
with patch('server.active_model_key',return_value='test-key'):
    reserved_again=c.post('/api/robots/perception/start',headers=headers,json={'room':'lab','robot_id':'testrobot-0220'})
assert reserved_again.status_code==200 and reserved_again.get_json()['ready'] is False
with patch('server.active_model_key',return_value='test-key'),patch('server.meta_request',return_value={
    'id':'obs-1','output_text':'A grey sofa is ahead; no active mission calls for movement.',
    'usage':{'input_tokens':120,'output_tokens':12}}) as perceive_mock:
    perception=c.post('/api/robots/perception/complete',headers=headers,data={
        'room':'lab','robot_id':'testrobot-0220','token':vision_token,
        'frame':(_BytesIO(b'\xff\xd8'+b'0'*900+b'\xff\xd9'),'camera.jpg','image/jpeg')})
assert perception.status_code==200,(perception.status_code,perception.data)
assert perception.get_json()['observed'] is True
assert 'grey sofa' in latest_robot_visual_memory('lab','testrobot-0220')['text']
assert perceive_mock.call_count==1
assert c.post('/api/robots/perception/complete',headers=headers,data={
    'room':'lab','robot_id':'testrobot-0220','token':vision_token,
    'frame':(_BytesIO(b'\xff\xd8'+b'0'*900+b'\xff\xd9'),'camera.jpg','image/jpeg')}).status_code==403
# Normal conversation starts a real observation when visual memory becomes old,
# without any camera-specific phrase. This is not a text-only assertion.
with db() as con:
    con.execute('UPDATE robot_memories SET created=? WHERE room_id=? AND robot_id=? AND event LIKE ?',
               ('2025-01-01T00:00:00Z','lab','testrobot-0220','Camera observation:%'))
ordinary='Jessica, how has your day been?'
ordinary_message=c.post('/api/message',headers=headers,json={'room':'lab','text':ordinary}).get_json()['message']
with patch('server.active_model_key',return_value='test-key'):
    ordinary_route=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':ordinary,'message_id':ordinary_message['id']})
assert ordinary_route.status_code==200,(ordinary_route.status_code,ordinary_route.data)
assert ordinary_route.get_json().get('needs_vision') is True and ordinary_route.get_json().get('implicit_vision') is True
print('PASS: autonomous perception nonce, transient JPEG, stored visual memory, cooldown and natural conversation')

print('PASS: explicit Brains 180/360 vision scan uses one guarded Muse request')
# v0.2.46: target-directed sweep may discard all unmatched frames without
# sending irrelevant JPEGs to Muse or inventing a detected chair.
none_msg=c.post('/api/message',headers=headers,json={'room':'lab','text':'Jessica look around and find a chair'}).get_json()['message']
with patch('server.active_model_key',return_value='test-key'), patch('server.meta_request',side_effect=AssertionError('No Muse call for zero matched frames')) as unused_muse:
    no_evidence=c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':none_msg['id'],
      'robot_id':'testrobot-0220','media_ids':[],'views':[],'target_phrase':'chair','scanned_count':6})
assert no_evidence.status_code==200,(no_evidence.status_code,no_evidence.data)
assert no_evidence.get_json()['answer']['media']=='[]'
assert 'could not verify chair' in no_evidence.get_json()['answer']['text']
assert no_evidence.get_json()['request']['images']==0 and no_evidence.get_json()['usage'] is None
assert unused_muse.call_count==0
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':none_msg['id'],
      'robot_id':'testrobot-0220','media_ids':[],'views':[],'target_phrase':'chair','scanned_count':6}).status_code==409
no_evidence_other=c.post('/api/message',headers=headers,json={'room':'lab','text':'Jessica what do you see'}).get_json()['message']
assert c.post('/api/robots/vision-reply',headers=headers,json={'room':'lab','message_id':no_evidence_other['id'],
      'robot_id':'testrobot-0220','media_ids':[],'views':[],'target_phrase':'chair','scanned_count':6}).status_code==400
print('PASS: target scan drops irrelevant images, returns qualified no-match and spends zero Muse tokens')
print('PASS: 360 head-camera batching, real JPEGs, one Muse call, and nonce-protected proactive observation')
# The saved portrait is represented as a room-scoped media ID rather than a user avatar.
robot['brain']['portrait']=photo_id
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':robot}).status_code==200
saved=c.get('/api/messages?room=lab',headers=headers).get_json()['messages']
assert next(m for m in saved if m['id']==seen.get_json()['answer']['id'])['avatar']==photo_id
# v0.2.60: PDF/text attachments are validated and served as safe authenticated blobs.
pdf_upload=c.post('/api/media',headers=headers,data={'file':(_BytesIO(b'%PDF-1.4\n1 0 obj\n<<>>\nendobj\n'),'manual.pdf','application/pdf')})
assert pdf_upload.status_code==200,(pdf_upload.status_code,pdf_upload.data)
pdf_id=pdf_upload.get_json()['media']['id']
pdf_response=c.get('/api/media/'+pdf_id,headers=headers)
assert pdf_response.status_code==200 and pdf_response.mimetype=='application/pdf'
assert pdf_response.headers['X-Solvi-File-Name']=='manual.pdf'
assert c.post('/api/media',headers=headers,data={'file':(_BytesIO(b'not a pdf'),'fake.pdf','application/pdf')}).status_code==400
text_upload=c.post('/api/media',headers=headers,data={'file':(_BytesIO('Hello from SOLVI'.encode()),'notes.txt','text/plain')})
assert text_upload.status_code==200,(text_upload.status_code,text_upload.data)
assert c.get('/api/media/'+text_upload.get_json()['media']['id'],headers=headers).data==b'Hello from SOLVI'
assert c.post('/api/media',headers=headers,data={'file':(_BytesIO(b'bad\x00data'),'bad.txt','text/plain')}).status_code==400
# The full speech robot is not enough to relay: only exact @handles of actual robots count.
from server import robot_handle_mentions,plan_robot_command
elox={**robot,'id':'testrobot-elox-060','name':'Elox','brain':{'personality':'Friendly researcher'}}
assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'upsert','object':elox}).status_code==200
assert robot_handle_mentions('Please @Elox check with @Jessica', [robot,elox])==[elox,robot]
assert robot_handle_mentions('Discuss Jessica with Elox', [robot,elox])==[]
sofas=[{'id':'black-sofa','kind':'cube','name':'Black Sofa 2','position':[0,0,1]},
       {'id':'grey-sofa','kind':'cube','name':'Grey Sofa 1','position':[10,0,10]}]
command,ack=plan_robot_command('@Elox find Grey Sofa 1 and sit on it',elox,sofas)
assert command['target_id']=='grey-sofa',(command,ack)
no_match,_=plan_robot_command('@Elox find Grey Sofa 9 and sit',elox,sofas)
assert no_match['kind']=='vision_search' and 'grey sofa 9' in no_match['target_phrase']
# v0.2.61: all-robot and multi-handle turns are ordered and per-recipient idempotent.
from server import robot_recipient_queue
from unittest.mock import patch as _patch
assert [o['name'] for o in robot_recipient_queue('@Elox @Jessica compare notes',[robot,elox])]==['Elox','Jessica']
assert [o['name'] for o in robot_recipient_queue('@All hello',[robot,elox])]==['Jessica','Elox']
assert [o['name'] for o in robot_recipient_queue('@All hello',[robot,elox],True,robot['id'])]==[]
assert [o['name'] for o in robot_recipient_queue('@Jessica @Elox @Jessica hello',[robot,elox])]==['Jessica','Elox']
mention_source=c.post('/api/message',headers=headers,json={
    'room':'lab','text':'@Elox @Jessica tell us one useful thing each'}).get_json()['message']
queue=c.post('/api/robots/queue',headers=headers,json={'room':'lab','message_id':mention_source['id']})
assert queue.status_code==200,(queue.status_code,queue.data)
assert [r['name'] for r in queue.get_json()['targets']]==['Elox','Jessica'],queue.data
# Group chat must not be diverted into a camera request simply because one robot's
# visual memory has expired. Its autonomous perception runs separately.
assert c.post('/api/robots/react',headers=headers,json={'room':'lab','message_id':mention_source['id'],
    'text':mention_source['text'],'target_robot_id':'wrong-robot'}).status_code==403
chat_attempts[data['user']['id']]=[]
with _patch('server.active_model_key',return_value='test-key'),_patch('server.meta_request',return_value={
    'id':'group-1','output_text':'I can help organise the room.','usage':{'input_tokens':2,'output_tokens':9}}):
    one=c.post('/api/robots/react',headers=headers,json={'room':'lab','message_id':mention_source['id'],
        'text':mention_source['text'],'target_robot_id':elox['id']})
assert one.status_code==200 and one.get_json().get('answer',{}).get('speaker')=='Elox' and not one.get_json().get('needs_vision'),(one.status_code,one.data)
assert one.get_json()['inference']['request']['developer'].startswith('You are roleplaying a fictional robot'),one.data
assert one.get_json()['inference']['response']['text']=='I can help organise the room.',one.data
queue_after=c.post('/api/robots/queue',headers=headers,json={'room':'lab','message_id':mention_source['id']})
assert [r['name'] for r in queue_after.get_json()['targets']]==['Jessica'],queue_after.data
assert c.post('/api/robots/react',headers=headers,json={'room':'lab','message_id':mention_source['id'],
    'text':mention_source['text'],'target_robot_id':elox['id']}).get_json()['triggered'] is False
with _patch('server.active_model_key',return_value='test-key'),_patch('server.meta_request',return_value={
    'id':'group-2','output_text':'[PASS]','usage':{'input_tokens':2,'output_tokens':2}}):
    two=c.post('/api/robots/react',headers=headers,json={'room':'lab','message_id':mention_source['id'],
        'text':mention_source['text'],'target_robot_id':robot['id']})
assert two.status_code==200 and two.get_json()['responded'] is False,(two.status_code,two.data)
assert c.post('/api/robots/queue',headers=headers,json={
    'room':'lab','message_id':mention_source['id']}).get_json()['targets']==[]
all_source=c.post('/api/message',headers=headers,json={'room':'lab','text':'@All share your plans'}).get_json()['message']
all_queue=c.post('/api/robots/queue',headers=headers,json={'room':'lab','message_id':all_source['id']}).get_json()
assert all_queue['broadcast'] is True and {r['name'] for r in all_queue['targets']} >= {'Jessica','Elox'}
print('PASS: ordered multi-mentions, @All, per-recipient deduplication, pass-on-silence and invalid-target blocking')
# Each generated reply may relay once to a different robot; two hops maximum.
chat_attempts[data['user']['id']]=[]
source=c.post('/api/message',headers=headers,json={'room':'lab','text':'@Jessica talk to @Elox about the scene'}).get_json()['message']
from unittest.mock import patch as _patch
fake={'id':'relay-1','output_text':'@Elox, shall we review the scene?','usage':{'input_tokens':5,'output_tokens':10}}
with _patch('server.active_model_key',return_value='test-key'),_patch('server.meta_request',return_value=fake):
    initial=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':source['text'],'message_id':source['id']})
assert initial.status_code==200,(initial.status_code,initial.data)
first=initial.get_json()['answer'];assert first['speaker']=='Jessica'
chat_attempts[data['user']['id']]=[]
with _patch('server.active_model_key',return_value='test-key'),_patch('server.meta_request',return_value={'id':'relay-2','output_text':'@Jessica, yes.','usage':{'input_tokens':5,'output_tokens':5}}):
    relay=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':first['text'],'message_id':first['id']})
assert relay.status_code==200,(relay.status_code,relay.data)
second=relay.get_json()['answer'];assert second['speaker']=='Elox'
assert c.post('/api/robots/react',headers=headers,json={'room':'lab','text':first['text'],'message_id':first['id']}).get_json()['triggered'] is False
chat_attempts[data['user']['id']]=[]
with _patch('server.active_model_key',return_value='test-key'),_patch('server.meta_request',return_value={'id':'relay-3','output_text':'@Elox understood.','usage':{'input_tokens':5,'output_tokens':5}}):
    third_reply=c.post('/api/robots/react',headers=headers,json={'room':'lab','text':second['text'],'message_id':second['id']})
assert third_reply.status_code==200,(third_reply.status_code,third_reply.data)
third=third_reply.get_json()['answer']
assert c.post('/api/robots/react',headers=headers,json={'room':'lab','text':third['text'],'message_id':third['id']}).get_json()['triggered'] is False
# v0.2.68: a natural forward-distance request must return a task command,
# not merely a robot-authored sentence promising motion.
_motion_message=c.post('/api/message',headers=headers,json={
    'room':'lab','text':'@Elox go further 10 meters'}).get_json()['message']
_motion_response=c.post('/api/robots/react',headers=headers,json={
    'room':'lab','message_id':_motion_message['id'],'text':_motion_message['text'],'target_robot_id':elox['id']})
assert _motion_response.status_code==200,(_motion_response.status_code,_motion_response.data)
_motion_json=_motion_response.get_json()
assert _motion_json.get('command',{}).get('kind')=='walk_forward' and _motion_json['command']['distance']==10,_motion_json
assert _motion_json['command']['robot_id']==elox['id'] and _motion_json.get('answer',{}).get('model')=='scene-command',_motion_json
assert _motion_json['decision']['executable'] is True and _motion_json['decision']['model_plan_executes'] is False,_motion_json
print('PASS: natural language walking dispatches a real scene command without a camera or Meta model')
# v0.2.70: a substantive multi-handle discussion triggers a bounded, sourced,
# serialized research debate rather than independent one-shot robot replies.
from server import discussion_requested,discussion_topic,discussion_step_plan
_disc_text='@Elox @Jessica there is discussion on the internet that vitamin C is good for hair loss: research pros and cons, then agree or disagree'
assert discussion_requested(_disc_text,[elox,robot])
assert 'vitamin C' in discussion_topic(_disc_text,[elox,robot]) and '@' not in discussion_topic(_disc_text,[elox,robot])
assert not discussion_requested('@Elox @Jessica wave hello',[elox,robot])
assert not discussion_requested('@All everybody dance',[elox,robot])
assert [s['phase'] for s in discussion_step_plan([{'id':'a','name':'A'},{'id':'b','name':'B'}])]==['opening','opening','challenge','challenge','synthesis']
_disc_message=c.post('/api/message',headers=headers,json={'room':'lab','text':_disc_text}).get_json()['message']
_dq=c.post('/api/robots/queue',headers=headers,json={'room':'lab','message_id':_disc_message['id']})
assert _dq.status_code==200 and _dq.get_json()['discussion']['enabled'] is True,(_dq.status_code,_dq.data)
_disc_source={'id':'S1','provider':'PubMed','title':'Vitamin C and hair: literature overview','url':'https://pubmed.ncbi.nlm.nih.gov/12345678/','snippet':'Bibliographic listing'}
with _patch('server.research_topic_sources',return_value=[_disc_source]) as _sources:
    _start=c.post('/api/robots/discussion/start',headers=headers,json={'room':'lab','message_id':_disc_message['id']})
assert _start.status_code==200,(_start.status_code,_start.data)
assert _sources.call_count==1
_dsteps=_start.get_json()['steps']
assert len(_dsteps)==5 and _dsteps[0]['robot_name']=='Elox' and _dsteps[-1]['phase']=='synthesis'
assert _start.get_json()['research_status']=='live-sources'
with _patch('server.research_topic_sources',side_effect=AssertionError('Research must be cached')):
    assert c.post('/api/robots/discussion/start',headers=headers,json={'room':'lab','message_id':_disc_message['id']}).status_code==200
assert c.post('/api/robots/discussion/start',headers=headers,json={'room':'lab','message_id':'not-owned'}).status_code==403
assert c.post('/api/robots/discussion/step',headers=headers,json={'room':'lab','discussion_id':_disc_message['id'],'step_index':1}).status_code==409
for _step_index in range(5):
    chat_attempts[data['user']['id']]=[]
    fake={'id':'debate-'+str(_step_index),'output_text':('Agreement: the evidence remains uncertain. Disagreement: effectiveness is not established. Pros: plausible nutrition role. Cons: limited specific trials. Evidence gaps: controlled studies.' if _step_index==4 else 'I will compare the proposed mechanisms with the actual evidence [S1].'),'usage':{'input_tokens':23,'output_tokens':47}}
    with _patch('server.active_model_key',return_value='test-key'),_patch('server.meta_request',return_value=fake) as _model:
        _turn=c.post('/api/robots/discussion/step',headers=headers,json={'room':'lab','discussion_id':_disc_message['id'],'step_index':_step_index})
        assert _model.call_count==1,(_step_index,_turn.status_code,_turn.data)
    assert _turn.status_code==200,(_step_index,_turn.status_code,_turn.data)
    _result=_turn.get_json()
    assert _result['step']['phase']==_dsteps[_step_index]['phase']
    assert _result['answer']['speaker']==_dsteps[_step_index]['robot_name']
    assert _result['inference']['request']['developer'] and _result['inference']['request']['user']
    assert '12345678' in _result['inference']['request']['user']
assert 'Agreement' in _result['answer']['text'] and 'https://pubmed.ncbi.nlm.nih.gov/12345678/' in _result['answer']['text']
with _patch('server.meta_request',side_effect=AssertionError('Replayed turn must not reissue a billable call')):
    _again=c.post('/api/robots/discussion/step',headers=headers,json={'room':'lab','discussion_id':_disc_message['id'],'step_index':0})
assert _again.status_code==200 and _again.get_json()['replayed'] is True
assert c.post('/api/robots/discussion/step',headers=headers,json={'room':'lab','discussion_id':_disc_message['id'],'step_index':5}).status_code==400
print('PASS: sourced multi-robot discussion, exact prompts, debate phases, synthesis, sequential ordering, persistent deduplication')


assert c.post('/api/scene/object',headers=headers,json={'room':'lab','action':'remove','object':{'id':'testrobot-elox-060'}}).status_code==200
print('PASS: attachments, exact furniture matching, verified 2-hop robot-robot @handles and deduplication')
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

# Admin transcript endpoints export all messages, not only the 80-row chat view,
# and clear only the exact selected realm after administrator unlock.
from server import sha as _admin_sha
with db() as con:
    con.execute('INSERT OR REPLACE INTO admin_sessions(token_hash,expires) VALUES(?,?)',(_admin_sha('chat-admin-test-token'),float('4102444800')))
chat_admin={**headers,'X-Solvi-Admin':'chat-admin-test-token'}
assert c.get('/api/admin/room-chat/export?room=main',headers=headers).status_code==403
assert c.post('/api/admin/room-chat/clear',headers=headers,json={'room':'main','exact_name':'Main realm','confirm':True}).status_code==403
before_export=c.get('/api/admin/room-chat/export?room=main',headers=chat_admin)
assert before_export.status_code==200,(before_export.status_code,before_export.data)
assert before_export.get_json()['format']=='solvi-room-transcript-v1'
main_before=len(before_export.get_json()['messages'])
lab_before=c.get('/api/admin/room-chat/export?room=lab',headers=chat_admin).get_json()['count']
assert c.post('/api/admin/room-chat/clear',headers=chat_admin,json={'room':'main','confirm':True,'exact_name':'incorrect'}).status_code==400
assert c.post('/api/admin/room-chat/clear',headers=chat_admin,json={'room':'main','confirm':False,'exact_name':'Main realm'}).status_code==400
cleared=c.post('/api/admin/room-chat/clear',headers=chat_admin,json={'room':'main','confirm':True,'exact_name':'Main realm'})
assert cleared.status_code==200,(cleared.status_code,cleared.data)
assert cleared.get_json()['deleted']==main_before
assert c.get('/api/messages?room=main',headers=headers).get_json()['messages']==[]
assert c.get('/api/admin/room-chat/export?room=lab',headers=chat_admin).get_json()['count']==lab_before
print('PASS: admin transcript exports complete room chat, exact-name flush, unrelated rooms unaffected')

# Logging out revokes the token server-side; the same browser tab cannot use it again.
assert c.post('/api/logout',headers=headers,json={}).status_code==200
assert c.get('/api/me',headers=headers).status_code==401
print('PASS: logout invalidates browser session token')

# v0.2.42 language fallback must recognize Polish text even when an older
# robot profile was saved with an English default.
from server import _spoken_language
assert _spoken_language('Paris, masz bardzo dziwny głos','en')=='pl'
assert _spoken_language('I can see a chair','auto')=='en'
print('PASS: Polish speech text takes precedence over stale English voice settings')

# v0.2.68: natural physical imperatives are parsed into real robot commands.
from server import plan_robot_command as _plan_motion
_b={'id':'bot', 'name':'Elox','position':[0,0,0]}
for _words,_dist in [('@Elox go further 10 meters',10),('@Elox continue another 5 m',5),('@Elox move ahead 2m',2),('@Elox keep going 3m',3)]:
    _cmd,_ack=_plan_motion(_words,_b,[])
    assert _cmd and _cmd['kind']=='walk_forward' and _cmd['distance']==_dist,(_words,_cmd,_ack)
_furniture=[{'id':'red-sphere', 'kind':'sphere','name':'Red Sphere','position':[2,0,3]},
            {'id':'blue-sphere','kind':'sphere','name':'Blue Sphere','position':[-2,0,3]}]
_typo,_ack=_plan_motion('@Elox go to the Red Pshere now',_b,_furniture)
assert _typo and _typo['kind']=='go_to' and _typo['target_id']=='red-sphere',(_typo,_ack)
print('PASS: natural move-forward commands, safe typo target resolution, and physical task dispatch')

