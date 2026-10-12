# GENGROUP dashboard PostgreSQL transport

This increment moves native JSON payloads of ROP, production, office, economics,
ROP GM, PTO and manager pages into PostgreSQL `gg_dialog.gg_system`. Published
URLs stay unchanged. Original client calculations and filters are retained.
It is **not** server-side pagination/filtering: the UI still downloads its own
full payload. The system screen reports that distinction explicitly.

The importer commits versioned data before replacing each page atomically.
Array records are also indexed by dashboard, collection, manager and creation
for the next backend query stage. Every import count-checks the records.
Existing dialogue service and CRM collectors are not changed.

`server.py import` also adds live system inventory to `/structure/`: VPS disk,
active site, PostgreSQL size, individual dashboard file/payload sizes, transport
and rebuild status. Source data is never committed to Git.

nginx must proxy `/_system/` to localhost:18765 while inheriting Basic Auth.
No new dashboard routes are exposed; this prefix is a JSON API only.

Install from a versioned checkout through setup.sh. A two-minute importer
converts future site rebuilds and refreshes inventory. Add the same import as
last build step to avoid the two-minute compatibility window.

Rollback copies are temporarily stored privately in system-db/rollback. After
UI and exact-data validation, delete them; never remove PostgreSQL payload
versions still referenced by a published page. Database backups use the
existing gg-dialog-backup timer, which dumps the same database and both schemas.

Limitations: historical temperature snapshots and server-side dashboard
filtering are separate work; `/dialog/` has not yet replaced `/dialog-next/`.
