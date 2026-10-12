# GENGROUP database migration

Native ROP, production, office, economics, ROP GM, PTO, manager pages and dialogue
read their immutable snapshot from PostgreSQL at their original URL.
The original UI formulas and filters remain client-side: this is database storage
and optimized transport, not a claim of completed server-side filtering.

Dialog events are transported column-wise with dictionaries for repeated values.
The importer round-trip checks exact event equality. The browser restores native
objects before executing the original scripts. No event or AI text is truncated.
Snapshots are compressed once during import, stored in PostgreSQL, and served with
private immutable version caching. A newly published snapshot changes the hash.
The existing authenticated nginx gateway protects pages and the API.

The importer synchronizes legacy indexed dialogue tables before converting the
main page. The dialogue timer skips converted HTML; fresh site builds synchronize
again. Build integration must run the importer against the new release before
publishing it. A two-minute timer repairs/reconciles manual deployments.

The structure screen reads its status and inventory from PostgreSQL. Disk usage
is measured by a privileged systemd pre-command (counts only, no file contents),
then stored in the database. Shared aliases are not additive. Temporary rollback
copies are deleted after exact-data and browser checks. Existing release retention
and pg_dump backups are preserved.

Remaining work: SQL aggregates/filtering and pagination per native dashboard,
on-demand history fetching, period temperature snapshots and the corresponding
metric correction, and independent redesigns of other dashboards.

