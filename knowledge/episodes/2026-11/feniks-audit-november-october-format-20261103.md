# FENIKS audit: November in October format

[ДАННЫЕ] Independently recalculated hash112317a7d7b7e6d5; commit145ecaa. Initial staged hash7e2c37dfc9aa661a superseded by hiding the legacy archived rolled-November gauges and adding an explicit gauge legend. The final delta was included. Full product scope audited; no reuse of prior GO.

Self-check25 present. Classification: dashboard presentation. Applicable CLAUDE Step12.5/data-guard and P9 hard rules reviewed. Product code read only; only audit artifacts/temporary fixture were written. No publication, money operation, price/campaign or account mutation. Role write restrictions observed manually because Claude agent hooks are not installed for this Codex subagent.

## Scope

```
analytics-mvp/src/scripts/november-details.client.js
analytics-mvp/src/scripts/november-details.test.ts
analytics-mvp/src/scripts/november-details.ts
analytics-mvp/src/scripts/november-finance.ts
analytics-mvp/src/scripts/november-forecast.test.ts
analytics-mvp/src/scripts/november-forecast.ts
analytics-mvp/src/scripts/november-growth.ts
analytics-mvp/src/scripts/november-layout.css
analytics-mvp/src/scripts/plan-tab.test.ts
analytics-mvp/src/scripts/plan-tab.ts
analytics-mvp/src/scripts/plan-tab/gauge.client.js
analytics-mvp/src/scripts/plan-tab/plan-tab.client.js
knowledge/episodes/2026-11/selfcheck-november-october-format-20261103.md
```

Cross-checks: current metric contract and self-check; base767f34f original October gauge; staged source diff; actual generated final preview; inherited live-data engine and date guards; calibration/checklist and known full-suite baseline. Source data, financial formulas, targets, workflow/scheduler and Yandex paths unchanged.

## Independent runtime and red-team evidence

| Probe | Result | Evidence |
|---|---|---|
| B1 calculations | PASS | Finance changes confined to shared gauge/CSS and card presentation. Existing skuAnalyticsData/anDerive calls and date/coverage rules unchanged. Forecast arithmetic remains unchanged. |
| B2 finance edge cases | PASS | Actual new renderer with sentinel engine: true0 remains0; loss stays negative; no coverage yields missing gauge fact; zero payout retains undefined profitability; target remains4.5%, not rounded5%. Three financial gauges present without script errors. |
| B3 IDs/cohort | PASS | Actual Tests page has unique IDs, existing cohort/order values; every order row expands full-width colspan5 graph and closes. No source data mutation by controls. |
| B4 old/new gauges | PASS | Shared gauge output byte-identical to base October gauge on54 scenarios:9values including null/negative/thresholds/overachievement ×3 date marks ×2 high-is-bad modes. Two active November gauges; five legacy October gauge nodes still calculate for old controls, but rolled archive is display:none and cannot advertise obsolete409/27.3m as current goals. Historical-month fixture still renders5 gauges. |
| B5 new aggregates | PASS | Price state bars count existing price rows under explicit below/equal/above/no-fresh-comparison buckets. They do not invent decisions or thresholds. |
| B6 format | PASS | One outer details open, first5 sections collapsed in October order; ads/price tables folded, sections6finance/7decisions/8stages retained; pointer/date-mark/color legend explicit. |
| B7 honesty | PASS | Negative/missing facts and unconfirmed stage labels retained. Calendar status does not become execution status. No new budget assignment or financial achievement claim. |
| D7 controls | PASS | Every new order toggle, funnel card/metric selection, every price chart toggle, old October breakdown pill and metric button exercised without runtime errors. |
| D11 runtime | PASS | Independently ran141 focused tests PASS. Actual generated Tests page JSDOM has no script errors or duplicate IDs. |

Reproduction from repo root:

```
node --import ./analytics-mvp/node_modules/tsx/dist/loader.mjs knowledge/episodes/2026-11/feniks-format-runtime.mjs
```

Focused suite, from analytics-mvp:

```
npx vitest run src/scripts/november-growth.test.ts src/scripts/november-forecast.test.ts src/scripts/november-details.test.ts src/scripts/plan-tab.test.ts
```

Audit probe executes actual generated Tests markup/scripts and dynamic controls; edge-case finance fixtures use the actual new renderer plus sentinel existing-engine output. Original gauge baseline is obtained with git show767f34f and compared against the shared renderer directly. This checks unchanged presentation behavior rather than mirroring the implementation in test logic.

## Evidence ledger and limits

No reproduced blocking gap. Parent browser evidence confirms full-width graph and visible format; auditor's separate IAB entry was unavailable, so no claim of an independent pixel screenshot inspection. DOM structure, CSS namespace and exact gauge renderer comparison provide independent structural/runtime evidence.

Author evidence: four builders succeed,16 standard pages smoke PASS, cabinet verify PASS. Existing full-suite baseline contains two unrelated September cpc-card-spread failures; no claim the entire repository test suite is green and no unnecessary full rerun performed for this layout-only scope.

Customer rework is acknowledged in self-check. Author reports registry follow-up E103 isolated in separate PR579 under data-guard; that PR is outside this UI artifact's audit scope.

## P9 and five stress questions

1. Evidence: data/targets inherited unchanged, actual page controls exercised, shared gauge compared byte-for-byte against original source.
2. Downside: source gaps retain missing facts, losses remain visible; hidden legacy November targets prevent confusing old/current goals.
3. Resources: existing builders/scripts and shared CSS/renderer; no new account permission or automation dependency.
4. Missing dependencies: real source updates and preliminary financial quality unchanged; shared-renderer extraction now has old/new simultaneous runtime coverage.
5. First decision question: does the page show the same recognizable structure with honest numbers? First5 sections/order, dials and folds match October patterns; extra finance/decisions/stages remain separate and unconfirmed.

P9 hard rules pass in this change: no unsourced new financial estimate, spend decision, guaranteed upside, causal inference, ROMI promise or seller mutation. Existing conditional scenarios retain their prior labels; existing user authorization covers this public composition, with no new approval required by this audit.

## Score

Accuracy9, actionability9, insight8, brand9, risk9. Weighted9*.25+9*.25+8*.20+9*.15+9*.15=8.8.

anchor:8.9 annotate-after-rework - current8.8: exact renderer and controls pass boundary attacks; independent pixel inspection unavailable and explicitly distinguished from author browser evidence.

AUDITED: 112317a7d7b7e6d5
VERDICT: go
