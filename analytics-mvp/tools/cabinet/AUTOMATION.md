# Daily Ozon operation

API collection is server-side, independent of the Mac/chat: orders runs at
04:52 and 17:12 UTC (07:52 and 20:12 Moscow; GitHub schedules may be delayed).
Manual and scheduled main runs both dispatch snapshots. Snapshots completion
publishes checked parts through the existing Pages workflow, even when an
unavailable source leaves its final status red. Source dates stay visible.

`ozon-watchdog.yml` runs every two hours at minute 23. It waits for active
work, restores a missing chain, and retries a failed run once. Persistent
errors remain failures instead of generating an infinite retry loop. API
collectors retain their existing historical lookback and validation rules.

Browser reports still require an awake Mac, running Codex, and a valid Ozon
session. Only visible UI reading, view filters and native downloads are
authorized. No Ozon mutations, hidden browser APIs, session exports or
CAPTCHA bypass. Missing native reports are not synthesized from API fields.

For each browser report use existing `prepare.py`, preserving its raw sources,
manifest and READY.json locally. Then run:

    python3 -B tools/cabinet/submit_capture.py /absolute/run/day/prepared

The client validates the public schema before uploading only that JSON as a
Git blob, then dispatches `ozon-cabinet-publish.yml` with blob IDs, not reports
or credentials. Uses existing gh authentication. No new token is provisioned.
Submission is not publication: retain submission.json, verify the server run
and the following Pages run and live dated funnel.

The main-only server gate checks the optimistic base blob, the public schema,
freshness (three hours for changed captures), dates and preserved history;
builds staged pages and runs smoke + verify_dashboard before writing a single
allowed data file. Current raw reports, prices and private context never enter
the repository. The bot performs the data commit; completion starts Pages and
continues the API chain. A concurrent data correction fails closed: fetch main,
re-prepare and submit again. Do not weaken checks to publish rejected reports.

Existing browser heartbeats must point to the current working chat, not a
stalled predecessor. The morning run collects yesterday and today separately;
evening collects today. At either run, check for missing closed days (up to the
existing fourteen-day lookback), recover a bounded number, archive unresolved
days and continue the independently valid closed-day package. Retry a native
report with inconsistent totals once with a newly generated report; retain
the rejection and last good data if it still fails. A pending submission must
be checked before resubmitting, and an active server workflow must be awaited.

Operational success is three separate facts: source collected, server gate
accepted, and live Pages verified. A green deploy alone is not fresh source
data. No claim of guaranteed unattended browser access: login/CAPTCHA or
managed approval restrictions can still require the owner. Only meaningful
failures or required actions should notify the owner; routine unchanged
monitoring stays quiet.

## Failure isolation and retry receipts

The first orders collector is bounded and independent of other financial reports.
A failure keeps the final run red but permits the independent collectors, commit
and snapshots continuation. Orders workflows are main-only. Capture timestamp
ordering compares timezone-aware instants.

The client has bounded subprocess calls and a nonblocking local lock. It writes
an atomic receipt before dispatch and reconciles the deterministic run-name on
repeat. An ambiguous timeout is not retried. --retry-failed allows one retry
only for a confirmed failed/timed_out server run; never delete the receipt to
force a retry. data_in_main still does not certify Pages publication.

The server publishes a one-file Git tree with the checked main commit as its
sole parent, then advances main without force. Any concurrent main change
fails closed, including changes to API inputs or builders. Reprepare and rerun
checks once. The publisher does not dispatch orders while snapshots is active.
The watchdog ignores skipped deployment runs and reports blocked/overdue
active workflows instead of waiting silently forever; it never cancels them.
