# Problems source probes - 27.10.2026

Read-only GitHub Actions probes: 40513272890, 40514100457, 40514708838.
Local sanitized artifacts: outputs/ozon-problems-2026-10-27/probe{,2,3}/problems-probe.json (outside repo).
No customer names, addresses, phone numbers or credentials in public normalized outputs.

- /v4/posting/fbs/list: cursor/has_next, 100 per page, with.analytics_data=true exposes delivery window fields and delivery_schema. Successful sample 517 postings in 35 days. Full history collection uses Moscow ISO boundaries and preserves older rows.
- Cancellation examples: 68345134-0225-2 client, 41775708-0531-1 seller, 68345134-0226-1 ozon. Code comes from cancellation_type; Russian cancellation_initiator is not silently treated as an enum.
- /v1/returns/list: 31 rows, has_next=false, product.price.price in RUB, logistic.return_date, return_reason_name and type. Cancellation means returned unpurchased goods, not a paid-item refund. API errors must fail, not return an empty list.
- /v1/rating/summary: groups[].items[]. UNKNOWN_STATUS + numeric zero is unknown (cabinet confirms null). Preserve null.
- /v1/rating/index/fbs/info: 15 inclusive day labels, 13-27.10; 14617.71 RUB; 0.09053498 latest. Exactly agrees with cabinet daily-defect on dates/values. This is same-family consistency, not independent accounting reconciliation.
- /v1/rating/history: daily values differ in day attribution by one day against cabinet and specialized index method. Deliberately excluded, not shifted heuristically.
- /v1/rating/index/fbs/posting/list requires filter.date_from/date_to, limit and cursor. Empty filter -> 400, no false zero. Successful 21 rows. SELLER_DELAY labels confirmed errors. UNSPECIFIED does not get invented cancellation reason.
- Example 0178381801-0080-1: SELLER_DELAY at 22.10, charge 293.33; 0212256839-0404-1: UNSPECIFIED at 26.10, charge 1930.50. Index charges kept apart from finance accruals.
- /v1/finance/accrual/types: explicit names DefectRate and DefectFine* (7 types). FlexiblePayments is financing, excluded. Type94 is a penalty although old generic bucket sends it to delivery.
- /v1/finance/accrual/by-day: one day per request, accrual_id + nested fee path is unique. Negative API amount = expense; corrections keep sign. Posting number can be absent and is not distributed to unrelated orders.
- /v3/posting/fbs/get returned fact_delivery_date for one checked order. Batch list lacks this fact; per-order history crawl not performed. delivering_date is not used to invent a customer delivery fact.
- Daily active-posting promise fields are retained. No second daily snapshot yet, field semantics for changed promises not validated. Transfers and late customer delivery remain unknown, not zero.
- HTTP 400 is surfaced; retry/rate limits reuse OzonSeller retry policy. No live 429 limit encountered in initial contract probes; not claimed measured.

Limits: operational source-backed dashboard, no independent invoice/bank comparison. First rating row history 13.10 only; old days stay absent. Delivery ledger is through22.10, one missing paid value and other incomplete rows excluded visibly.
