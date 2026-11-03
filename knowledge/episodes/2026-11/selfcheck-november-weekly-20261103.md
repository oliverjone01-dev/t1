# Weekly November gauges: author self-check

User request: break the plan into weeks or ten-day periods, compare gauges with that period, add advertising spend and net profit. Chosen seven-day windows are 01-07,08-14,15-21,22-28,29-30 November. User explicitly selected: show total CPC+CPO without overspend evaluation. Existing approval to publish financial indicators and scheduled updates remains applicable; no cabinet mutations are authorised or performed.

Contract: knowledge/semantic/metrics/ozon-november-growth.yaml v2. Same order/timezone/cancellation and accrual/profit source definitions; period split requested by user. The clock/denominator change is explicit: 100% means the plan for expected closed dates in the selected week. The full-week goal is separately labelled. No new API, bank reconciliation or financial model.

25-point author self-check:
1. Monthly targets remain goals; finance remains provisional.
2. Existing sources and frozen October analysis preserved.
3. User-requested periods and neutral total-ad-spend choice recorded before publication.
4. Orders are goods, net of known cancellations, by Moscow order date; finance is accrual based.
5. GENGLASS/Ozon context remains unchanged.
6. Existing milestone owners unchanged.
7. Existing dates and unconfirmed milestone completion unchanged.
8. Advertising has no invented budget/overspend status; neutral gauge CPC+CPO.
9. Monthly goals450/30.6m/500k and profitability4.5 remain unchanged.
10. All30 dates partition once; four7-day weeks and final2-day window.
11. Calculation retains ADM/tax and cost logic from existing Money engine.
12. Pure period helpers shared by builder/client/finance renderer; no copied net-profit formula.
13. No new spending recommendation or campaign execution.
14. No invented individual-card targets.
15. External benchmark not applicable; user chose fact only for advertising.
16. Four gauges in the October-style row, period buttons and folded weekly plan table. Existing5 sections/archive retained.
17. Example17/30=56.7% for2closed days, not17/450 or17/105. Full-week105 displayed separately.
18. Clear labels for closed dates, entire-week goal and provisional profit.
19. All weeks selectable; weekly advertising table uses same boundaries as top gauges.
20. Missing/stale closed dates suppress score; a covered0 remains0. No comparison of2days against7or30days.
21. Loss/overachievement kept numerically; no fake positive profit or filled ad progress.
22. P9: no budget assigned, no bank-profit claim, no seller/permission/workflow mutation.
23. Finance window calculated directly via skuAnalyticsData({from,to})+anDerive, not cumulative differences. Bound-frame source/origin/date/payload validated. Explicit unavailable state if finance cannot load.
24. Moscow midnight reselects the week on load even if HTML is older; missing newly closed dates remain unknown. Existing daily build will update inputs.
25. Reversible code-only branch from805fd2e; source snapshots and unrelated projects untouched. FENIKS required before merge.

Evidence:
- Focused tests include week partition/sums,17/30,first-day/last2days,missing-vs-zero,stale previous week,negative profit,all four dials and week changes,trusted-frame validation, direct finance period calculation and Moscow midnight.
- Local build-katya/build-tests/build-reakciya/build-boost successful;16-page smoke passes; cabinet verification ok(closed02.11,partial03.11 11:27,checked19/missing2).
- Browser actual preview:17goods vs30;1297421turnover vs2040000;total campaign ads118998;preliminary net-74817 vs33333.33. Four gauges load with the finance section collapsed; selecting08-14 shows no data/no delay verdict.
- Monthly goals sum preserved using full precision. Table rounding explicitly disclosed.
- No claim of independent banking reconciliation. Previous full-suite baseline contains two unrelated cpc-card-spread September snapshot assertion failures.

Preview /Users/gengroup/Documents/Codex/ozon-autonomous/november-weekly-preview
Browser http://127.0.0.1:8873/katya-tests.html#november-plan
Logs /tmp/november-weekly-*.log
