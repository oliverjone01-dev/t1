# FENIKS audit: weekly November gauges

[ДАННЫЕ] Final independently recalculated hash53f908990fda1989. Initial requested hashdf8605ed7fcbf593 superseded by an author fix for the nullable finance-message defect independently reproduced during this audit. Final full scope rechecked; previous dashboard GO was not reused.

Classification: dashboard + local message-validation gate. Self-check25 and contractv2 present. Product code read only; reports/probes only written. No publication, seller mutation, new credential or permission change. Claude hooks unavailable for this Codex subagent; audit write scope observed manually.

## Full scope

```
analytics-mvp/src/scripts/november-details.test.ts
analytics-mvp/src/scripts/november-details.ts
analytics-mvp/src/scripts/november-finance.ts
analytics-mvp/src/scripts/november-forecast.ts
analytics-mvp/src/scripts/november-growth.test.ts
analytics-mvp/src/scripts/november-growth.ts
analytics-mvp/src/scripts/november-layout.css
analytics-mvp/src/scripts/november-periods.test.ts
analytics-mvp/src/scripts/november-periods.ts
analytics-mvp/src/scripts/november-weekly.client.js
analytics-mvp/src/scripts/plan-tab.test.ts
analytics-mvp/src/scripts/plan-tab.ts
analytics-mvp/src/scripts/plan-tab/gauge.client.js
knowledge/semantic/metrics/ozon-november-growth.yaml
```

Sources cross-checked: inherited metric definitions and updated period contract, author self-check, actual generated Tests/finance/Money pages, raw local campaign daily source, original shared gauge at805fd2e, role/checklist/calibration. Monthly goals and cost/tax/ADM engine unchanged. Weeks chosen as requested alternative:01-07,08-14,15-21,22-28,29-30November.

## Reproduced defect and correction

At initial hashdf8605ed7fcbf593, a correctly bound same-origin frame message with period.fact=null, ratio=0, missing=[] passed validation: JavaScript null divided by plan equals0. Parent then displayed both missing fact and red «сильно отстаём». This violated the missing-is-not-zero/status contract.

Author added explicit Number.isFinite(p.fact) to the non-null branch and a regression. At final hash53f908990fda1989 the identical adversarial message is rejected; genuine frame data still accepted and genuine measured0 remains0. This is a resolved finding, not a waived gap.

## Red-team probes

| Probe | Result | Evidence |
|---|---|---|
| A5 bridge identity/schema | PASS | Wrong sourceWindow, wrong origin, stale today, wrong goals and malformed nullfact/ratio0 rejected on actual generated parent. Valid actual generated finance payload accepted. |
| B1 actual profit | PASS | Actual frame period1 fact exactly equals direct existing Money-page skuAnalyticsData({from:Nov1,to:Nov2}) followed by anDerive, executed separately. No cumulative-profit difference used. Runtime actual net-74817.27299999999. |
| B1 actual ads | PASS | Parent total118998 equals raw local ads_daily campaign sum Nov1-2 (CPC+CPO). No SKU allocation added. |
| B2 period arithmetic | PASS | All30 dates occur exactly once, lengths7/7/7/7/2. Full weekly plan sums equal monthly450/30.6m/500k within floating precision.17goods /30 planned goods for2closed dates =56.6667%; entireweek105 remains distinct. |
| B2 missing/zero/loss | PASS | Missing expected date makes fact/ratio unavailable. Genuine0 yields0, including schema bridge. Loss remains negative. Future/newly closed unknown days are not zero-filled. |
| B3 source/cohort | PASS | Existing order/source definitions and cohorts retained. Helpers consume daily facts and explicit gaps. Finance invokes source engine directly for each week and preserves coverage guard. |
| B4 controls/compatibility | PASS | All5week buttons select matching window; future/unknown facts clear. Shared nonneutral gauge remains byte-identical to805fd2e on54 null/negative/boundary/overachievement/date-mark/high-is-bad cases. |
| B6 clock | PASS | Old HTML loaded at Moscow midnightNov8, following midnightNov9 and December chooses correct week/lastwindow; unavailable new dates stay null. Date on message must match parent date. |
| B7 advertising truth | PASS | Ads gauge neutral: no needle, percentage score or overspend verdict; fact-only label and no invented limit. Financial totals retain preliminary caveat. |
| D11 actual runtime | PASS | Parent and finance generated HTML execute without JS errors. Eager bound frame supports top profit while detailed finance section stays collapsed; request/response is same-origin. |

Reproduce from repository root:

```
node --import ./analytics-mvp/node_modules/tsx/dist/loader.mjs knowledge/episodes/2026-11/feniks-weekly-runtime.mjs
node --import ./analytics-mvp/node_modules/tsx/dist/loader.mjs knowledge/episodes/2026-11/feniks-weekly-schema.mjs
```

Probe reads local preview and raw campaign totals, keeping detailed financial rows local. It dispatches synthetic MessageEvents to the same bound-frame identity and compares genuine producer output independently to Money-page engine output. Initial rounded expected net guess in the probe was replaced by direct engine comparison; no product output was adjusted to an invented value.

## Verification and evidence ledger

No remaining reproduced blocking gap. Independent focused Vitest after final correction:149/149PASS in5suites. Includes direct per-week finance calls, missing/vs-zero, clock rollover and source/target schema tests. Git diff --check clean.

Author evidence:4builders successful,16standard pages smokePASS, cabinet verifyPASS. Previous full-suite baseline has two unrelated historical September cpc-card-spread failures; no unnecessary full rerun and no claim all repository tests are green. The source date, finance quality and accounting reconciliation limitations remain unchanged.

## P9, comprehension and stress questions

Labels explicitly distinguish plan for expected closed dates from full-week/monthly target. The final two-day window is explicit. Advertising says total CPC+CPO without overspend evaluation. Profit is provisional, not bank-verified or a promise. Existing user authorization covers public metrics; no seller action is introduced.

1. Evidence: raw campaign aggregate, independent actual Money-page result, generated frame and strict schema attack.
2. Downside: incomplete/new dates suppress verdict; loss staysnegative; unavailable frame eventually shows visible failure instead of fabricatedprofit.
3. Resources: existing build/data engine reused, pure period helper shared, no new service credential.
4. Missing dependencies: source completeness, source clock and same-origin frame must agree; stale message rejected. Automatic refresh remains existing build/load behavior, not a guaranteed live open-tab midnight timer.
5. First operational question: what is100%? Plan for the same expected closed dates of the selected week, with entireweek goal separately shown. Unknown dates never make2observed days appear to satisfy7days.

P9 hard rules pass: sourced actuals, labeled goals, no assigned ad budget, no new financial model, unsupported causal claim, ROMI promise or campaign mutation. Numeric completion remains provisional; financial reconciliation is not asserted.

## Score

Accuracy9, actionability9, insight8, brand9, risk9. Weighted9*.25+9*.25+8*.20+9*.15+9*.15=8.8.

anchor:8.9 annotate-after-rework - current8.8: runtime/source/clock and malformed-payload attacks pass after a concrete correction; provisional finance and source availability remain explicitly bounded.

AUDITED: 53f908990fda1989
VERDICT: go
