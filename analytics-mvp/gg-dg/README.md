# GG&DG

Dashboard for CRM source **Заявка с ДГ** (`UC_NQ3QUI`), published at `/gg&dg/` by the existing shared GitHub Pages workflow.

## Build

Requires Node 22 and existing `B24_WEBHOOK_URL` secret. The collector only invokes read methods. It fetches every page, validates counts, joins deals by `LEAD_ID`, and deduplicates deal IDs. Source identity is checked against the live CRM dictionary before collecting.

```sh
node --test analytics-mvp/gg-dg/metrics.test.cjs
node analytics-mvp/gg-dg/fetch.cjs /tmp/gg-dg-snapshot.json
node analytics-mvp/gg-dg/build.cjs /tmp/gg-dg-snapshot.json '_site/gg&dg'
```

No data or credentials need to be committed. Only the generated, allowlisted snapshot is deployed. Customer titles, names, contacts, addresses and comments are excluded. The webpage has `noindex,nofollow`, like an operational dashboard; this is not access control.

The existing deployment schedule is retained. Every Pages deployment collects a new CRM snapshot. A collector error, source mismatch, duplicate ID or incomplete pagination stops publication. A loaded snapshot older than 24 hours is visibly marked. No new timers, CRM writes or messages are created.

## Metric definitions

See `metric-spec.json`. Dates use Moscow calendar days. A lead cohort is selected by creation date. Conversion is the proportion currently converted in that cohort, not a ratio of unrelated period counts. Leads and deals use their own current assignees. Open pipeline is CRM opportunity by currency; it is not payment revenue. Null amounts are not silently replaced by zero.

Initial probe on 2026-10-26 found user-supplied lead **54999** with the exact source. At 11:00 Moscow: 44 leads, 5 currently converted, 7 deals, 6 open, RUB 513111 open pipeline. The two earlier direct-source deals have original leads outside the current source-filtered lead population; they are correctly included as deals, not fabricated as additional eligible leads. Figures change with the next live collection.

Technical reference: [Bitrix lead list](https://apidocs.bitrix24.ru/api-reference/crm/leads/crm-lead-list.html), [Bitrix deal list](https://apidocs.bitrix24.ru/api-reference/crm/deals/crm-deal-list.html). These supported legacy read methods match the existing ROP connector. No claim of bank or accounting reconciliation is made.

## Rollback

Revert the added GG&DG build step in `.github/workflows/deploy-pages.yml` and redeploy the shared site. Existing ROP collectors and routes are unchanged. The feature has no CRM mutations or database migrations.
