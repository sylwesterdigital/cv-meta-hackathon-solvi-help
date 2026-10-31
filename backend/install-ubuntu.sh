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
EXPECTED_VERSION=${SOLVI_EXPECTED_VERSION:-0.2.114}
export SOLVI_EXPECTED_VERSION="$EXPECTED_VERSION"
BACKUP=$(mktemp -d /root/solvi-backend-backup-XXXXXXXX)
CHANGED=0
GOOD=0
RESTORE_SERVICE=0
RESTORE_SNIPPET=0
RESTORE_SITE=0
RESTORE_SERVER=0
RESTORE_REQUIREMENTS=0
RESTORE_PY_MODULES=0
# Keep these local Python modules together with server.py in /opt/solvi-help.
BACKEND_PY_MODULES=(realm_archives.py prune_removed_avatars.py)
DEPLOY_PHASE='initial checks'
# A failed SSH deployment previously reported only `Command failed (1): ssh -o`.
# Report the failure phase without printing credentials from the environment.
on_install_error() {
  local status="$1" line="$2"
  trap - ERR
  echo "[SOLVI] INSTALL ERROR: phase=${DEPLOY_PHASE}; line=${line}; exit=${status}; expected=${EXPECTED_VERSION}" >&2
  if [[ "$DEPLOY_PHASE" == 'local backend health' || "$DEPLOY_PHASE" == 'HTTPS proxy health' ]]; then
    systemctl --no-pager --full status solvi-help.service 2>&1 | tail -n 18 >&2 || true
    journalctl -u solvi-help --since '3 minutes ago' --no-pager -n 30 2>&1 | tail -n 30 >&2 || true
  fi
}
trap 'on_install_error "$?" "$LINENO"' ERR
finish() {
  rc=$?
  if (( rc != 0 && CHANGED )); then
    echo '[SOLVI] Backend install failed. Rolling back the service and Nginx configuration.' >&2
    if (( RESTORE_SITE )); then cp -a "$BACKUP/vhost" "$SITE"; fi
    if (( RESTORE_SNIPPET )); then cp -a "$BACKUP/snippet" "$SNIPPET"; else rm -f "$SNIPPET"; fi
    if (( RESTORE_SERVICE )); then cp -a "$BACKUP/service" "$SERVICE"; else rm -f "$SERVICE"; fi
    if (( RESTORE_SERVER )); then cp -a "$BACKUP/server.py" "$TARGET/server.py"; else rm -f "$TARGET/server.py"; fi
    if (( RESTORE_PY_MODULES )); then
      for module in "${BACKEND_PY_MODULES[@]}"; do
        if [[ -f "$BACKUP/python-modules/$module" ]]; then
          install -m 644 "$BACKUP/python-modules/$module" "$TARGET/$module"
        else
          rm -f "$TARGET/$module"
        fi
      done
    fi
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
# Fail before changing the running service if a required staged module is absent.
for module in "${BACKEND_PY_MODULES[@]}"; do
  [[ -s "$SRC/$module" ]] || { echo "[SOLVI] Missing required backend module in stage: $module" >&2; exit 1; }
done
mkdir -p "$TARGET" "$STATE/media" "$STATE/models" /etc/nginx/snippets
chown -R www-data:www-data "$STATE"
chmod 750 "$STATE" "$STATE/media"
DEPLOY_PHASE="install packages"
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
mkdir -p "$BACKUP/python-modules"
for module in "${BACKEND_PY_MODULES[@]}"; do
  if [[ -f "$TARGET/$module" ]]; then cp -a "$TARGET/$module" "$BACKUP/python-modules/$module"; fi
done
RESTORE_PY_MODULES=1
CHANGED=1
DEPLOY_PHASE="install Python backend"
install -m 644 "$SRC/server.py" "$TARGET/server.py"
for module in "${BACKEND_PY_MODULES[@]}"; do
  install -m 644 "$SRC/$module" "$TARGET/$module"
done
install -m 644 "$SRC/requirements.txt" "$TARGET/requirements.txt"
if [[ ! -x "$TARGET/.venv/bin/python" ]]; then python3 -m venv "$TARGET/.venv"; fi
"$TARGET/.venv/bin/python" -m pip install -q --disable-pip-version-check -r "$TARGET/requirements.txt"
# Import the exact deployed Python files in an isolated SQLite directory before
# restarting systemd. This catches missing local modules and import-time failures.
DEPLOY_PHASE='Python backend import preflight'
mkdir -p "$BACKUP/preflight-state"
(
  cd "$TARGET"
  SOLVI_DATA_DIR="$BACKUP/preflight-state" SOLVI_STATIC_ROOT="$TARGET" "$TARGET/.venv/bin/python" - <<'PY_PREFLIGHT'
import server
assert server.app is not None
print('[SOLVI] BACKEND IMPORT OK: server.py and realm_archives.py')
PY_PREFLIGHT
)
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
# Only the avatar-library directory may be edited by the backend, and only
# after the administrator authorises a bundled removal. Other web assets remain
# read-only to the API service. Restore tombstones after every frontend rsync.
DEPLOY_PHASE='prune permanently deleted avatars'
"$TARGET/.venv/bin/python" "$TARGET/prune_removed_avatars.py" "$STATE/solvi.sqlite3" /var/www/solvi.help
chown www-data:www-data /var/www/solvi.help/assets/avatars /var/www/solvi.help/assets/avatars/catalog.json
chmod 755 /var/www/solvi.help/assets/avatars
chmod 644 /var/www/solvi.help/assets/avatars/catalog.json
DEPLOY_PHASE="write Nginx configuration"
install -m 644 "$SRC/solvi-help.service.example" "$SERVICE"
cat > "$SNIPPET" <<'NGINX'
location ^~ /api/ {
    client_max_body_size 96m;  # Bounded realm .tar.gz imports; ordinary media endpoints still cap uploads
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
DEPLOY_PHASE="start backend service"
nginx -t
systemctl daemon-reload
systemctl enable solvi-help.service >/dev/null
systemctl restart solvi-help.service
# Verify the actual version, not merely HTTP 200 or a spawned Gunicorn master.
health_matches() {
  "$TARGET/.venv/bin/python" - "$1" "$EXPECTED_VERSION" <<'PY'
import json,sys
try:
    x=json.load(open(sys.argv[1],encoding='utf-8'))
except (OSError,ValueError):
    sys.exit(1)
sys.exit(0 if x.get('service')=='solvi-help-api' and x.get('version')==sys.argv[2] and x.get('backend') is True else 1)
PY
}
DEPLOY_PHASE='local backend health'
printf '[SOLVI] HEALTH CHECK: local Gunicorn 127.0.0.1:%s, expecting v%s\n' "$PORT" "$EXPECTED_VERSION"
local_ok=0
for i in $(seq 1 35); do
  if curl --noproxy '*' -fsS --max-time 3 "http://127.0.0.1:${PORT}/api/health" > "$BACKUP/health.json" 2>/dev/null && health_matches "$BACKUP/health.json"; then
    local_ok=1
    break
  fi
  sleep 1
done
if (( ! local_ok )); then
  echo '[SOLVI] HEALTH FAILED: local Gunicorn did not return the expected version within 35 attempts' >&2
  if [[ -s "$BACKUP/health.json" ]]; then
    "$TARGET/.venv/bin/python" - "$BACKUP/health.json" <<'PY' || true
import json,sys
try:
    obj=json.load(open(sys.argv[1]))
    print('[SOLVI] local response: service=%s version=%s backend=%s' % (obj.get('service'),obj.get('version'),obj.get('backend')),file=sys.stderr)
except Exception:
    print('[SOLVI] local response was not valid JSON',file=sys.stderr)
PY
  fi
  false
fi
printf '[SOLVI] HEALTH OK: local Gunicorn v%s\n' "$EXPECTED_VERSION"

DEPLOY_PHASE='reload Nginx'
nginx -t
systemctl reload nginx
DEPLOY_PHASE='HTTPS proxy health'
# Verify Nginx + the hostname's TLS/SNI on the server's own loopback.
# Public external health is verified *separately* by the Mac watcher.
proxy_ok=0
for i in $(seq 1 8); do
  if curl --noproxy '*' -fsS --connect-timeout 3 --max-time 8 \
      --resolve solvi.help:443:127.0.0.1 \
      'https://solvi.help/api/health' > "$BACKUP/public.json" 2>/dev/null && \
      health_matches "$BACKUP/public.json"; then
    proxy_ok=1
    break
  fi
  sleep 2
done
if (( ! proxy_ok )); then
  echo '[SOLVI] HEALTH FAILED: local HTTPS/Nginx proxy did not return the expected backend version' >&2
  false
fi
printf '[SOLVI] HEALTH OK: Nginx HTTPS proxy v%s\n' "$EXPECTED_VERSION"
GOOD=1
printf '[SOLVI] BACKEND LIVE: v%s | SQLite | API /api/health | WebSocket /ws\n' "$EXPECTED_VERSION"
