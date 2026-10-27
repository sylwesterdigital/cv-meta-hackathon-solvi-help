#!/usr/bin/env bash
set -euo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'Run with sudo on Ubuntu'; exit 1; }
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
command -v apt-get >/dev/null || { echo 'Ubuntu/Debian required'; exit 1; }
missing=()
for exe in python3 rsync ffmpeg ffprobe; do command -v "$exe" >/dev/null || missing+=("$exe"); done
if ! python3 -m venv /tmp/solvi-venv-check-$$ 2>/dev/null; then missing+=(python3-venv); fi
rm -rf /tmp/solvi-venv-check-$$
if (( ${#missing[@]} )); then
 apt-get update -qq
 for exe in "${missing[@]}"; do
  pkg="$exe"; [[ "$exe" == 'ffprobe' ]] && pkg=ffmpeg
  apt-get install -y "$pkg"
 done
fi
install -d -m 755 /opt/solvi-help
install -d -m 750 -o www-data -g www-data /var/lib/solvi-help
install -d -m 750 -o www-data -g www-data /var/lib/solvi-help/media
install -m 644 "$SRC/server.py" /opt/solvi-help/server.py
install -m 644 "$SRC/requirements.txt" /opt/solvi-help/requirements.txt
[[ -x /opt/solvi-help/.venv/bin/python ]] || python3 -m venv /opt/solvi-help/.venv
/opt/solvi-help/.venv/bin/python -m pip install --disable-pip-version-check -r /opt/solvi-help/requirements.txt
install -m 644 "$SRC/solvi-help.service.example" /etc/systemd/system/solvi-help.service
if [[ ! -f /etc/solvi-help.env ]]; then
  printf '# Add securely: MODEL_API_KEY=...\n# Add securely: SOLVI_ADMIN_PASSWORD_HASH=pbkdf2_sha256:...\n' >/etc/solvi-help.env
  chmod 600 /etc/solvi-help.env
fi
systemctl daemon-reload
systemctl enable --now solvi-help.service
systemctl restart solvi-help.service
sleep 2
curl --fail --silent --show-error http://127.0.0.1:8765/api/health
printf '\nAPI active on loopback. Nginx /api/ and /ws locations must be installed separately in the HTTPS vhost.\n'
