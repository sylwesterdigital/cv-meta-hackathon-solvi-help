#!/usr/bin/env bash
# SOLVI.help watcher — keep this file at the root of cv-meta-hackathon-solvi-help.
# Watches ROOT/updates/*.zip, checks versions/checksums/tests, pushes GitHub, deploys Ubuntu.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec python3 - "$ROOT" "$@" <<'SOLVI_WATCH_PY'
#!/usr/bin/env python3
"""SOLVI.help Mac release watcher: verified ZIP -> tests -> Git SSH -> SSH/rsync -> HTTPS smoke."""
import argparse
import datetime as dt
import hashlib
import http.server
import json
import os
import re
import shutil
import socketserver
import stat
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
import zipfile
from pathlib import Path, PurePosixPath

ROOT=Path(sys.argv[1]).resolve()
sys.argv=[sys.argv[0]]+sys.argv[2:]
UPDATES=ROOT/'updates'
STATE=ROOT/'.solvi'
REMOTE_USER='root@yolo.cx'
SSH_PORT='18021'
WEBROOT='/var/www/solvi.help'
GITHUB='git@github.com:sylwesterdigital/cv-meta-hackathon-solvi-help.git'
PUBLIC='https://solvi.help/'
VERSION_PATTERN=re.compile(r'^\d+\.\d+\.\d+$')
SHA_PATTERN=re.compile(r'^[0-9a-f]{64}$')
PUBLIC_ITEMS=('index.html','styles.css','js','assets','vendor','releases.json')
REQUIRED=('index.html','styles.css','js/main.js','js/world.js','js/animations.js','js/devlog.js','assets/solvi-character.glb','releases.json','package.json','backend/server.py','backend/install-ubuntu.sh','backend/configure-nginx.py','backend/requirements.txt','scripts/prepare_vendor.mjs','tests/animations.test.mjs','tests/browser-imports.test.mjs','scripts/check_browser_modules.mjs','backend/test_api.py','backend/test_nginx.py')
REQUIRED_VENDOR=('vendor/three/three.module.js','vendor/three/three.core.js','vendor/three/addons/controls/OrbitControls.js','vendor/three/addons/loaders/GLTFLoader.js','vendor/three/addons/loaders/DRACOLoader.js','vendor/three/addons/utils/BufferGeometryUtils.js','vendor/three/draco/draco_decoder.wasm')
_log=None
_VERBOSE=False
_RUN={"version":"?","git":False,"server":False,"phase":"waiting","started":None}

class ReleaseError(Exception):pass

def display(message,level='INFO'):
    """Short human-readable console; complete command trace stays in per-release log."""
    stamp=dt.datetime.now().strftime('%H:%M:%S')
    original=f'{stamp} [{level:5}] {message}'
    if _log:
        with _log.open('a',encoding='utf-8') as f:f.write(original+'\n')
    # Hide routine internal details; --verbose restores the complete trace.
    if not _VERBOSE and (
        message.startswith('$ ') or
        level=='STEP' or
        (level=='PASS' and not message.startswith(('RELEASE ','DRY-RUN '))) or
        message.startswith(('Log: ', 'Server backup: '))
    ):
        return
    colors={
        'INFO':'\033[36m','PASS':'\033[1;32m','FAIL':'\033[1;31m',
        'STEP':'\033[34m','WARN':'\033[33m',
        'EVENT':'\033[1;36m','LIVE':'\033[1;34m'
    }
    rendered=f'{stamp} [{level:5}] {message}'
    if sys.stdout.isatty() and not os.environ.get('NO_COLOR'):
        rendered=colors.get(level,'')+rendered+'\033[0m'
    print(rendered,flush=True)

def announce(phase,message):
    _RUN['phase']=phase
    display(message,'EVENT')

def run(args,cwd=None,timeout=180,output=True):
    args=[str(x) for x in args]
    display('$ '+' '.join(subprocess.list2cmdline([x]) for x in args))
    p=subprocess.run(args,cwd=cwd,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=timeout)
    if _log and p.stdout:
        with _log.open('a') as f:f.write(p.stdout+'\n')
    if p.returncode:
        if p.stdout:print('\n'.join(p.stdout.splitlines()[-6:]),flush=True)
        raise ReleaseError(f'Command failed ({p.returncode}): {args[0]} {args[1] if len(args)>1 else ""}')
    return p.stdout.strip()

def ssh(command):
    return run(['ssh','-o','BatchMode=yes','-o','ConnectTimeout=10','-p',SSH_PORT,REMOTE_USER,command],timeout=70)

def digest(content):return hashlib.sha256(content).hexdigest()

def version_tuple(text):return tuple(map(int,text.split('.')))

def last_deployed():
    # The repo copy can be written during a failed pre-commit attempt.
    # Only a confirmed deployment counts as deployed; this also permits retries.
    versions=['0.0.0']
    for path,field in ((STATE/'deployed.json','version'),):
        try:
            version=json.loads(path.read_text()).get(field,'')
            if VERSION_PATTERN.fullmatch(version):versions.append(version)
        except (OSError,ValueError,TypeError):pass
    return max(versions,key=version_tuple)

def verify_zip(archive,stage):
    display(f'Checking {archive.name}: paths, SHA-256 hashes, version','STEP')
    with zipfile.ZipFile(archive) as z:
        members=z.infolist()
        if len(members)>350 or sum(m.file_size for m in members)>110*1024*1024:
            raise ReleaseError('Archive exceeds file-count or extracted-size safety limits')
        names=[m.filename for m in members if not m.is_dir()]
        if len(set(names))!=len(names) or 'manifest.json' not in names:raise ReleaseError('ZIP has duplicate filenames or lacks manifest')
        for member in members:
            p=PurePosixPath(member.filename)
            if member.filename.startswith('/') or '\\' in member.filename or '..' in p.parts or (any(x.startswith('.') for x in p.parts) and member.filename!='app/.gitignore'):
                raise ReleaseError('Unsafe archive path '+member.filename)
            if stat.S_ISLNK(member.external_attr>>16):raise ReleaseError('Archive symlinks are forbidden')
            if member.filename!='manifest.json' and (not p.parts or p.parts[0]!='app'):
                raise ReleaseError('Unexpected archive entry '+member.filename)
        manifest=json.loads(z.read('manifest.json'))
        version=manifest.get('version','')
        if not VERSION_PATTERN.fullmatch(version):raise ReleaseError('Bad version in manifest')
        if version_tuple(version)<=version_tuple(last_deployed()):
            raise ReleaseError(f'Release v{version} is not newer than deployed v{last_deployed()}')
        hashes=manifest.get('sha256')
        if not isinstance(hashes,dict) or set('app/'+k for k in hashes)!=set(n for n in names if n.startswith('app/')):
            raise ReleaseError('Manifest checksum list does not match ZIP files')
        for rel,sha in hashes.items():
            p=PurePosixPath(rel)
            if not SHA_PATTERN.fullmatch(sha) or p.is_absolute() or '..' in p.parts or (any(x.startswith('.') for x in p.parts) and rel!='.gitignore'):
                raise ReleaseError('Invalid SHA/path '+rel)
            contents=z.read('app/'+rel)
            if digest(contents)!=sha:raise ReleaseError('SHA-256 mismatch: '+rel)
            destination=stage.joinpath(*p.parts);destination.parent.mkdir(parents=True,exist_ok=True)
            destination.write_bytes(contents)
        for name in REQUIRED:
            if not (stage/name).is_file():raise ReleaseError('Missing required file: '+name)
        if json.loads((stage/'package.json').read_text())['version']!=version:raise ReleaseError('package.json version mismatch')
        if json.loads((stage/'releases.json').read_text())['currentVersion']!=version:raise ReleaseError('releases.json version mismatch')
        if not isinstance(manifest.get('changes'),list) or not manifest['changes']:raise ReleaseError('Manifest needs change notes')
        display(f'Validated v{version}, {len(hashes)} files','PASS')
        return manifest


# Locally owned avatar files are intentionally not in the immutable release ZIP.
# Import only fixed, known paths and catalogued, valid GLBs. Preserve the exact
# original bytes; never delete, reset, stash or rewrite the user's local files.
_LOCAL_ASSETS=set()

def valid_glb(path,max_size=100*1024*1024):
    if path.is_symlink() or not path.is_file():return False
    size=path.stat().st_size
    if not 20 <= size <= max_size:return False
    with path.open('rb') as f:head=f.read(12)
    return len(head)==12 and head[:4]==b'glTF' and int.from_bytes(head[4:8],'little')==2 and int.from_bytes(head[8:12],'little')==size

def safe_owned_asset(path,rel):
    # The historical SOLVI GLB was edited by the user and must never be
    # discarded because of a decoder-specific header heuristic. Strict
    # GLB validation still applies to new gallery uploads.
    if rel in ('assets/solvi-character.glb','assets/facecap.glb'):
        return path.is_file() and not path.is_symlink() and 0 < path.stat().st_size <= 100*1024*1024
    return valid_glb(path,24*1024*1024)

def owned_source(rel):
    local=ROOT/rel
    if local.is_file() and not local.is_symlink():
        return local
    # The user moved the original GLB into the avatar library. Continue to
    # publish the legacy URL without deleting or moving the gallery copy.
    if rel=='assets/solvi-character.glb':
        replacement=ROOT/'assets/avatars/solvi-character.glb'
        if replacement.is_file() and not replacement.is_symlink():
            return replacement
    return None

def stage_local_assets(stage):
    global _LOCAL_ASSETS
    _LOCAL_ASSETS=set()
    catalog=stage/'assets/avatars/catalog.json'
    library=[]
    if catalog.is_file():
        for item in json.loads(catalog.read_text()).get('avatars',[]):
            rel=item.get('url','').removeprefix('./')
            if re.fullmatch(r'assets/avatars/[A-Za-z0-9_-]+\.glb',rel):library.append(rel)
    for rel in ('assets/solvi-character.glb','assets/facecap.glb',*sorted(set(library))):
        src=owned_source(rel)
        if src is None:continue
        if not safe_owned_asset(src,rel):
            raise ReleaseError('Local avatar is not a valid GLB v2: '+rel)
        destination=stage/rel
        destination.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,destination)
        if destination.read_bytes()!=src.read_bytes():
            raise ReleaseError('Local avatar copy failed: '+rel)
        _LOCAL_ASSETS.add(rel)
    if _LOCAL_ASSETS:
        display(f'LOCAL AVATARS INCLUDED: {len(_LOCAL_ASSETS)} file(s), original bytes preserved','EVENT')

def verify_owned_asset(rel,stage):
    if rel not in _LOCAL_ASSETS:return False
    source=owned_source(rel)
    staged=stage/rel
    return source is not None and safe_owned_asset(source,rel) and staged.is_file() and source.read_bytes()==staged.read_bytes()

def release_banner(title,version='?',details=''):
    border='-'*72
    stamp=dt.datetime.now().astimezone().isoformat(timespec='seconds')
    print('\n'+border,flush=True)
    print(f'SOLVI.help  |  {title}  |  VERSION v{version}',flush=True)
    print(f'SERVICE: {PUBLIC}  |  {stamp}',flush=True)
    if details:print(details,flush=True)
    print(border+'\n',flush=True)
    if _log:
        with _log.open('a',encoding='utf-8') as f:
            f.write('\n'+border+'\n')
            f.write(f'SOLVI.help | {title} | VERSION v{version}\n')
            f.write(f'SERVICE: {PUBLIC} | {stamp}\n')
            if details:f.write(details+'\n')
            f.write(border+'\n\n')

def merge_history(stage,manifest):
    """Append deployment history instead of discarding earlier releases."""
    history=[]
    try:history=json.loads((ROOT/'releases.json').read_text()).get('releases',[])
    except (OSError,ValueError):pass
    previous=next((x for x in history if x.get('version')==manifest['version']
                   and x.get('changes')==manifest['changes']),None)
    published_at=(previous.get('publishedAt') if previous else None) or dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')
    item={'version':manifest['version'],
          'publishedAt':published_at,
          'changes':manifest['changes']}
    releases=[item]+[x for x in history if x.get('version')!=item['version']]
    (stage/'releases.json').write_text(json.dumps({'currentVersion':item['version'],'releases':releases[:30]},indent=2)+'\n')

def test_stage(stage):
    display('Preparing local Three.js / Draco assets (npm cache reused)','STEP')
    run(['npm','install','--ignore-scripts','--no-audit','--no-fund','--no-package-lock'],cwd=stage,timeout=200)
    run(['node','scripts/prepare_vendor.mjs'],cwd=stage)
    display('Running JavaScript, Python and HTTP smoke tests','STEP')
    for js in list((stage/'js').rglob('*.js'))+list((stage/'scripts').rglob('*.mjs')):
        run(['node','--check',js],cwd=stage)
    run(['npm','test'],cwd=stage)
    dependency_list=json.loads(run(['node','scripts/check_browser_modules.mjs','--json'],cwd=stage))['modules']
    if not dependency_list:raise ReleaseError('Browser import graph is empty')
    # Backend is now mandatory. Test actual SQLite + onboarding + world chat.
    import ast
    ast.parse((stage/'backend/server.py').read_text())
    ast.parse((stage/'backend/configure-nginx.py').read_text())
    run(['bash','-n',stage/'backend/install-ubuntu.sh'],cwd=stage)
    run(['python3','backend/test_nginx.py'],cwd=stage)
    venv=STATE/'backend-test-venv'
    if not (venv/'bin/python').is_file():run(['python3','-m','venv',venv],cwd=stage)
    run([venv/'bin/python','-m','pip','install','-q','--disable-pip-version-check','-r','backend/requirements.txt'],cwd=stage,timeout=200)
    with tempfile.TemporaryDirectory(prefix='solvi-db-test-',dir=STATE) as test_dir:
        test_env={**os.environ,'SOLVI_DATA_DIR':test_dir,'SOLVI_STATIC_ROOT':str(stage),'SOLVI_ALLOWED_ORIGINS':'http://localhost'}
        display('Testing SQLite onboarding, human chat, profiles and API health','EVENT')
        test=subprocess.run([str(venv/'bin/python'),'backend/test_api.py'],cwd=stage,env=test_env,text=True,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=35)
    if test.returncode:raise ReleaseError('Backend integration test failed: '+test.stdout[-1500:])
    if _log:
        with _log.open('a') as log:log.write(test.stdout)

    for name in REQUIRED+REQUIRED_VENDOR:
        p=stage/name
        if not p.is_file() or p.stat().st_size==0:raise ReleaseError('Missing/empty after build: '+name)
    content=(stage/'index.html').read_text()
    if 'id="devLogButton"' not in content or 'id="xrButton"' not in content or 'js/main.js' not in content:
        raise ReleaseError('UI entry points missing')
    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self,*a,**kw):super().__init__(*a,directory=str(stage),**kw)
        def log_message(self,*a):pass
    with http.server.ThreadingHTTPServer(('127.0.0.1',0),Handler) as server:
        t=threading.Thread(target=server.serve_forever,daemon=True);t.start()
        try:
            paths=set(('', 'index.html', 'styles.css', 'releases.json', 'assets/solvi-character.glb', 'vendor/three/draco/draco_decoder.wasm', *dependency_list))
            for path in sorted(paths):
                with urllib.request.urlopen(f'http://127.0.0.1:{server.server_port}/{path}',timeout=12) as resp:
                    if resp.status!=200 or not resp.read():raise ReleaseError('HTTP failed: '+path)
        finally:server.shutdown();t.join(timeout=5)
    display('Local validation passed','PASS')

def git_preflight(stage):
    display('Checking local Git, branch and GitHub SSH remote','STEP')
    if not (ROOT/'.git').exists():raise ReleaseError('Run inside the cloned Git repository root (missing .git)')
    if run(['git','branch','--show-current'],cwd=ROOT)!='main':raise ReleaseError('Expected Git branch main')
    staged=run(['git','diff','--cached','--name-only'],cwd=ROOT)
    if staged:
        raise ReleaseError('Already-staged Git changes detected; commit/stash them before automatic release: '+staged)
    # .gitignore belongs to the developer, not the release installer. Never overwrite it.
    # The watcher itself is explicitly installed by the developer and will be committed as-is.
    changed=set(run(['git','diff','--name-only'],cwd=ROOT).splitlines())
    incoming={str(p.relative_to(stage)) for p in stage.rglob('*')
              if p.is_file() and p.relative_to(stage).parts[0] not in ('node_modules','vendor')
              and p.relative_to(stage)!=Path('.gitignore')}
    # README.md is documentation, not part of the public deployment.
    # Preserve local README edits rather than blocking a release or overwriting them.
    conflicts=sorted((changed & incoming)-{'solvi-watch.sh','README.md'})
    # The repo's locally modified avatar is the source of truth. The build stage
    # may have replaced it during npm/vendor preparation; reconcile just these
    # explicitly imported assets immediately before Git conflict validation.
    # NEVER exempt an arbitrary dirty application/source file.
    for rel in conflicts:
        if rel not in _LOCAL_ASSETS:
            continue
        local=owned_source(rel)
        staged=stage/rel
        if local is None or not safe_owned_asset(local,rel):
            raise ReleaseError('Local avatar not readable/valid; preserving without deployment: '+rel)
        if not staged.is_file() or staged.read_bytes()!=local.read_bytes():
            staged.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(local,staged)
            display('LOCAL ASSET RESTORED FROM REPOSITORY: '+rel,'EVENT')
        if not verify_owned_asset(rel,stage):
            raise ReleaseError('Local asset changed during validation: '+rel)
    dangerous=[rel for rel in conflicts if not (verify_owned_asset(rel,stage) or
               ((ROOT/rel).is_file() and (stage/rel).is_file() and
                (ROOT/rel).read_bytes()==(stage/rel).read_bytes()))]
    if dangerous:
        raise ReleaseError('Uncommitted edits conflict with release: '+', '.join(dangerous))
    try:origin=run(['git','remote','get-url','origin'],cwd=ROOT)
    except ReleaseError:origin=''
    accepted=('',GITHUB,'https://github.com/sylwesterdigital/cv-meta-hackathon-solvi-help.git',
              'ssh://git@github.com/sylwesterdigital/cv-meta-hackathon-solvi-help.git')
    if origin not in accepted:raise ReleaseError('Git origin is unexpected: '+origin)
    run(['git','var','GIT_AUTHOR_IDENT'],cwd=ROOT)
    remote=run(['git','-c','core.sshCommand=ssh -o BatchMode=yes -o ConnectTimeout=10',
                'ls-remote',GITHUB,'refs/heads/main'],cwd=ROOT,timeout=30)
    if remote:
        run(['git','-c','core.sshCommand=ssh -o BatchMode=yes -o ConnectTimeout=10',
             'fetch','--no-tags',GITHUB,'refs/heads/main'],cwd=ROOT,timeout=40)
        relation=subprocess.run(['git','merge-base','--is-ancestor','FETCH_HEAD','HEAD'],
                                cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        if relation.returncode:raise ReleaseError('GitHub main diverged; git pull --ff-only first')
    ssh('test -d /var/www && command -v nginx >/dev/null && nginx -t >/dev/null 2>&1')
    display('GitHub SSH and Ubuntu preflight passed','PASS')

def update_git(stage,manifest):
    display('Committing verified release to GitHub via SSH','STEP')
    changed=[]
    # Stage ONLY files explicitly declared and SHA-256 verified in the release
    # manifest, never derived build/test artifacts (__pycache__, .pyc, caches).
    # Locally modified README.md and .gitignore remain untouched.
    manifest_files=sorted(set(manifest['sha256']) | {rel for rel in _LOCAL_ASSETS if rel.startswith('assets/avatars/')})
    for name in manifest_files:
        rel=Path(name)
        if rel.parts[0] in ('node_modules','vendor') or rel==Path('.gitignore'):
            continue
        if (rel.name == '.DS_Store' or rel.suffix in ('.pyc','.pyo') or
            any(part in ('__pycache__','.pytest_cache','.mypy_cache','.ruff_cache','.venv','.git','.solvi') for part in rel.parts)):
            raise ReleaseError('Invalid generated file in release manifest: '+name)
        source=stage/rel
        if not source.is_file():raise ReleaseError('Manifest source disappeared: '+name)
        if name not in manifest['sha256']:
            if not verify_owned_asset(name,stage):
                raise ReleaseError('Local gallery avatar changed unexpectedly: '+name)
        elif digest(source.read_bytes()) != manifest['sha256'][name] and name!='releases.json':
            if not verify_owned_asset(name,stage):
                raise ReleaseError('Manifest source modified unexpectedly: '+name)
            display('LOCAL ASSET VERIFIED (not from ZIP): '+name,'EVENT')
        if rel==Path('README.md') and 'README.md' in set(run(['git','diff','--name-only','--','README.md'],cwd=ROOT).splitlines()):
            display('Preserving local README.md edits (not included in this release commit)','WARN')
            continue
        dest=ROOT/rel
        if dest.is_symlink():raise ReleaseError('Refusing local symlink overwrite: '+str(rel))
        if name in _LOCAL_ASSETS:
            if not verify_owned_asset(name,stage):
                raise ReleaseError('Local model changed after preflight; aborting: '+name)
            if not dest.is_file():
                # Restore compatibility path from the verified developer-owned
                # avatar library copy; leave the library file untouched.
                if name!='assets/solvi-character.glb' or owned_source(name)==dest:
                    raise ReleaseError('Local asset path disappeared: '+name)
                dest.parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(source,dest)
                display('RESTORED LEGACY MODEL PATH FROM AVATAR LIBRARY: '+name,'EVENT')
            elif dest.read_bytes()!=source.read_bytes():
                raise ReleaseError('Refusing to overwrite changed local model: '+name)
        else:
            dest.parent.mkdir(parents=True,exist_ok=True)
            shutil.copy2(source,dest)
        changed.append(name)
    # releases.json is regenerated with the merged release history, so it may
    # differ from the archive hash. It is nevertheless an explicitly listed file.
    exclude=ROOT/'.git/info/exclude'
    exclude.parent.mkdir(parents=True,exist_ok=True)
    existing=exclude.read_text() if exclude.exists() else ''
    missing=[entry for entry in ('/updates/','/.solvi/','/node_modules/','/vendor/','/.venv/')
             if entry not in existing.splitlines()]
    if missing:exclude.write_text(existing.rstrip('\n')+'\n'+'\n'.join(missing)+'\n')
    if (ROOT/'solvi-watch.sh').is_file():changed.append('solvi-watch.sh')
    changed=sorted(set(name for name in changed if (ROOT/name).is_file()))
    if not changed:raise ReleaseError('Release contains no source files to commit')
    try:
        run(['git','add','--']+changed,cwd=ROOT)
        changed_in_index=subprocess.run(['git','diff','--cached','--quiet'],cwd=ROOT).returncode
        if changed_in_index:
            run(['git','commit','-m',f'solvi: release v{manifest["version"]}'],cwd=ROOT)
    except Exception:
        subprocess.run(['git','reset','-q','HEAD','--']+changed,cwd=ROOT,
                       stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        raise
    current=run(['git','remote','get-url','origin'],cwd=ROOT)
    if current!=GITHUB:run(['git','remote','set-url','origin',GITHUB],cwd=ROOT)
    run(['git','-c','core.sshCommand=ssh -o BatchMode=yes -o ConnectTimeout=10',
         'push','-u','origin','main'],cwd=ROOT,timeout=95)
    expected=run(['git','rev-parse','HEAD'],cwd=ROOT)
    remote=run(['git','-c','core.sshCommand=ssh -o BatchMode=yes -o ConnectTimeout=10',
                'ls-remote',GITHUB,'refs/heads/main'],cwd=ROOT,timeout=30)
    if not remote.startswith(expected+'\t'):
        raise ReleaseError('GitHub main does not match local HEAD after push')
    display('GitHub main updated and verified','PASS')

def publish(stage,version):
    display('Staging on Ubuntu and backing up previous public files','STEP')
    # Install only the missing deployment prerequisite; do not perform broad apt upgrades.
    ssh('command -v rsync >/dev/null 2>&1 || (apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y rsync)')
    stamp=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%d%H%M%S')
    remote_stage=f'/var/www/.solvi-stage-{version.replace(".","-")}-{stamp}'
    backup=f'/var/www/.solvi-backups/solvi.help/{stamp}-{version}'
    remote_root=WEBROOT
    ssh(f'mkdir -p {remote_stage} {backup} {remote_root}')
    # rsync only generated public assets, not Python source or build tools into web root.
    with tempfile.TemporaryDirectory(prefix='solvi-public-') as td:
        public=Path(td)
        for item in PUBLIC_ITEMS:
            src=stage/item;dest=public/item
            if src.is_dir():shutil.copytree(src,dest)
            else:shutil.copy2(src,dest)
        run(['rsync','-az','-e',f'ssh -p {SSH_PORT}',str(public)+'/',f'{REMOTE_USER}:{remote_stage}/'],timeout=130)
    for item in PUBLIC_ITEMS:
        ssh(f'test -e {remote_stage}/{item}')
    # No removal of .well-known or unrelated files in the existing Nginx root.
    ssh(f'''set -eu; for item in {' '.join(PUBLIC_ITEMS)}; do if [ -e {remote_root}/"$item" ]; then cp -a {remote_root}/"$item" {backup}/; fi; done''')
    try:
        ssh(f'''set -eu; for item in {' '.join(PUBLIC_ITEMS)}; do
            if [ -d {remote_stage}/"$item" ]; then
                mkdir -p {remote_root}/"$item"; rsync -a --delete {remote_stage}/"$item"/ {remote_root}/"$item"/;
            else
                cp {remote_stage}/"$item" {remote_root}/"$item.new";
                mv -f {remote_root}/"$item.new" {remote_root}/"$item";
            fi
        done
        nginx -t >/dev/null 2>&1
        ''')
        display('Public frontend asset verification','STEP')
        dependency_list=json.loads(run(['node','scripts/check_browser_modules.mjs','--json'],cwd=stage))['modules']
        paths=set(('', 'releases.json', 'styles.css', 'assets/solvi-character.glb', 'vendor/three/draco/draco_decoder.wasm', *dependency_list))
        for path in sorted(paths):
            with urllib.request.urlopen(PUBLIC+path+'?v='+version,timeout=25) as resp:
                if resp.status!=200 or not resp.read():raise ReleaseError('Public site unavailable: '+path)
        with urllib.request.urlopen(PUBLIC+'releases.json?v='+version,timeout=20) as resp:
            obj=json.load(resp)
        if obj.get('currentVersion')!=version:raise ReleaseError('Deployed version mismatch')
        # Backend deployment is part of the SAME release, not a separate manual step.
        display('Installing Flask, SQLite, systemd service and HTTPS API/WebSocket proxy','EVENT')
        ssh(f'mkdir -p {remote_stage}/backend')
        run(['rsync','-az','-e',f'ssh -p {SSH_PORT}',str(stage/'backend')+'/',f'{REMOTE_USER}:{remote_stage}/backend/'],timeout=130)
        ssh(f'SOLVI_EXPECTED_VERSION={version} bash {remote_stage}/backend/install-ubuntu.sh')
        with urllib.request.urlopen(PUBLIC+'api/health?v='+version,timeout=20) as resp:
            health=json.load(resp)
        if health.get('service')!='solvi-help-api' or health.get('version')!=version or not health.get('backend'):
            raise ReleaseError(f'Backend health mismatch: expected v{version}, got {health}')
        display('API VERIFIED: '+PUBLIC+'api/health | SQLite + WS configured','LIVE')
        display('Frontend + backend verified: '+PUBLIC,'PASS')
    except Exception:
        display('Deployment failed, restoring previous public files','WARN')
        ssh(f'''set -eu; for item in {' '.join(PUBLIC_ITEMS)}; do
            rm -rf {remote_root}/"$item";
            if [ -e {backup}/"$item" ]; then cp -a {backup}/"$item" {remote_root}/; fi;
        done''')
        raise
    finally:
        try:ssh(f'rm -rf {remote_stage}')
        except ReleaseError:display('Temporary server staging directory needs cleanup','WARN')
    display('Server backup: '+backup)

def process(archive,dry):
    _RUN.update(version='?',git=False,server=False,phase='validate',started=time.monotonic())
    with tempfile.TemporaryDirectory(prefix='solvi-validate-',dir=STATE) as tmp:
        stage=Path(tmp)
        announce('validate','[1/5] Checking ZIP manifest, hashes and version…')
        manifest=verify_zip(archive,stage)
        _RUN['version']=manifest['version']
        display(f'[1/5] ZIP OK — v{manifest["version"]}, {len(manifest["sha256"])} files','EVENT')
        merge_history(stage,manifest)
        stage_local_assets(stage)
        announce('tests','[2/5] Building assets and running tests…')
        test_stage(stage)
        display('[2/5] TESTS PASSED','EVENT')
        announce('preflight','[3/5] Checking GitHub and Ubuntu access…')
        git_preflight(stage)
        display('[3/5] CONNECTIONS OK','EVENT')
        if dry:
            display(f'DRY RUN PASSED — v{manifest["version"]}; NOT deployed or pushed','PASS')
            return
        announce('github','[4/5] Committing and pushing to GitHub main…')
        update_git(stage,manifest)
        _RUN['git']=True
        display('[4/5] GITHUB UPDATED — main','EVENT')
        announce('server','[5/5] Deploying Ubuntu files and checking public HTTPS…')
        try:publish(stage,manifest['version'])
        except Exception:
            display('GitHub already updated; Ubuntu deployment failed. Server rollback attempted.','WARN')
            raise
        _RUN['server']=True
        (STATE/'deployed.json').write_text(json.dumps({'version':manifest['version'],'utc':dt.datetime.now(dt.timezone.utc).isoformat()})+'\n')
        seconds=round(time.monotonic()-_RUN['started'])
        display(f'LIVE! v{manifest["version"]} FULL-STACK DEPLOYED — {PUBLIC} | GitHub: UPDATED | API: VERIFIED | {seconds}s','LIVE')

def show_status():
    local=last_deployed()
    display(f'LAST CONFIRMED BY WATCHER: {"v"+local if local!="0.0.0" else "none"}')
    try:
        with urllib.request.urlopen(PUBLIC+'releases.json?t='+str(int(time.time())),timeout=12) as resp:
            live=json.load(resp).get('currentVersion')
        with urllib.request.urlopen(PUBLIC+'vendor/three/addons/utils/BufferGeometryUtils.js?t='+str(int(time.time())),timeout=12) as asset:
            if asset.status!=200 or not asset.read():raise ReleaseError('Browser dependency unavailable: BufferGeometryUtils.js')
        with urllib.request.urlopen(PUBLIC+'api/health?t='+str(int(time.time())),timeout=12) as r:health=json.load(r)
        if health.get('service')!='solvi-help-api' or health.get('version')!=live:
            raise ReleaseError('Backend missing or wrong version')
        display(f'LIVE WEBSITE: v{live}, static + Flask API VERIFIED — {PUBLIC}','LIVE')
    except Exception as exc:
        display(f'LIVE WEBSITE: BROKEN / unverified — {exc}','FAIL')

def main():
    global _log,_VERBOSE
    arg=argparse.ArgumentParser(description='SOLVI.help versioned deployment watcher')
    group=arg.add_mutually_exclusive_group()
    group.add_argument('--once',action='store_true',help='Process all ZIPs now, then exit')
    group.add_argument('--dry-run',action='store_true',help='Check ZIP without pushing or deploying')
    group.add_argument('--status',action='store_true',help='Check deployed version locally and on the live site')
    arg.add_argument('--interval',type=int,default=3,help='Seconds between ZIP checks (default: 3)')
    arg.add_argument('--verbose',action='store_true',help='Print all commands and detailed test output')
    args=arg.parse_args()
    _VERBOSE=args.verbose
    if args.interval<1:arg.error('interval must be >= 1 second')
    if args.status:
        show_status()
        return 0
    UPDATES.mkdir(exist_ok=True);STATE.mkdir(exist_ok=True)
    for d in ('processed','failed'): (UPDATES/d).mkdir(exist_ok=True)
    import fcntl
    with (STATE/'watch.lock').open('w') as lf:
        try:fcntl.flock(lf,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise ReleaseError('Another watcher instance is running')
        display(f'WATCHING: {UPDATES} (every {args.interval}s)')
        display(f'TARGET: {PUBLIC} | GitHub: main | last confirmed: v{last_deployed()}')
        if not args.once and not args.dry_run:
            display('WAITING FOR ZIP… Drop the release into updates/ (Ctrl+C to stop).')
        failed=False
        active_watcher_hash=digest((ROOT/'solvi-watch.sh').read_bytes())
        while True:
            for file in sorted(UPDATES.glob('*.zip')):
                if not(args.once or args.dry_run) and time.time()-file.stat().st_mtime<3:continue
                stamp=dt.datetime.now().strftime('%Y%m%d-%H%M%S')
                _log=STATE/f'logs/{stamp}-{file.stem}.log';_log.parent.mkdir(exist_ok=True)
                filename_version=re.search(r'v(\d+\.\d+\.\d+)',file.name)
                release_banner('DEPLOYMENT START',filename_version.group(1) if filename_version else '?',file.name)
                display(f'ZIP DETECTED: {file.name}','EVENT')
                succeeded=False
                try:
                    process(file,args.dry_run)
                    if not args.dry_run:
                        dest=UPDATES/'processed'/file.name
                        if dest.exists():dest=dest.with_name(dest.stem+'-'+stamp+'.zip')
                        file.rename(dest)
                        display(f'ARCHIVED: updates/processed/{dest.name}')
                    succeeded=True
                except Exception as exc:
                    failed=True
                    website='UPDATED' if _RUN['server'] else 'NOT DEPLOYED / ROLLBACK ATTEMPTED' if _RUN['phase']=='server' else 'UNCHANGED'
                    github='UPDATED' if _RUN['git'] else 'UNCHANGED'
                    display(f'FAILED v{_RUN["version"]} in {_RUN["phase"]}: {exc}','FAIL')
                    display(f'GitHub: {github} | Website: {website}','FAIL')
                    if not args.dry_run:
                        dest=UPDATES/'failed'/file.name
                        if dest.exists():dest=dest.with_name(dest.stem+'-'+stamp+'.zip')
                        file.rename(dest)
                        display(f'RETRY ZIP: updates/failed/{dest.name}','WARN')
                finally:
                    display(f'DETAILED LOG: {_log}')
                    release_banner('DEPLOYMENT END — '+('SUCCESS' if succeeded else 'FAILED'),
                                   _RUN['version'] if _RUN['version']!='?' else
                                   (filename_version.group(1) if filename_version else '?'),
                                   ('LIVE: '+PUBLIC if succeeded else 'NOT DEPLOYED — '+PUBLIC))
                    _log=None
            if args.once or args.dry_run:return 1 if failed else 0
            # Reload updated watcher implementation automatically on future releases.
            if digest((ROOT/'solvi-watch.sh').read_bytes()) != active_watcher_hash:
                display('WATCHER UPDATED — reloading without user action','EVENT')
                fcntl.flock(lf,fcntl.LOCK_UN)
                lf.close()
                os.execv('/bin/bash',['bash',str(ROOT/'solvi-watch.sh'),'--interval',str(args.interval)]+(['--verbose'] if args.verbose else []))
            time.sleep(args.interval)

if __name__=='__main__':
    try:sys.exit(main())
    except KeyboardInterrupt:print('\nWatcher stopped.');sys.exit(0)
    except Exception as exc:display(str(exc),'FAIL');sys.exit(1)

SOLVI_WATCH_PY
