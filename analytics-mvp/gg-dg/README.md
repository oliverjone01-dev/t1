# GG&DG — all GG widgets, source-scoped

Published at `/gg&dg/`. The user requested every widget from `/rop/` and confirmed on 2026-10-26 that **no DG plan exists**. The production build uses the same GG collector, builder and template already checked out by the shared Pages workflow. It preserves the six sections, styles, factual formulas, filters, metric switches, sortable tables and CRM drilldowns. `template.cjs` adapts source-specific behavior, empty states, links and absent plans; `no-plan.js` keeps factual values without GG goals, quotas or attainment colors.

## Build

Node 22.23+ and existing `B24_WEBHOOK_URL` secret:

```sh
GG_REFERENCE_ROOT=/tmp/rop/analytics-mvp node --test analytics-mvp/gg-dg/check-widgets.cjs
node analytics-mvp/gg-dg/collect-widgets.cjs /tmp/rop/analytics-mvp /tmp/gg-dg-collector.mjs
node /tmp/gg-dg-collector.mjs
node analytics-mvp/gg-dg/build-widgets.cjs /tmp/gg-dg-widgets.json /tmp/rop/analytics-mvp '_site/gg&dg'
```

Only read methods are used. Leads have source `UC_NQ3QUI` (“Заявка с ДГ”). Deals have that source or link to an eligible lead. IDs are deduplicated. All pages, totals and returned owner IDs are checked. History, open tasks, touches, channel counts and production items are queried by these IDs. Contact/company activity is excluded because a shared contact can concern a different source. Empty scopes never result in unrestricted queries. Reference source drift, incomplete collection, a stale snapshot or an unsupported stage/currency stops deployment before upload.

The same GG formulas require category 49 and RUB; current DG records satisfy these contracts. A future different category/currency fails explicitly and needs a matching widget model rather than being silently dropped. Dates use Moscow calendar days. The current day is visibly marked incomplete. See `metric-spec.json` for date-basis, revenue-mode and funnel semantics inherited from GG.

Source snapshots and credentials are not committed. Only generated HTML, freshness stamp and an aggregate manifest are published. Client titles, contact fields, task subjects and raw comments are excluded; refusal reasons use the CRM enum or “Указана в CRM” when only a free-text comment exists. Manager names and operational CRM IDs remain, as in GG. `noindex,nofollow` is not access control.

The existing Pages schedule is retained. Each deployment collects DG again. The manifest records the exact GG template SHA-256, collection timestamp, source ID and counts. At the live probe on 2026-10-26 12:02 Moscow there were 45 leads, 7 deals, 6 open deals and RUB 513111 open pipeline; example 54999 belongs to the source. No won/prepayment events existed at that point. These are live CRM figures, not accounting reconciliation.

## Verification and rollback

`check-widgets.cjs` verifies pagination, source isolation, empty datasets, category/currency guards, private-text exclusion, script escaping and no-plan output against the live GG source contract. Browser checks cover all six sections, the empty previous month, manager filters/reset, metric switches and mobile overflow. The original small-dashboard files are retained for rollback but are no longer deployed. Revert this GG&DG workflow step to the earlier collector/build commands to restore the first version. Shared GG pages, their sources, CRM records and schedules are unchanged.
