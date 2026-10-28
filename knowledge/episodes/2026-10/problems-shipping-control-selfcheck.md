# Problems: FBS tariff and delivery source repair, 2026-10-28

Scope: user asked to add operational shipping controls and repair Google delivery data stuck at 22.10, then supplied the expanded FBS cabinet harvest. Main is not changed until separate merge approval. No seller settings, prices or logistics spreadsheet cells are modified.

## Sources and findings
- Cabinet file (local, read-only): `/Users/gengroup/Documents/ozon/data-cabinet/fbs_tariff_2026-10-28.psv`. 180 postings. Source price is already posting total; fact_rate fraction, cur_rate percentage points.
- Confirmed facts: 10 discounted, 6 standard, 8 surcharged. Calculated tariff effect: -10936.31 +5598.74 = -5337.57 RUB. Diagnostic source calculation, not independent reconciliation with accounting accruals. Actual commission is not modified.
- Missing final rates: 127 delivering, 7 delivered, 15 cancelled, 7 awaiting handover. The user's 156 missing rates cannot be labelled all in delivery.
- Exact steps exist on 4 of the 7 queued postings. The source omits warehouse eligibility metadata; 74/106 classification is not reproduced through an elapsed-hours guess. No inferred lost-discount money.
- Delivery: 14 unique price corrections rejected by old adapter; current full active+archive replay succeeds, 161 events since 05.10, sum593303.19 RUB, through27.10, 0 unseen. This is +37 new events versus124 previously accepted. 1 missing cost, 1 missing buyer payment, 2 undated rows remain visible limitations; no completeness claim.
- Google transport: GViz timed out in live verification; CSV export endpoint succeeds with identical validated column schema. Export first, GViz bounded fallback. Sanitized source/probe lives in local outputs only, no contacts or raw sheet content persisted.

## Verification
- Python delivery regressions: 33 passed, including replacement of primary/extra cost, full-archive requirement, identity mismatch, multiple trips, historical byte preservation, idempotence and zero safeguards.
- Python FBS importer + local hook: 10 passed, including total vs unit price, fractional vs point rates, unknown actuals, malformed input, date retention and changed historical source protection.
- Targeted TS/UI: 36 passed (24 existing Problems, 7 new FBS, 5 delivery-health).
- Full suite without sandbox IPC restrictions: 1337 passed, 3 failed. Two existing CPC allocation assertions and one existing YM Other-services assertion. The same three fail on extracted unchanged main in a targeted baseline run. Full baseline was unsuitable due fixture/symlink setup; do not claim full baseline green.
- Typecheck remains red on existing diagnostics; comparison against unchanged main reports no new diagnostic lines.
- Production builder with preview data tested separately; no generated output or snapshot committed on feature branch.
- Real-file jsdom/semantic checks used for page controls, unknowns, separate sums and Moscow dates. Desktop browser policy refuses local file URLs; no workaround attempted, pixel/browser layout is not verified.

## Deployment
1. FENIKS audit and explicit user merge approval on PR.
2. Merge; run delivery sync only on main using existing snapshot workflow. Preserve unknown-data warnings.
3. Install reviewed local publisher hook: `python3 -B tools/problems/install_cabinet_hook.py --deploy-script /Users/gengroup/Documents/ozon/deploy/run.sh --apply` from merged code. Backup is created, source spreadsheet untouched.
4. Import sanitized FBS file and publish as bot snapshot on main; daily existing publisher then imports subsequent files and commits fbs_tariff.json. No new schedule.
5. Deploy and verify public Problems page source_date28.10, tariff source facts and delivery through27.10. Rollback: revert code PR and restore run.sh.before-fbs-tariff if needed; normalized evidence retained.

## Self-check (25 points, not an auditor score)
1. Yes: data source label and confirmed-only amounts; unknown remains null.
2. Yes: exact cabinet path, Google sheet configured source, snapshot dates.
3. Yes: approved source mapping preserved; dedicated specs added/updated.
4. Yes: posting vs item quantities and percentage points distinguished.
5. Yes: GENGLASS naming.
6. Yes: Ivan owns publication; existing local harvest/publisher owns daily ingestion.
7. Partial: no invented deadline; publication waits audit, merge, collector and Pages checks.
8. Yes: Python stdlib + existing TS/jsdom; existing credentials and schedule only.
9. Yes: 24 confirmed facts and signed source-derived total; delivery source advances through27.10.
10. Yes: code/tests, audit, merge and live verification are separate checkpoints.
11. Yes: price correction key caused entire delivery source freeze; no warehouse guess on FBS.
12. Yes: preserve evidence outside rolling source window; dates prevent treating old queue as live.
13. Yes: rejected assuming all FBS eligible and appending corrected cost as an extra trip.
14. Yes: actual fact rate beats elapsed-hour inference; user source shows discrepancies.
15. Partial: audit-ledger replacement vs event identity applied; no unrelated market benchmarks.
16. Yes: existing dark dashboard styles, compact operator labels.
17. Yes: no inflated claims; financial limitations short and near source.
18. Yes: new UI/spec prose uses ordinary hyphen separators.
19. Yes: Problems tab extension, reviewable code PR; no new public page until approval.
20. Yes: discounts/surcharges/queue/unknown rates shown separately; no '156 in delivery' label.
21. Yes: malformed and ambiguous inputs fail without erasing previous evidence.
22. Yes: no unverifiable financial forecasts; no added spending or price changes.
23. Yes: empty/corrupt source, duplicates, missing fact, archive move and cost correction tested.
24. Partial: Google networking and local computer must remain available; source freshness visible.
25. Yes: code revert + local-hook backup; no destructive source edits.

## FENIKS iteration 1 correction
Return on88567fdbcd0ef469: source rows absent from ledger were not reflected in Problems coverage. Fixed: missing_keys and unseen_keys dates are excluded from verified days; undated or undateable status deficits make source window since05.10 partial; source issue counts appear beside delivery freshness and in warnings. Baseline pre05.10 remains unaffected. Four regression tests added; total targeted now40 TS +43 Python. Real preview22.10 coverage.full=false and source strip displays1 missing cost,1 missing buyer payment,2 undated rows. Four new regressions fail against unchanged baseline. Full build and11-page smoke passed before this targeted coverage correction; changed page rebuilt through same production page function and DOM tested after correction.
