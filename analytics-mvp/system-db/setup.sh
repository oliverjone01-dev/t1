set -euo pipefail
root=/srv/gg/system-db
mkdir -p "$root/releases" "$root/rollback"
chown -R gg:gg "$root"
cp /srv/gg/system-db/current/gg-system-api.service /srv/gg/system-db/current/gg-system-import.service /srv/gg/system-db/current/gg-system-import.timer /etc/systemd/system/
cp /srv/gg/system-db/current/gg-dialog-import.service /etc/systemd/system/
python3 -m py_compile /srv/gg/system-db/current/server.py
systemctl daemon-reload
systemctl enable --now gg-system-api.service
systemctl start gg-system-import.service
systemctl enable --now gg-system-import.timer
curl -fsS http://127.0.0.1:18765/api/status


