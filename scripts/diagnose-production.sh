#!/usr/bin/env bash
# SOLVI.help read-only production diagnostics. Runs on the existing Mac watcher machine.
# No deployment, configuration changes, restarts, credential reads or writes.
set -euo pipefail
REMOTE="${SOLVI_REMOTE:-root@yolo.cx}"
PORT="${SOLVI_SSH_PORT:-18021}"
MEDIA_URL='https://rantlist.me/media/393281aa-ffaa-454b-be4b-a96707840e30/index.m3u8'
printf 'SOLVI diagnosis: remote=%s port=%s\n' "$REMOTE" "$PORT"
ssh -o BatchMode=yes -o ConnectTimeout=10 -p "$PORT" "$REMOTE" 'bash -s' <<'REMOTE_READ_ONLY'
set -u
printf '\n=== CLOCK ===\n'
date -u '+%Y-%m-%dT%H:%M:%SZ'
printf '\n=== SYSTEMD STATUS (read only) ===\n'
systemctl show solvi-help --property=ActiveState,SubState,Result,NRestarts,ExecMainStatus,ExecMainPID --no-pager 2>&1 || true
printf '\n=== LOCAL BACKEND HTTP HEALTH ===\n'
curl --noproxy '*' --silent --show-error --max-time 10 --write-out '\nHTTP %{http_code} time=%{time_total}s\n' 'http://127.0.0.1:18765/api/health' || true
printf '\n=== HTTPS THROUGH LOCAL NGINX ===\n'
curl --noproxy '*' --silent --show-error --max-time 12 --resolve solvi.help:443:127.0.0.1 --write-out '\nHTTP %{http_code} time=%{time_total}s\n' 'https://solvi.help/api/health' || true
printf '\n=== GUNICORN/SERVICE JOURNAL (last 35 minutes) ===\n'
journalctl -u solvi-help --since '35 minutes ago' --no-pager --output=short-iso -n 90 2>&1 || true
printf '\n=== NGINX ERRORS (last 75 lines) ===\n'
if [ -r /var/log/nginx/error.log ]; then tail -n 75 /var/log/nginx/error.log; else echo 'No readable nginx error.log'; fi
printf '\n=== RECENT OOM KERNEL EVIDENCE ===\n'
journalctl -k --since '35 minutes ago' --no-pager -n 120 2>&1 | grep -iE '(out of memory|oom-kill|killed process|gunicorn)' | tail -n 25 || true
printf '\n=== HLS CORS: ORIGIN solvi.help ===\n'
curl --silent --show-error --location --max-time 12 -H 'Origin: https://solvi.help' -D - -o /dev/null \
 'https://rantlist.me/media/393281aa-ffaa-454b-be4b-a96707840e30/index.m3u8' 2>&1 | grep -iE '^(HTTP/|access-control-allow-origin:|vary:|content-type:|cache-control:|curl:)' || true
printf '\n=== HLS CORS: ORIGIN mojoworks.xyz ===\n'
curl --silent --show-error --location --max-time 12 -H 'Origin: https://mojoworks.xyz' -D - -o /dev/null \
 'https://rantlist.me/media/393281aa-ffaa-454b-be4b-a96707840e30/index.m3u8' 2>&1 | grep -iE '^(HTTP/|access-control-allow-origin:|vary:|content-type:|cache-control:|curl:)' || true
printf '\n=== END: READ ONLY, NO RESTART/DEPLOYMENT ===\n'
REMOTE_READ_ONLY
