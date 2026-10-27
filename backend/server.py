"""SOLVI.help API: SQLite profiles, chat, media, Meta Model API and authenticated WebSocket presence.
Run behind TLS reverse proxy. No default admin credentials. No API key in browser.
"""
import math
import base64
import datetime as dt
import hashlib
import hmac
import json
import os
import re
import secrets
import shutil
import sqlite3
import subprocess
import threading
import time
import uuid
from pathlib import Path
from contextlib import contextmanager
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from flask import Flask, request, jsonify, send_from_directory, abort
from flask_sock import Sock

ROOT = Path(os.environ.get('SOLVI_STATIC_ROOT', Path(__file__).resolve().parent.parent)).resolve()
STATE = Path(os.environ.get('SOLVI_DATA_DIR', '/var/lib/solvi-help')).resolve()
STATE.mkdir(mode=0o700, parents=True, exist_ok=True)
(STATE/'media').mkdir(mode=0o700, exist_ok=True)
DB = STATE/'solvi.sqlite3'
API = 'https://api.meta.ai/v1'
MODEL_KEY = os.environ.get('MODEL_API_KEY', '')
ADMIN_HASH = os.environ.get('SOLVI_ADMIN_PASSWORD_HASH', '')
ALLOWED_ORIGINS = set(os.environ.get('SOLVI_ALLOWED_ORIGINS', 'https://solvi.help,http://localhost:8000,http://127.0.0.1:8000,http://127.0.0.1:8765').split(','))
app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 12 * 1024 * 1024
app.config['SOCK_SERVER_OPTIONS'] = {'ping_interval': 25, 'max_message_size': 32768}
sock = Sock(app)
room = {}
room_lock = threading.RLock()
model_cache = (0, [])
admin_attempts = {}
chat_attempts = {}


@contextmanager
def db():
    con = sqlite3.connect(DB, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute('PRAGMA journal_mode=WAL')
    con.execute('PRAGMA foreign_keys=ON')
    try:
        yield con
        con.commit()
    except BaseException:
        con.rollback()
        raise
    finally:
        con.close()


def init_db():
    with db() as con:
        con.executescript('''
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL DEFAULT '', bio TEXT NOT NULL DEFAULT '', links TEXT NOT NULL DEFAULT '', avatar TEXT NOT NULL DEFAULT '', recovery_hash TEXT NOT NULL, token_hash TEXT NOT NULL, tab_id TEXT NOT NULL, tab_until REAL NOT NULL, created TEXT NOT NULL, updated TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL, model TEXT NOT NULL DEFAULT '', text TEXT NOT NULL DEFAULT '', media TEXT NOT NULL DEFAULT '[]', created TEXT NOT NULL, latency_ms INTEGER NOT NULL DEFAULT 0);
        CREATE INDEX IF NOT EXISTS messages_created ON messages(created);
        CREATE TABLE IF NOT EXISTS media (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, mime TEXT NOT NULL, path TEXT NOT NULL, size INTEGER NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, expires REAL NOT NULL);
        CREATE TABLE IF NOT EXISTS scene (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload TEXT NOT NULL);
        INSERT OR IGNORE INTO scene VALUES(1,0,'[]');
        CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, title TEXT NOT NULL, created TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS room_scenes (room_id TEXT PRIMARY KEY, revision INTEGER NOT NULL DEFAULT 0, payload TEXT NOT NULL DEFAULT '[]');
        INSERT OR IGNORE INTO rooms VALUES('main','Main realm','2026-10-27T00:00:00Z');
        INSERT OR IGNORE INTO room_scenes VALUES('main',0,'[]');
        ''')
        cols={r[1] for r in con.execute('PRAGMA table_info(messages)').fetchall()}
        if 'room_id' not in cols:con.execute("ALTER TABLE messages ADD COLUMN room_id TEXT NOT NULL DEFAULT 'main'")
        con.execute('CREATE INDEX IF NOT EXISTS messages_room_created ON messages(room_id,created)')
init_db()


def now(): return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')
def sha(v): return hashlib.sha256(v.encode()).hexdigest()
def new_token(): return secrets.token_urlsafe(32)
def json_error(message, code=400): return jsonify(error=message), code

def fields(obj):
    name=str(obj.get('name','')).strip()[:80]
    if not name: raise ValueError('Name is required')
    return name, str(obj.get('email','')).strip()[:180], str(obj.get('bio','')).strip()[:500], str(obj.get('links','')).strip()[:600]

def public_user(row):
    return {k:row[k] for k in ('id','name','email','bio','links','avatar','created')}

def actor():
    token=request.headers.get('Authorization','').removeprefix('Bearer ').strip()
    tab=request.headers.get('X-Solvi-Tab','').strip()
    if not token or not re.fullmatch(r'[A-Za-z0-9_-]{8,90}',tab):return None, 'Login required', 401
    with db() as con:
        row=con.execute('SELECT * FROM users WHERE token_hash=?',(sha(token),)).fetchone()
        if not row:return None,'Session expired: sign in or import your profile',401
        if row['tab_id']!=tab:return None,'This profile is active in a different window. Import/take over to switch.',409
        con.execute('UPDATE users SET tab_until=? WHERE id=?',(time.time()+65,row['id']))
        return public_user(row),None,200

def need_user():
    user,msg,status=actor()
    return user if user else (json_error(msg,status))

@app.after_request
def secure_headers(resp):
    resp.headers['X-Content-Type-Options']='nosniff'
    resp.headers['Referrer-Policy']='same-origin'
    resp.headers['Cache-Control']='no-store' if request.path.startswith('/api/') else 'no-cache'
    return resp

@app.before_request
def origin_protection():
    if request.path.startswith('/api/') and request.method not in ('GET','HEAD','OPTIONS'):
        origin=request.headers.get('Origin')
        if origin and origin not in ALLOWED_ORIGINS:return json_error('Origin denied',403)

@app.get('/api/health')
def health():
    return jsonify(ok=True,service='solvi-help-api',version='0.2.5',ai=bool(MODEL_KEY),backend=True,websocket=True)

@app.post('/api/onboard')
def onboard():
    obj=request.get_json(silent=True) or {}
    try:name,email,bio,links=fields(obj)
    except ValueError as err:return json_error(str(err))
    tab=str(obj.get('tab',''))
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,90}',tab):return json_error('Invalid tab identifier')
    uid=str(obj.get('id',''))
    recovery=str(obj.get('recovery',''))
    auth=new_token()
    recovery_new=None
    stamp=now()
    with db() as con:
        if uid:
            row=con.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
            if not row or not hmac.compare_digest(row['recovery_hash'],sha(recovery)):
                return json_error('Invalid profile recovery key',403)
            con.execute('UPDATE users SET name=?,email=?,bio=?,links=?,token_hash=?,tab_id=?,tab_until=?,updated=? WHERE id=?',
                        (name,email,bio,links,sha(auth),tab,time.time()+65,stamp,uid))
        else:
            uid=str(uuid.uuid4());recovery_new=new_token()
            con.execute('INSERT INTO users (id,name,email,bio,links,recovery_hash,token_hash,tab_id,tab_until,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
                        (uid,name,email,bio,links,sha(recovery_new),sha(auth),tab,time.time()+65,stamp,stamp))
        row=con.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
    return jsonify(user=public_user(row),token=auth,recovery=recovery_new)

@app.get('/api/me')
def me():
    user,msg,status=actor()
    return jsonify(user=user) if user else json_error(msg,status)

@app.put('/api/profile')
def profile():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    obj=request.get_json(silent=True) or {}
    try:name,email,bio,links=fields(obj)
    except ValueError as err:return json_error(str(err))
    avatar=obj.get('avatar','')
    with db() as con:
        if avatar:
            m=con.execute('SELECT id,mime FROM media WHERE id=? AND user_id=?',(avatar,user['id'])).fetchone()
            if not m or not m['mime'].startswith('image/'):return json_error('Choose an uploaded image as avatar')
        else:avatar=user['avatar']
        con.execute('UPDATE users SET name=?,email=?,bio=?,links=?,avatar=?,updated=? WHERE id=?', (name,email,bio,links,avatar,now(),user['id']))
        row=con.execute('SELECT * FROM users WHERE id=?',(user['id'],)).fetchone()
    return jsonify(user=public_user(row))

ROOM_RE=re.compile(r'^[a-z0-9][a-z0-9_-]{0,39}$')
def selected_room(value):
    name=str(value or 'main').lower()
    if not ROOM_RE.fullmatch(name):return None
    with db() as con:exists=con.execute('SELECT 1 FROM rooms WHERE id=?',(name,)).fetchone()
    return name if exists else None

@app.get('/api/rooms')
def list_rooms():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    with db() as con:rows=con.execute('SELECT id,title,created FROM rooms ORDER BY created,id LIMIT 100').fetchall()
    return jsonify(rooms=[dict(r) for r in rows])

@app.post('/api/rooms')
def create_room():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    data=request.get_json(silent=True) or {}
    rid=str(data.get('id','')).lower().strip();title=str(data.get('title','')).strip()[:80]
    if not ROOM_RE.fullmatch(rid) or not title:return json_error('Room needs a slug (letters, numbers, dash) and a title')
    with db() as con:
        if con.execute('SELECT COUNT(*) AS n FROM rooms').fetchone()['n']>=100:return json_error('Room capacity reached',409)
        if con.execute('SELECT 1 FROM rooms WHERE id=?',(rid,)).fetchone():return json_error('Room already exists',409)
        con.execute('INSERT INTO rooms VALUES(?,?,?)',(rid,title,now()))
        con.execute('INSERT INTO room_scenes(room_id) VALUES(?)',(rid,))
    return jsonify(room={'id':rid,'title':title})

@app.get('/api/messages')
def messages():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    room_id=selected_room(request.args.get('room','main'))
    if not room_id:return json_error('Unknown room',404)
    with db() as con:
        rows=con.execute('SELECT messages.*,users.name AS speaker,users.avatar AS avatar FROM messages JOIN users ON users.id=messages.user_id WHERE messages.room_id=? ORDER BY messages.created DESC LIMIT 80',(room_id,)).fetchall()
    return jsonify(messages=[dict(r) for r in reversed(rows)])

MEDIA_TYPES={'image/png':'.png','image/jpeg':'.jpg','image/webp':'.webp','image/gif':'.gif',
             'audio/webm':'.webm','audio/ogg':'.ogg','audio/wav':'.wav','audio/mpeg':'.mp3','audio/mp4':'.m4a',
             'video/webm':'.webm','video/mp4':'.mp4','video/quicktime':'.mov'}

@app.post('/api/media')
def upload():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    f=request.files.get('file')
    if not f:return json_error('Missing file')
    mime=f.mimetype.split(';')[0].lower()
    if mime not in MEDIA_TYPES:return json_error('Unsupported media format')
    mid=str(uuid.uuid4());name=Path(f.filename or 'upload').name[:120]
    disk=STATE/'media'/f'{mid}{MEDIA_TYPES[mime]}'
    f.save(disk)
    if disk.stat().st_size>12*1024*1024:disk.unlink();return json_error('File too large',413)
    # Minimal magic validation for common image formats.
    sig=disk.read_bytes()[:16]
    ok={'image/png':sig.startswith(b'\x89PNG'),'image/jpeg':sig.startswith(b'\xff\xd8'),'image/gif':sig.startswith((b'GIF87a',b'GIF89a'))}
    if mime in ok and not ok[mime]:disk.unlink();return json_error('Invalid file signature')
    with db() as con:
        used=con.execute('SELECT COALESCE(SUM(size),0) AS n FROM media WHERE user_id=?',(user['id'],)).fetchone()['n']
        if used+disk.stat().st_size>75*1024*1024:
            disk.unlink(missing_ok=True)
            return json_error('User media quota exceeded (75 MB)',413)
        con.execute('INSERT INTO media VALUES(?,?,?,?,?,?,?)',(mid,user['id'],name,mime,str(disk),disk.stat().st_size,now()))
    return jsonify(media={'id':mid,'mime':mime,'name':name,'url':f'/api/media/{mid}'})

@app.get('/api/media/<mid>')
def get_media(mid):
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    with db() as con:m=con.execute('SELECT * FROM media WHERE id=?',(mid,)).fetchone()
    if not m:return json_error('Media missing',404)
    return send_from_directory(STATE/'media',Path(m['path']).name,mimetype=m['mime'],as_attachment=False)

@app.post('/api/profile/intro')
def intro():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    m_id=(request.get_json(silent=True) or {}).get('id','')
    with db() as con:m=con.execute('SELECT * FROM media WHERE id=? AND user_id=?',(m_id,user['id'])).fetchone()
    if not m or not m['mime'].startswith('video/'):return json_error('Upload a video first')
    if not (shutil.which('ffmpeg') and shutil.which('ffprobe')):return json_error('FFmpeg/FFprobe missing on backend',503)
    src=m['path'];probe=subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',src],capture_output=True,text=True,timeout=12)
    try:duration=float(probe.stdout.strip())
    except ValueError:return json_error('Unable to read video duration')
    if not (0<duration<=15.5):return json_error('Intro must be no longer than 15 seconds')
    out=STATE/'media'/f'{uuid.uuid4()}.gif'
    # 12 fps, 1.5s; avoid spawning arbitrary shell commands.
    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-i',src,'-t','1.5','-vf','fps=12,scale=240:-1:flags=lanczos','-an',str(out)],check=True,timeout=30)
    gif_id=out.stem
    with db() as con:con.execute('INSERT INTO media VALUES(?,?,?,?,?,?,?)',(gif_id,user['id'],'intro.gif','image/gif',str(out),out.stat().st_size,now()))
    return jsonify(media={'id':gif_id,'url':f'/api/media/{gif_id}','mime':'image/gif'})

def meta_request(method,path,body=None):
    if not MODEL_KEY:raise RuntimeError('MODEL_API_KEY is not configured on the backend')
    payload=json.dumps(body).encode() if body is not None else None
    req=Request(API+path,data=payload,headers={'Authorization':'Bearer '+MODEL_KEY,'Content-Type':'application/json'},method=method)
    try:
        with urlopen(req,timeout=65) as resp:return json.load(resp)
    except HTTPError as e:
        detail=e.read(800).decode('utf8','replace')
        raise RuntimeError(f'Meta API HTTP {e.code}: {detail[:320]}') from e

def get_models():
    global model_cache
    if time.time()-model_cache[0]<300:return model_cache[1]
    results=meta_request('GET','/models')
    models=[m['id'] for m in results.get('data',[]) if isinstance(m.get('id'),str)]
    model_cache=(time.time(),models)
    return models

@app.get('/api/models')
def models():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    if not MODEL_KEY:return jsonify(models=[],enabled=False,note='Configure MODEL_API_KEY to enable Meta inference')
    try:return jsonify(models=get_models(),enabled=True)
    except (RuntimeError,URLError,TimeoutError) as exc:return json_error(str(exc),502)

@app.post('/api/message')
def human_message():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    data=request.get_json(silent=True) or {}
    text=str(data.get('text','')).strip()[:3000]
    room_id=selected_room(data.get('room','main'))
    if not room_id:return json_error('Unknown room',404)
    ids=data.get('media',[])
    if not isinstance(ids,list) or len(ids)>3:return json_error('Maximum three attachments')
    if not text and not ids:return json_error('Empty message')
    with db() as con:
        for mid in ids:
            if not isinstance(mid,str) or not con.execute('SELECT 1 FROM media WHERE id=? AND user_id=?',(mid,user['id'])).fetchone():
                return json_error('Invalid attachment')
        message_id=str(uuid.uuid4());ts=now()
        con.execute('INSERT INTO messages(id,user_id,role,model,text,media,created,room_id) VALUES(?,?,?,?,?,?,?,?)',
                    (message_id,user['id'],'user','',text,json.dumps(ids),ts,room_id))
    publish({'type':'chat-created','id':message_id,'room':room_id},room_id=room_id)
    return jsonify(message={'id':message_id,'user_id':user['id'],'role':'user','speaker':user['name'],'avatar':user['avatar'],
                            'text':text,'media':json.dumps(ids),'created':ts})

@app.post('/api/chat')
def chat():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    data=request.get_json(silent=True) or {}
    text=str(data.get('text','')).strip()[:3000]
    room_id=selected_room(data.get('room','main'))
    if not room_id:return json_error('Unknown room',404)
    model=str(data.get('model','muse-spark-1.3'))
    media_ids=data.get('media',[])
    if not isinstance(media_ids,list) or len(media_ids)>3:return json_error('Maximum three attachments')
    if not text and not media_ids:return json_error('Empty message')
    if not MODEL_KEY:return json_error('Meta API backend key is not configured',503)
    # Per-user guardrail for unexpectedly expensive model calls (five attempts/minute).
    attempts=[v for v in chat_attempts.get(user['id'],[]) if time.time()-v<60]
    if len(attempts)>=5:return json_error('Rate limit: five AI requests per minute',429)
    attempts.append(time.time());chat_attempts[user['id']]=attempts
    try: catalog=get_models()
    except Exception as exc:return json_error(str(exc),502)
    if model not in catalog:return json_error('Model is not available for this API account',400)
    attachments=[]
    with db() as con:
        for mid in media_ids:
            m=con.execute('SELECT * FROM media WHERE id=? AND user_id=?',(mid,user['id'])).fetchone()
            if not m:return json_error('Invalid attachment')
            attachments.append(dict(m))
    if model.startswith('sam-') and not any(m['mime'].startswith('image/') for m in attachments):return json_error('SAM needs an image attachment')
    if model.startswith('sam-') and not text:return json_error('SAM needs a short noun phrase')
    if model.startswith('muse-voice'):
        return json_error('Voice model requires a specialised input adapter; use a Muse Spark model for chat',422)
    items=[{'type':'input_text','text':text or 'Describe this image.'}]
    skipped=[]
    for m in attachments:
        if m['mime'].startswith('image/'):
            if m['size']>4_000_000:return json_error('Image attachment exceeds 4 MB API inline limit for this prototype')
            image='data:'+m['mime']+';base64,'+base64.b64encode(Path(m['path']).read_bytes()).decode()
            items.append({'type':'input_image','image_url':image})
        else:skipped.append(m['name'])
    if skipped:return json_error('Audio/video attachments can be stored, but sending them to this model is not implemented yet',422)
    uid=user['id'];ts=now();first_id=str(uuid.uuid4())
    with db() as con:con.execute('INSERT INTO messages(id,user_id,role,model,text,media,created,room_id) VALUES(?,?,?,?,?,?,?,?)',(first_id,uid,'user','',text,json.dumps(media_ids),ts,room_id))
    started=time.monotonic()
    try:
        answer=meta_request('POST','/responses',{'model':model,'input':[{'role':'user','content':items}],'store':False})
        output=answer.get('output_text') or '\n'.join(c.get('text','') for o in answer.get('output',[]) if o.get('type')=='message' for c in o.get('content',[]) if c.get('type')=='output_text')
        if not output:output='Response returned no displayable text. Check model output type.'
        output=output[:16000]
    except Exception as exc:
        return jsonify(error=str(exc),message_id=first_id),502
    elapsed=round((time.monotonic()-started)*1000);aid=str(uuid.uuid4())
    with db() as con:con.execute('INSERT INTO messages(id,user_id,role,model,text,media,created,latency_ms,room_id) VALUES(?,?,?,?,?,?,?,?,?)',(aid,uid,'assistant',model,output,'[]',now(),elapsed,room_id))
    publish({'type':'chat-created','id':aid,'room':room_id},room_id=room_id)
    return jsonify(message={'id':first_id,'user_id':user['id'],'role':'user','speaker':user['name'],'text':text,'media':json.dumps(media_ids),'created':ts,'avatar':user['avatar']},
                   answer={'id':aid,'role':'assistant','model':model,'speaker':model,'text':output,'media':'[]','created':now(),'avatar':''},latency_ms=elapsed)

@app.get('/api/scene')
def get_scene():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    room_id=selected_room(request.args.get('room','main'))
    if not room_id:return json_error('Unknown room',404)
    with db() as con:row=con.execute('SELECT revision,payload FROM room_scenes WHERE room_id=?',(room_id,)).fetchone()
    return jsonify(revision=row['revision'],objects=json.loads(row['payload']))

@app.put('/api/scene')
def set_scene():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    data=request.get_json(silent=True) or {}
    room_id=selected_room(data.get('room','main'))
    if not room_id:return json_error('Unknown room',404)
    objects=data.get('objects',[]);revision=data.get('revision')
    if not isinstance(objects,list) or len(objects)>128 or not isinstance(revision,int):return json_error('Invalid scene')
    allowed={'cube','sphere','cylinder','plane','torus','curve','surface','text','points','light','robot'}
    for o in objects:
        if not isinstance(o,dict) or o.get('kind') not in allowed:return json_error('Unsupported scene object')
        if not all(isinstance(o.get(n),list) and len(o[n])==3 and all(isinstance(x,(int,float)) and abs(x)<1000 for x in o[n]) for n in ('position','rotation','scale')):return json_error('Invalid transform')
    with db() as con:
        old=con.execute('SELECT revision FROM room_scenes WHERE room_id=?',(room_id,)).fetchone()['revision']
        if old!=revision:return jsonify(error='Scene changed on another client; reload before saving',revision=old),409
        con.execute('UPDATE room_scenes SET revision=?,payload=? WHERE room_id=?',(old+1,json.dumps(objects,separators=(',',':')),room_id))
    publish({'type':'scene-changed','revision':old+1,'room':room_id},room_id=room_id)
    return jsonify(revision=old+1,ok=True)


@app.post('/api/scene/object')
def patch_scene_object():
    """Atomic per-object update: preserves objects edited by other participants."""
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    data=request.get_json(silent=True) or {}
    room_id=selected_room(data.get('room','main'))
    if not room_id:return json_error('Unknown room',404)
    action=data.get('action')
    obj=data.get('object') or {}
    obj_id=str(obj.get('id',''))
    if not re.fullmatch(r'[A-Za-z0-9_-]{8,80}',obj_id):return json_error('Invalid object id')
    if action not in ('upsert','remove'):return json_error('Invalid object action')
    if action=='upsert':
        if obj.get('kind') not in {'cube','sphere','cylinder','plane','torus','curve','surface','text','points','light','robot'}:return json_error('Unsupported object type')
        if not all(isinstance(obj.get(n),list) and len(obj[n])==3 and all(isinstance(x,(int,float)) and math.isfinite(x) and abs(x)<1000 for x in obj[n]) for n in ('position','rotation','scale')):return json_error('Invalid transform')
        obj={key:obj[key] for key in ('id','kind','name','position','rotation','scale','color','texture') if key in obj}
        if len(str(obj.get('name','')))>100:return json_error('Object name too long')
        if obj.get('texture','none') not in ('none','checker','gradient','stripes','dots','custom'):return json_error('Unsupported texture preset')
        if not isinstance(obj.get('color'),(str,type(None))) or len(obj.get('color') or '')>24:return json_error('Invalid color')
    with db() as con:
        con.execute('BEGIN IMMEDIATE')
        row=con.execute('SELECT revision,payload FROM room_scenes WHERE room_id=?',(room_id,)).fetchone()
        items=json.loads(row['payload'])
        if action=='remove':items=[item for item in items if item.get('id')!=obj_id]
        else:
            for i,item in enumerate(items):
                if item.get('id')==obj_id:items[i]=obj;break
            else:
                if len(items)>=128:return json_error('Room object limit reached',409)
                items.append(obj)
        revision=row['revision']+1
        con.execute('UPDATE room_scenes SET revision=?,payload=? WHERE room_id=?',(revision,json.dumps(items,separators=(',',':')),room_id))
    publish({'type':'scene-changed','revision':revision,'room':room_id,'by':user['id']},room_id=room_id)
    return jsonify(ok=True,revision=revision)

def verify_admin(passwd):
    try:
        algo,salt_hex,hash_hex=ADMIN_HASH.split(':')
        if algo!='pbkdf2_sha256':return False
        dk=hashlib.pbkdf2_hmac('sha256',passwd.encode(),bytes.fromhex(salt_hex),260000)
        return hmac.compare_digest(dk.hex(),hash_hex)
    except (ValueError,TypeError):return False

@app.post('/api/admin/login')
def admin_login():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    ip=request.remote_addr or 'unknown';attempts=[v for v in admin_attempts.get(ip,[]) if time.time()-v<600]
    if len(attempts)>=5:return json_error('Too many admin attempts; retry later',429)
    passwd=str((request.get_json(silent=True) or {}).get('password',''))
    if not ADMIN_HASH or not verify_admin(passwd):
        attempts.append(time.time());admin_attempts[ip]=attempts
        return json_error('Wrong admin credentials',403)
    token=new_token()
    with db() as con:con.execute('INSERT INTO admin_sessions VALUES (?,?)',(sha(token),time.time()+1800))
    return jsonify(token=token,expires_in=1800)

@app.get('/api/admin/stats')
def admin_stats():
    user,msg,status=actor()
    if not user:return json_error(msg,status)
    token=request.headers.get('X-Solvi-Admin','')
    with db() as con:
        admin=con.execute('SELECT expires FROM admin_sessions WHERE token_hash=?',(sha(token),)).fetchone()
        if not admin or admin['expires']<time.time():return json_error('Admin authentication required',403)
        users=con.execute('SELECT COUNT(*) AS n FROM users').fetchone()['n']
        messages=con.execute('SELECT COUNT(*) AS n FROM messages').fetchone()['n']
        bytes_used=con.execute('SELECT COALESCE(SUM(size),0) AS n FROM media').fetchone()['n']
        latency=con.execute("SELECT COALESCE(AVG(latency_ms),0) AS n FROM messages WHERE role='assistant'").fetchone()['n']
        active=con.execute('SELECT COUNT(*) AS n FROM users WHERE tab_until>?',(time.time(),)).fetchone()['n']
    with room_lock:connections=len(room)
    return jsonify(users=users,active_sessions=active,connections=connections,messages=messages,media_bytes=bytes_used,avg_inference_ms=round(latency),db_bytes=DB.stat().st_size,api_enabled=bool(MODEL_KEY))

def publish(message,except_id=None,room_id=None):
    data=json.dumps(message)
    with room_lock:peers=list(room.items())
    for uid,item in peers:
        if uid==except_id or (room_id is not None and item['room']!=room_id):continue
        try:item['ws'].send(data)
        except (ConnectionError,OSError):pass

@sock.route('/ws')
def websocket(ws):
    if request.headers.get('Origin') not in ALLOWED_ORIGINS:ws.close();return
    uid=None;room_id=None
    try:
        first=json.loads(ws.receive() or '{}')
        if first.get('type')!='join':return
        tab=str(first.get('tab',''));token=str(first.get('token',''))
        room_id=selected_room(first.get('room','main'))
        if not room_id:return
        with db() as con:
            user=con.execute('SELECT id,name,avatar,tab_id FROM users WHERE token_hash=?',(sha(token),)).fetchone()
        if not user or user['tab_id']!=tab:
            ws.send(json.dumps({'type':'auth-required','reason':'Session expired or this profile is active in another window.'}))
            return
        uid=user['id'];name=user['name']
        with room_lock:
            if uid in room or len(room)>100:return
            peers=[{'id':key,'name':val['name'],'state':val['state']} for key,val in room.items() if val['room']==room_id]
            room[uid]={'ws':ws,'room':room_id,'name':name,'state':{}}
            ws.send(json.dumps({'type':'snapshot','room':room_id,'peers':peers}))
        publish({'type':'presence','event':'joined','id':uid,'name':name,'state':{}},uid,room_id)
        last=0
        while True:
            raw=ws.receive()
            if raw is None:break
            if len(raw)>32768:break
            msg=json.loads(raw)
            if msg.get('type')=='state' and time.monotonic()-last>.10:
                last=time.monotonic();pose=msg.get('state',{})
                if not isinstance(pose,dict):continue
                try:filtered={k:float(pose.get(k,0)) for k in ('x','y','z','yaw')}
                except (ValueError,TypeError):continue
                if any(not (-1000<v<1000) for v in filtered.values()):continue
                expressions=pose.get('face',{})
                if isinstance(expressions,dict):
                    filtered['face']={str(k)[:40]:max(0.,min(1.,float(v))) for k,v in list(expressions.items())[:52] if isinstance(v,(float,int))}
                else:filtered['face']={}
                rotation=pose.get('headRotation',[])
                if isinstance(rotation,list) and len(rotation)==3 and all(isinstance(n,(float,int)) and math.isfinite(n) and abs(n)<4 for n in rotation):
                    filtered['headRotation']=[round(float(n),3) for n in rotation]
                posture=pose.get('body',{})
                if isinstance(posture,dict):
                    limbs={}
                    for label in ('leftShoulder','rightShoulder','leftElbow','rightElbow','leftWrist','rightWrist','leftIndex','rightIndex','leftPalm','rightPalm'):
                        item=posture.get(label)
                        if isinstance(item,list) and len(item)==3 and all(isinstance(n,(float,int)) and math.isfinite(n) and abs(n)<4 for n in item):
                            limbs[label]=[round(float(n),3) for n in item]
                    for side in ('left','right'):
                        values=posture.get(side+'Hand')
                        if isinstance(values,list) and len(values)==21 and all(isinstance(pt,list) and len(pt)==3 and all(isinstance(n,(int,float)) and math.isfinite(n) and abs(n)<4 for n in pt) for pt in values):
                            limbs[side+'Hand']=[[round(float(n),3) for n in pt] for pt in values]
                    filtered['body']=limbs
                volume=pose.get('voiceLevel',0)
                if isinstance(volume,(float,int)) and math.isfinite(volume):
                    filtered['voiceLevel']=max(0,min(1,round(float(volume),3)))
                raw_bands=pose.get('voiceBands',[])
                if isinstance(raw_bands,list) and len(raw_bands)==3 and all(isinstance(n,(float,int)) and math.isfinite(n) for n in raw_bands):
                    filtered['voiceBands']=[max(0,min(1,round(float(v),3))) for v in raw_bands]
                with room_lock:
                    if uid in room:room[uid]['state']=filtered
                publish({'type':'state','id':uid,'name':name,'state':filtered},uid,room_id)
            elif msg.get('type')=='robot-motion':
                identifier=str(msg.get('id',''))
                position=msg.get('position');rotation=msg.get('rotation');mode=msg.get('mode','idle')
                if not re.fullmatch(r'[A-Za-z0-9_-]{8,80}',identifier):continue
                if mode not in ('idle','walk','run','wave'):continue
                if not all(isinstance(v,list) and len(v)==3 and all(isinstance(x,(int,float)) and math.isfinite(x) and abs(x)<1000 for x in v) for v in (position,rotation)):continue
                publish({'type':'robot-motion','room':room_id,'by':uid,'id':identifier,'position':position,'rotation':rotation,'mode':mode},except_id=uid,room_id=room_id)
            elif msg.get('type')=='signal' and isinstance(msg.get('payload'),dict):
                to=msg.get('to')
                with room_lock:peer=room.get(to)
                if peer and peer['room']==room_id:
                    peer['ws'].send(json.dumps({'type':'signal','id':uid,'to':to,'payload':msg['payload']}))
    except (ValueError,TypeError,ConnectionError,OSError):pass
    finally:
        if uid:
            with room_lock:room.pop(uid,None)
            publish({'type':'presence','event':'left','id':uid},room_id=room_id)

@app.get('/')
def index():return send_from_directory(ROOT,'index.html')

@app.get('/<path:name>')
def public_asset(name):
    if name.split('/')[0] not in {'js','vendor','assets'} and name not in {'styles.css','releases.json'}:abort(404)
    return send_from_directory(ROOT,name)

if __name__=='__main__':app.run(host='127.0.0.1',port=int(os.environ.get('SOLVI_PORT','8765')))
