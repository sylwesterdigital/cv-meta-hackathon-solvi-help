"""Portable, bounded realm exports. Never extract archive paths to disk."""
import io,json,re,tarfile,uuid,math
from pathlib import Path

MAX_ARCHIVE_BYTES=94*1024*1024
MAX_ENTRY_BYTES=20*1024*1024
MAX_TOTAL_BYTES=87*1024*1024
KINDS={'cube','sphere','cylinder','plane','torus','curve','surface','text','points','light','robot','model','media'}

def scene_placeholders(objects):
    output=[]
    for obj in objects:
        if not isinstance(obj,dict):continue
        item=dict(obj)
        if item.get('kind') in ('model','media'):
            item.pop('media',None);item.pop('model',None)
            item['kind']='cube';item['primitive']={'width':1,'height':1,'depth':0.1}
            item['name']='Placeholder · '+str(item.get('name','Imported asset'))[:70]
        output.append(item)
    return output

def asset_manifest(objects,con):
    media_ids=set();model_urls=set();avatar_urls=set()
    for obj in objects:
        if not isinstance(obj,dict):continue
        if obj.get('kind')=='media':media_ids.add(str((obj.get('media') or {}).get('id','')))
        if obj.get('kind')=='robot':
            media_ids.add(str((obj.get('brain') or {}).get('portrait','')))
            avatar_urls.add(str(obj.get('avatar','')))
        if obj.get('kind')=='model':model_urls.add(str(obj.get('model','')))
        if obj.get('kind')=='media':model_urls.add(str((obj.get('media') or {}).get('model','')))
    media=[];models=[];avatars=[]
    for mid in media_ids:
        if not re.fullmatch(r'[0-9a-f-]{36}',mid):continue
        row=con.execute('SELECT * FROM media WHERE id=?',(mid,)).fetchone()
        if row and Path(row['path']).is_file():media.append(dict(row))
    for url in model_urls:
        match=re.fullmatch(r'/api/scene/models/([0-9a-f]{32})\.(glb|fbx)',url)
        if not match:continue
        row=con.execute('SELECT * FROM scene_models WHERE id=?',(match[1],)).fetchone()
        if row and Path(row['filename']).is_file():models.append(dict(row))
    for url in avatar_urls:
        match=re.fullmatch(r'/api/avatars/([0-9a-f]{32})\.glb',url)
        if not match:continue
        row=con.execute('SELECT * FROM avatar_library WHERE id=?',(match[1],)).fetchone()
        if row and Path(row['filename']).is_file():avatars.append(dict(row))
    return media,models,avatars

def archive_bytes(meta,media,models,avatars):
    stream=io.BytesIO()
    with tarfile.open(fileobj=stream,mode='w:gz') as archive:
        def add(name,data):
            info=tarfile.TarInfo(name);info.size=len(data);info.mode=0o600
            archive.addfile(info,io.BytesIO(data))
        add('realm.json',json.dumps(meta,ensure_ascii=False).encode())
        size=0
        for row in media:
            content=Path(row['path']).read_bytes();size+=len(content)
            if size>MAX_TOTAL_BYTES:raise ValueError('Realm assets exceed 87 MB limit')
            add('media/'+row['id'],content)
        for row in [*models,*avatars]:
            content=Path(row['filename']).read_bytes();size+=len(content)
            if size>MAX_TOTAL_BYTES:raise ValueError('Realm assets exceed 87 MB limit')
            add(('models/' if 'extension' in row else 'avatars/')+row['id'],content)
    data=stream.getvalue()
    if len(data)>MAX_ARCHIVE_BYTES:raise ValueError('Realm archive exceeds 94 MB limit')
    return data

def read_archive(upload):
    if upload.content_length and upload.content_length>MAX_ARCHIVE_BYTES:raise ValueError('Archive too large')
    content=upload.stream.read(MAX_ARCHIVE_BYTES+1)
    if len(content)>MAX_ARCHIVE_BYTES:raise ValueError('Archive too large')
    if content.lstrip().startswith(b'{'):
        meta=json.loads(content);return meta,{},{},{}
    media={};models={};avatars={};total=0
    with tarfile.open(fileobj=io.BytesIO(content),mode='r:gz') as archive:
        members=archive.getmembers()
        if len(members)>260:raise ValueError('Too many archive members')
        info=None
        for member in members:
            if not member.isfile() or member.size>MAX_ENTRY_BYTES or member.name.startswith('/') or '..' in member.name.split('/'):
                raise ValueError('Invalid archive member')
            total+=member.size
            if total>MAX_TOTAL_BYTES:raise ValueError('Unpacked archive too large')
            if member.name=='realm.json':info=archive.extractfile(member).read()
            elif re.fullmatch(r'media/[0-9a-f-]{36}',member.name):media[member.name[6:]]=archive.extractfile(member).read()
            elif re.fullmatch(r'models/[0-9a-f]{32}',member.name):models[member.name[7:]]=archive.extractfile(member).read()
            elif re.fullmatch(r'avatars/[0-9a-f]{32}',member.name):avatars[member.name[8:]]=archive.extractfile(member).read()
            else:raise ValueError('Unknown archive entry')
        if not info:raise ValueError('Missing realm.json')
        meta=json.loads(info)
    return meta,media,models,avatars

def safe_scene(objects):
    if not isinstance(objects,list) or len(objects)>128:raise ValueError('Invalid object list')
    if len(json.dumps(objects,ensure_ascii=False))>1_200_000:raise ValueError('Scene metadata exceeds 1.2 MB')
    allowed={'id','kind','name','position','rotation','scale','color','texture','avatar','light','speed','strafeSpeed','turnSpeed','brain','physics','model','media','primitive','transformLocked'}
    clean=[]
    for obj in objects:
        if not isinstance(obj,dict) or obj.get('kind') not in KINDS:continue
        if any(not isinstance(obj.get(field),list) or len(obj[field])!=3 or any(not isinstance(v,(int,float)) or isinstance(v,bool) or not math.isfinite(v) or abs(v)>5000 for v in obj[field]) for field in ('position','rotation','scale')):continue
        copy={k:v for k,v in obj.items() if k in allowed}
        if len(json.dumps(copy,ensure_ascii=False))>12000:continue
        copy['id']=str(uuid.uuid4());copy['name']=str(copy.get('name','Object'))[:100]
        clean.append(copy)
    return clean
