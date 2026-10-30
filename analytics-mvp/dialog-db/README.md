# PostgreSQL dialogue preview

The existing `/dialog/` remains available. `/dialog-next/` is an authenticated
preview served from localhost:18764. No CRM writes or AI requests are made.

`server.py import <baked HTML>` reads the same masked and overlaid payload used by
the current dashboard. Import is transactional, count-checked, idempotent and
serialized with an advisory lock. It preserves the previous snapshot on failure.
The importer runs every fifteen minutes and imports only changed snapshots.

Install PostgreSQL and python3-psycopg2. Run setup.sh from a versioned Git checkout,
with `/srv/gg/dialog-db/current` pointing to that checkout. Database access uses
Unix peer authentication as gg; no database passwords or external ports required.
Add an nginx location `/dialog-next/` proxying to http://127.0.0.1:18764/ while
inheriting the existing basic authentication. Validate with nginx -t before reload.

Rollback: remove the preview location and stop gg-dialog-api and
gg-dialog-import.timer. Existing site, collectors and snapshots are not changed.
For backups use pg_dump -Fc gg_dialog as postgres; keep files root-only.

UI: department and manager radar from existing five-point AI scores; missing
scores remain missing. Per-deal comments and communication tabs. Server-side
selection, full-selection summaries, paginated deals and events. Aggregate AI
narrative is not fabricated: current preview shows labelled per-deal excerpts.

Limitations: calls/transcript association, legacy filters and custom paid AI
request workflow still remain in the existing UI. This preview must not replace
the existing route until feature parity and browser QA are complete.
