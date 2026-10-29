#!/usr/bin/env bash
# Automatic SOLVI backend install/update from watcher staged release.
set -Eeuo pipefail
[[ $(id -u) -eq 0 ]] || { echo 'Root required' >&2; exit 1; }
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SITE=/etc/nginx/sites-available/solvi.help
SNIPPET=/etc/nginx/snippets/solvi-help-api.conf
SERVICE=/etc/systemd/system/solvi-help.service
TARGET=/opt/solvi-help
STATE=/var/lib/solvi-help
PORT=18765
EXPECTED_VERSION=${SOLVI_EXPECTED_VERSION:-0.2.68}
export SOLVI_EXPECTED_VERSION="$EXPECTED_VERSION"
BACKUP=$(mktemp -d /root/solvi-backend-backup-XXXXXXXX)
CHANGED=0
GOOD=0
RESTORE_SERVICE=0
RESTORE_SNIPPET=0
RESTORE_SITE=0
RESTORE_SERVER=0
RESTORE_REQUIREMENTS=0
finish() {
  rc=$?
  if (( rc != 0 && CHANGED )); then
    echo '[SOLVI] Backend install failed. Rolling back the service and Nginx configuration.' >&2
    if (( RESTORE_SITE )); then cp -a "$BACKUP/vhost" "$SITE"; fi
    if (( RESTORE_SNIPPET )); then cp -a "$BACKUP/snippet" "$SNIPPET"; else rm -f "$SNIPPET"; fi
    if (( RESTORE_SERVICE )); then cp -a "$BACKUP/service" "$SERVICE"; else rm -f "$SERVICE"; fi
    if (( RESTORE_SERVER )); then cp -a "$BACKUP/server.py" "$TARGET/server.py"; else rm -f "$TARGET/server.py"; fi
    if (( RESTORE_REQUIREMENTS )); then cp -a "$BACKUP/requirements.txt" "$TARGET/requirements.txt"; else rm -f "$TARGET/requirements.txt"; fi
    systemctl daemon-reload || true
    if (( RESTORE_SERVICE )); then systemctl restart solvi-help || true; else systemctl stop solvi-help || true; fi
    nginx -t && systemctl reload nginx || true
    journalctl -u solvi-help -n 25 --no-pager || true
  fi
  rm -rf "$BACKUP"
  exit "$rc"
}
trap finish EXIT
[[ -f "$SITE" ]] || { echo "Missing $SITE" >&2; exit 1; }
command -v nginx >/dev/null || { echo 'Nginx not installed' >&2; exit 1; }
command -v apt-get >/dev/null || { echo 'Debian/Ubuntu required' >&2; exit 1; }
mkdir -p "$TARGET" "$STATE/media" "$STATE/models" /etc/nginx/snippets
chown -R www-data:www-data "$STATE"
chmod 750 "$STATE" "$STATE/media"
needed=()
for pkg in python3 python3-venv python3-pip curl ffmpeg rsync espeak-ng; do
  if ! dpkg-query -W -f='${Status}' "$pkg" 2>/dev/null | grep -q 'install ok installed'; then needed+=("$pkg"); fi
done
if (( ${#needed[@]} )); then
 apt-get update -qq
 DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends "${needed[@]}"
fi
cp -a "$SITE" "$BACKUP/vhost"; RESTORE_SITE=1
if [[ -f "$SNIPPET" ]]; then cp -a "$SNIPPET" "$BACKUP/snippet"; RESTORE_SNIPPET=1; fi
if [[ -f "$SERVICE" ]]; then cp -a "$SERVICE" "$BACKUP/service"; RESTORE_SERVICE=1; fi
if [[ -f "$TARGET/server.py" ]]; then cp -a "$TARGET/server.py" "$BACKUP/server.py"; RESTORE_SERVER=1; fi
if [[ -f "$TARGET/requirements.txt" ]]; then cp -a "$TARGET/requirements.txt" "$BACKUP/requirements.txt"; RESTORE_REQUIREMENTS=1; fi
CHANGED=1
install -m 644 "$SRC/server.py" "$TARGET/server.py"
install -m 644 "$SRC/requirements.txt" "$TARGET/requirements.txt"
if [[ ! -x "$TARGET/.venv/bin/python" ]]; then python3 -m venv "$TARGET/.venv"; fi
"$TARGET/.venv/bin/python" -m pip install -q --disable-pip-version-check -r "$TARGET/requirements.txt"
# STT reuses the existing Rantlist Whisper.cpp executable and persistent base model.
# No second model, inference wheel, or automatic download is installed by SOLVI.
# One-time admin password; no default password. Do not print secret in deployment logs.
if [[ ! -f /etc/solvi-help.env ]]; then
  install -m 600 /dev/null /etc/solvi-help.env
fi
chmod 600 /etc/solvi-help.env
if ! grep -q '^SOLVI_ADMIN_PASSWORD_HASH=' /etc/solvi-help.env; then
  "$TARGET/.venv/bin/python" - <<'PY'
from pathlib import Path
import hashlib,secrets
secret=secrets.token_urlsafe(24)
salt=secrets.token_bytes(16)
digest=hashlib.pbkdf2_hmac('sha256',secret.encode(),salt,260000).hex()
p=Path('/etc/solvi-help.env')
with p.open('a') as f:f.write('SOLVI_ADMIN_PASSWORD_HASH=pbkdf2_sha256:'+salt.hex()+':'+digest+'\n')
Path('/etc/solvi-help-admin-initial.txt').write_text(secret+'\n')
Path('/etc/solvi-help-admin-initial.txt').chmod(0o600)
PY
fi
install -m 644 "$SRC/solvi-help.service.example" "$SERVICE"
cat > "$SNIPPET" <<'NGINX'
location ^~ /api/ {
    client_max_body_size 12m;
    proxy_pass http://127.0.0.1:18765;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 100s;
}
location = /ws {
    proxy_pass http://127.0.0.1:18765;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;
}
NGINX
python3 "$SRC/configure-nginx.py" "$SITE"
nginx -t
systemctl daemon-reload
systemctl enable solvi-help.service >/dev/null
systemctl restart solvi-help.service
# Distinctive check stops false positives when an unrelated service occupies the port.
for i in $(seq 1 24); do
  if curl -fsS --max-time 2 "http://127.0.0.1:${PORT}/api/health" > "$BACKUP/health.json" 2>/dev/null; then
    if "$TARGET/.venv/bin/python" - "$BACKUP/health.json" <<'PY'
import json,sys
x=json.load(open(sys.argv[1]));assert x.get('service')=='solvi-help-api' and x.get('version')==__import__('os').environ['SOLVI_EXPECTED_VERSION']
PY
    then break; fi
  fi
  sleep 1
done
"$TARGET/.venv/bin/python" - "$BACKUP/health.json" <<'PY'
import json,sys
x=json.load(open(sys.argv[1]));assert x['service']=='solvi-help-api' and x['version']==__import__('os').environ['SOLVI_EXPECTED_VERSION']
PY
systemctl reload nginx
# Public proxy check: no passing release based solely on HTTP 200 for index.html.
curl -fsS --max-time 15 https://solvi.help/api/health > "$BACKUP/public.json"
"$TARGET/.venv/bin/python" - "$BACKUP/public.json" <<'PY'
import json,sys
x=json.load(open(sys.argv[1]));assert x['service']=='solvi-help-api' and x['version']==__import__('os').environ['SOLVI_EXPECTED_VERSION']
PY
GOOD=1
printf '[SOLVI] BACKEND LIVE: v%s | SQLite | API /api/health | WebSocket /ws\n' "$EXPECTED_VERSION"
