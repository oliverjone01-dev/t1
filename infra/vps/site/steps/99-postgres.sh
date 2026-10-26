#!/usr/bin/env bash
# sections: dialog rop rop2 prod prod2 office economics econ-control rop-gm pto structure
# sections-from: .gg/managers.txt
# Persist data before publishing this release. Never create another dashboard URL.
if [ ! -f /srv/gg/system-db/current/server.py ]; then
  echo 'PostgreSQL transport is not installed; refusing to publish embedded snapshots.' >&2
  exit 1
fi
GG_SYSTEM_SITE="$SITE" python3 /srv/gg/system-db/current/server.py import
# Same-version, read-only first screen; filters hydrate from the PostgreSQL payload.
node "$GG_OPS/site/prerender-rop.cjs" "$SITE"
