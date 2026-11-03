# Self-check: November growth dashboard

User request: move the October analysis and November plan into the existing Tests dashboard, showing targets and progress as in October. This is presentation of the accepted plan, not authority to modify seller campaigns or prices. Base commit: 15b4cb9. Historical analysis snapshot: f5978ab.

Contract: knowledge/semantic/metrics/ozon-november-growth.yaml. Inherited order/date/cancellation definitions are unchanged; the user explicitly requested the proposed plan. No new source/API, banking reconciliation or financial formula is introduced.

25-point author checklist (evidence, not a self-awarded score):

1. Historical review marked DATA; growth/stretch marked GOAL/HYPOTHESIS. Live financial facts explicitly provisional.
2. Frozen history source is identified; local evidence commercial-analysis.json and card-finance-analysis.json in analysis-20261103-october.
3. New spec inherits approved November/October definitions, replacing only November store targets.
4. Orders labelled quantities of goods, not unique orders; payout separate from order turnover.
5. GENGLASS/Ozon names preserved.
6. Milestones carry responsible roles; no invented completion.
7. Dates are the user's accepted November plan. No promised engineering/collection completion dates.
8. CPC baseline and conditional redistribution disclosed; no actual campaign budget assigned.
9. Targets 450 units / 30.6m order turnover / 500k net + 4.5% net/payout; financial stretch explicit.
10. Checkpoints 12 and 20 November; first wave 6-19 November.
11. ADM positive-SKU/day base explains divergence between volume and modelled profit.
12. Growth gated by profit, costs, stock and whole-card result; not higher bids for their own sake.
13. Alternatives: broad discounts and broad bid increases rejected by prior inconclusive/failed tests.
14. Decisions differ for all 10 cards; volume winners can be financially weak.
15. Cross-industry reference not applicable to a transfer of this existing analysis; not fabricated.
16. Existing dashboard visual styles retained, local layout checked in IAB.
17. Concrete labels and actions; no causal/guaranteed-profit claim.
18. New content uses ordinary hyphens; existing typography preserved where unchanged.
19. Existing Tests tab, October archived, existing November drilldowns retained.
20. Main view shows targets, actual, completion and difference; constraints shown next to numbers.
21. Negative profit remains negative, cannot create a filled positive achievement bar; zero payout makes profitability unavailable.
22. P9: proposed scenario is not a forecast or authorisation to spend; no campaign or price mutation.
23. Missing coverage blocks accumulated facts; stale order sources suppress required-pace calculation; finance failure is visibly unavailable.
24. Depends on established source pipelines, source dates visible, no claim the uploader repaired missing sources.
25. Reversible code-only PR; revert these source changes and redeploy. No raw snapshots, Google Sheets, Yandex Market or workflow changes.

Validation:
- 140/140 focused tests: november-growth, november-forecast, november-details, plan-tab.
- build-katya, build-tests, build-reakciya, build-boost succeeded in isolated OUT_DIR.
- Existing smoke: all 16 standard pages passed. New finance page separately executed in JSDOM and IAB; no script errors.
- New financial live result for 01-02 November: payout 365176; net -72047.473; rent -19.729520286108606%. Source is actual Money engine; not independently bank-reconciled.
- TypeScript baseline vs worktree: same 94 pre-existing diagnostics, no new normalised diagnostics.
- Full vitest with local IPC permitted: 1486 passed, 2 failed. Both failures are unchanged cpc-card-spread September snapshot assertions, reproduced on clean base 15b4cb9 (2 failed / 4 passed). This is not an all-green test claim. Logs: /tmp/november-full-tests-unrestricted.log and /tmp/november-cpc-baseline.log.
- Cabinet verify_dashboard passed: closed 02.11, selected partial 03.11 11:27, checked19/missing2 products, 5 metrics.
- git diff --check clean.
- Browser found a 4.5% target rounded to 5%; fixed goal percentage formatting and added a regression assertion before audit.

Runtime output: /Users/gengroup/Documents/Codex/ozon-autonomous/november-growth-preview. Build/test logs: /tmp/november-*.log. Browser preview: http://127.0.0.1:8869/katya-tests.html.

Residual: the current order snapshot covers only 01 November; latest expected closed date is 02 November. Financial dates reach 02 November. The two are explicitly separate populations/date bases. No bank/actual company cost reconciliation has been performed.
