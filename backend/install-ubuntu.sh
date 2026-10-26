#!/usr/bin/env bash
# Explicit opt-in. Run on Ubuntu as root from a cloned/copied backend directory.
set -euo pipefail
[[ "$(id -u)" -eq 0 ]] || { echo 'Run with sudo'; exit 1; }
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v apt-get >/dev/null || { echo 'Ubuntu/Debian required'; exit 1; }
if ! command -v python3 >/dev/null; then apt-get update; apt-get install -y python3; fi
if ! python3 -m venv /tmp/solvi-venv-check 2>/dev/null; then
    apt-get update; apt-get install -y python3-venv
fi
rm -rf /tmp/solvi-venv-check
install -d -m 755 /opt/solvi-help
install -m 644 "$SRC/server.py" /opt/solvi-help/server.py
install -m 644 "$SRC/requirements.txt" /opt/solvi-help/requirements.txt
[[ -x /opt/solvi-help/.venv/bin/python ]] || python3 -m venv /opt/solvi-help/.venv
/opt/solvi-help/.venv/bin/python -m pip install --disable-pip-version-check --upgrade -r /opt/solvi-help/requirements.txt
install -m 644 "$SRC/solvi-help.service.example" /etc/systemd/system/solvi-help.service
systemctl daemon-reload
systemctl enable --now solvi-help.service
systemctl restart solvi-help.service
sleep 2
curl --fail --silent --show-error http://127.0.0.1:8765/api/health
printf '\nBackend running locally. Insert locations from nginx-locations.example in the existing HTTPS vhost manually; validate with nginx -t before reload.\n'
