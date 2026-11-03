# November layout correction: author self-check

Request: «сделай такого же формата как октябрь». Base: 767f34f. User approved this existing public dashboard's plan/finance scope and scheduled updates on 03.11.2026; consent recorded in selfcheck-ozon-november-growth-20261103.md. This correction changes presentation only. No source data, API, workflow, target, financial engine, date/cancellation formula or cabinet settings changed.

25-point self-check:
1. Existing DATA/GOAL/HYPOTHESIS distinctions retained.
2. Sources and frozen October analysis reference retained.
3. Approved metric contract unchanged: ozon-november-growth.yaml.
4. Units of goods, order turnover, payout and model profit remain separate.
5. GENGLASS/Ozon context unchanged.
6. Milestone owners preserved in compact table.
7. Milestone dates and unconfirmed completion retained.
8. Conditional ad allocation remains a scenario, no actual budget is assigned.
9. Targets remain 450 goods / 30.6m turnover / 500k profit AND 4.5% payout.
10. Checkpoints and all ten card decisions retained.
11. Prior financial interpretation unchanged.
12. Profit/cost/stock prerequisites retained.
13. Rejected strategies and alternatives retained in folded rules/history.
14. Individual card targets remain explicitly unassigned.
15. External benchmark not applicable: local presentation correction.
16. October gauge renderer/styles shared; single open outer card; first five sections in October order, initially collapsed; order row expands full-width chart; ad and price tables folded. Browser visual inspection completed. October archive dial suppression retained after visual review exposed obsolete November targets there.
17. Concrete titles, no new causal or guaranteed performance claim.
18. Existing typography retained; no new prose rhetoric.
19. October remains available as collapsed archive with its tables/controls. Historical month rendering still has five gauges; archived gauges remain hidden as before because that legacy component rolls into November with old targets.
20. Actuals/targets/date marker remain visible; financial gauges use the same renderer and existing money engine.
21. Negative profit remains negative; missing fact does not become zero; return percentage 4.5 is preserved.
22. No seller mutations, new expenditure or security change.
23. Missing/stale sources retain guards; no duplicate IDs; filters and lazy row controls exercised.
24. Existing automatic build path unchanged, no new scheduler needed.
25. Reversible code-only PR; generated HTML/data remain uncommitted; independent FENIKS required before publication.

Evidence:
- 141/141 focused tests (4 suites), including November/October simultaneous runtime, shared dial zone/date consistency, collapsed sections/order and duplicate IDs, row interaction, financial losses and missing data.
- build-katya, build-tests, build-reakciya, build-boost succeeded in isolated OUT_DIR.
- smoke: all 16 pages pass.
- verify_dashboard: ok; closed 02.11, partial 03.11 11:27, checked19/missing2, 5 metrics.
- Browser preview http://127.0.0.1:8871/katya-tests.html#november-plan: 17 goods, 1297421 order turnover, correct full-width row graph and goal charts.
- Financial engine/inputs unchanged. Prior full-suite baseline has two unrelated cpc-card-spread historical snapshot failures; no claim all repository tests are green.
- git diff --check passes.

Preview: /Users/gengroup/Documents/Codex/ozon-autonomous/november-format-preview
Logs: /tmp/november-format-*.log
Customer rework: prior version used a different arrangement despite request to match October. Corrected now; separate registry follow-up required by data-guard.
