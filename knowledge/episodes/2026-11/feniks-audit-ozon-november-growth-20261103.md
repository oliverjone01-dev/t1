# FENIKS audit: November growth on Tests

[ДАННЫЕ] Independently recalculated audit hash:1cb9385a88679b3f, identical for worktree and commit71418d8. Full branch product-change scope audited. Classification: dashboard/data presentation. This is a fresh audit of the November plan; previous automation verdicts do not apply to it.

Self-check:25 points present in `selfcheck-ozon-november-growth-20261103.md`. Product code was read only. Audit artifacts and temporary probes only were written; no publication or seller-account mutation. Claude agent write hooks are not active in this Codex subagent; role restrictions were observed manually.

## Scope and cross-checks

```
analytics-mvp/src/scripts/build-katya.ts
analytics-mvp/src/scripts/november-details.ts
analytics-mvp/src/scripts/november-finance.ts
analytics-mvp/src/scripts/november-forecast.ts
analytics-mvp/src/scripts/november-growth.test.ts
analytics-mvp/src/scripts/november-growth.ts
analytics-mvp/src/scripts/plan-tab.ts
knowledge/episodes/2026-11/selfcheck-ozon-november-growth-20261103.md
knowledge/semantic/metrics/ozon-november-growth.yaml
```

Sources: new metric contract and inherited order/date semantics; frozen source snapshotf5978ab in the separate October analysis directory; commercial-analysis.json; finance-details.json with underlying card groups/withdrawn cohort; actual generated preview finance/tests pages; calibration/checklist; full-suite and clean-baseline logs. No new finance estimator or banking reconciliation was introduced. New financial page embeds the same Money-page `skuAnalyticsData` and `anDerive` functions; net, payout and ratio are consumed, not recomputed with another business formula.

## Evidence ledger

No reproduced blocking defect remains in the audited change. Residuals below are disclosed dependencies and existing baseline failures, not silently ignored new regressions.

## Red-team probes

| Probe | Result | Runtime/source evidence |
|---|---|---|
| B1 independent historical values | PASS | All10 before/after/threshold triplets exactly match separate commercial-analysis. SKU-group October profit recomputed by summing source finance-details rows with withdrawn exclusion: max difference<0.0051rub from frozen displayed constants. Exactly8 thresholds pass. Sept/Oct units/net/payout references match independent source. |
| B2 coverage | PASS | Channel/account intersection gap, realization missing day and realization range beginningNov2 instead ofNov1 each suppress financial cumulative total; null is not displayed as0. |
| B2 zero/loss/ratio | PASS | Genuine zero remains numeric0; negative net remains negative and achievement fill stays0; zero payout keeps ratio unavailable. |
| B2 dates | PASS | AtNov8 23:30 Moscow only7 dates are closed; atNov9 00:00 exactly8. December observation caps November at30 dates; current day never enters financial cumulative fact. |
| B3 cohort/history | PASS | Existing card grouping and withdrawn policy retained. Frozen source files unmodified; history references stay fixed while live November renderer receives current source details. |
| B4 three surfaces | PASS | Actual generated financial page executes actual engine, Nov2 payout365176/net-72047.473, no JS errors. Current order fact dates stopNov1 and visibly stale. Active goal450 distinct from old409 reference in labeled collapsed October archive. |
| B5 hardcoded figures | PASS | Hardcoded analysis figures are intentionally frozen historical evidence with source/date. Live November values come from data engine; no hardcoded current actual. |
| B6 freshness evidence | PASS | Generated final page displays4.5% target, not rounded5%; source/build dates present. Old data do not show a fresh required-pace estimate. |
| B7 publication integrity | PASS | Nonfinite engine output yields visible calculation-unavailable message; missing totals do not show achievement. Calendar stages remain unconfirmed after due dates, never auto-complete. |

Reproduce from repository root:

```
node --import ./analytics-mvp/node_modules/tsx/dist/loader.mjs knowledge/episodes/2026-11/feniks-growth-runtime.mjs
python3 -B knowledge/episodes/2026-11/feniks-growth-historical.py
```

The runtime probe uses local preview output and the source module; historical probe reads the separate local analysis. It does not export raw XLSX or financial rows. Initial harness module resolution and deliberate NaN re-render invocation were corrected before final run; final probes all PASS.

## Verification

[ДАННЫЕ] Independently ran focused Vitest:140/140 PASS across November growth, forecast, details and plan-tab. Actual generated finance page executed in independent JSDOM probe without script errors. Git diff --check clean.

[ДАННЫЕ] Reviewed full unrestricted Vitest log:1486 PASS /2 FAIL,97 suites PASS /1 FAIL. The failures are both historical September references in cpc-card-spread.test.ts. Clean baseline15b4cb9 log reproduces those same2 failures (`/tmp/november-cpc-baseline.log`). Their test/helper/data inputs are unchanged by this branch, and they import none of the November modules. The full suite is not green; no new failure was observed.

Author evidence: four builders succeeded,16 standard smoke pages passed, verify_dashboard passed. Auditor separately checked actual generated extra finance page and Tests DOM. Full TypeScript check retains94 baseline diagnostics per author comparison; no new diagnostic claimed. I did not repair unrelated collector or historical September expectations in this audit.

Yandex isolation: Tests builder exits immediately for PLATFORM!=ozon (executed with PLATFORM=ym). New finance-page generation is inside existing IS_OZON branch. No Yandex data, formula or workflow file changed. Existing Money formulas and October data are unchanged; only historical presentation is archived/labeled.

## Comprehension and five stress questions

Client-facing labels distinguish goal, scenario, preliminary finance, frozen October review and live November fact. Quantities are goods, not unique orders; order turnover and payout are separate. Historical goals are explicitly called previous reference. Dates are calendar windows, not proof of execution. Comprehension gate passed on the added blocks.

1. Evidence: independent frozen-source checks and real runtime output, not only author tests.
2. Downside: missing/delayed source blocks the appropriate totals/pace; losses remain visible; optimistic milestones are not invented.
3. Resources: stage owners are operational roles and dependencies; showing the plan does not authorize actual campaign or price changes.
4. Missing dependency: current orders coverNov1 while finance coversNov2. Different populations/date bases are explicit. Cost completeness and accounting reconciliation remain unconfirmed.
5. First decision question: what is target versus actual and can we trust completion? Goal/fact/date/coverage/quality are visible; numerical achievement is never treated as confirmed financial completion.

## Score and residuals

Accuracy9, actionability8, insight9, brand8, risk9. Weighted =9*.25+8*.25+9*.20+8*.15+9*.15=8.6.

anchor:8.9 annotate-after-rework - current8.6: runtime attacks and external frozen-source values agree; current order lag, provisional finance and unrelated baseline failures are explicitly retained.

GO applies to this presentation/goal implementation at the audited hash. It does not certify final November profitability, causal effect of October experiments, completion of planned seller changes, or the health of delayed collectors. The two existing September tests remain a separately scoped maintenance issue.

AUDITED: 1cb9385a88679b3f
VERDICT: go
