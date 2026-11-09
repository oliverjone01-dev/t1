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

## CPO: native archive to privacy-safe aggregates

In the configured in-app Ozon browser, collect «Оплата за заказ → Все товары»:
closed-day exports «по заказам» and «по товарам» for exactly the same window.
The second export currently contains daily totals, not SKU rows. Also observe
current active state, bid and promoted-product count; do not infer them from
«Выбранные товары». Settings are read-only. Do not backdate today's bid.

Retain native paired files in a PRIVATE archive as `NAME.orders.xlsx` and
`NAME.daily.xlsx`. Recover the latest fourteen closed days on every run and
retain older pairs since the first aggregate. The adapter replaces overlapping
export windows and rejects duplicates, missing days, changed headers, invalid
amounts and differences between native daily/order totals. Raw files and order
identifiers never enter Git. If a report is unavailable, retain last-good data
and show the missed source; do not fabricate zeros.

After preparing the normal funnel/catalog JSON, augment that same package:

    python3 -B tools/cabinet/cpo_capture.py --archive PRIVATE_ARCHIVE \
      --data data --previous PREPARED/cabinet_capture.json \
      --captured-at ISO_TIMESTAMP --settings PRIVATE_SETTINGS.json \
      --out NEW_PREPARED_DIRECTORY

Settings JSON has only `captured_at`, `scope:"all"`, `active` (boolean),
`bid_percent`, `promoted_products`, `products_period_from` and
`products_period_to` (the selected UI dates for that count). The observation timestamp belongs to the
visible settings, not to publication. Run using current main data. The output
is submitted with existing `submit_capture.py`. Once CPO is active, updated
funnel packages require refreshed CPO, preventing silent stale advertising.
The server verifies current orders input hash and campaign daily spend before
publishing. A concurrent orders update requires re-preparation, not a bypass.
The same campaign reader drives Report and Cards. CPO revenue is grouped by
order creation date, excludes cancelled postings and is recalculated locally
on each capture. No per-order links are published; affected per-order expense
and profit cells explicitly show missing detail. Retain private archive for
future reconciliation and rejoin on late statuses.
