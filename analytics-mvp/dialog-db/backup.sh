#!/bin/bash
set -euo pipefail
umask 077
dir=/srv/gg/backups/dialog-db
mkdir -p "$dir"
stamp=$(date -u +%Y%m%dT%H%M%SZ)
tmp="$dir/.gg_dialog-$stamp.tmp"
trap 'rm -f -- "$tmp"' EXIT
runuser -u postgres -- pg_dump -Fc gg_dialog > "$tmp"
runuser -u postgres -- pg_restore --list < "$tmp" >/dev/null
mv "$tmp" "$dir/gg_dialog-$stamp.dump"
echo "Database backup verified: $stamp"
