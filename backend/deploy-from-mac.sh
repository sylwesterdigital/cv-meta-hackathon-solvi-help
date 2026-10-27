#!/usr/bin/env bash
# Explicit opt-in backend install/upgrade. Execute from Git repository root on macOS.
set -euo pipefail
[[ -f backend/server.py ]] || { echo 'Run from cv-meta-hackathon-solvi-help repository root';exit 1; }
REMOTE='root@yolo.cx'; PORT='18021'
ssh -o BatchMode=yes -p "$PORT" "$REMOTE" 'mkdir -p /opt/solvi-help/deploy-src'
rsync -az -e "ssh -p $PORT" backend/ "$REMOTE:/opt/solvi-help/deploy-src/"
ssh -t -p "$PORT" "$REMOTE" 'bash /opt/solvi-help/deploy-src/install-ubuntu.sh'
