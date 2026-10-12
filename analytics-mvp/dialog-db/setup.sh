#!/bin/bash
set -euo pipefail
runuser -u postgres -- psql -v ON_ERROR_STOP=1 <<'SQL'
SELECT 'CREATE ROLE gg LOGIN' WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname='gg')\gexec
SELECT 'CREATE DATABASE gg_dialog OWNER gg' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname='gg_dialog')\gexec
SQL
python3 -m py_compile /srv/gg/dialog-db/current/server.py
runuser -u gg -- python3 /srv/gg/dialog-db/current/server.py import /srv/gg/www/current/dialog/index.html
install -m 644 /srv/gg/dialog-db/current/gg-dialog-api.service /etc/systemd/system/
install -m 644 /srv/gg/dialog-db/current/gg-dialog-import.service /etc/systemd/system/
install -m 644 /srv/gg/dialog-db/current/gg-dialog-import.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now gg-dialog-api.service gg-dialog-import.timer
