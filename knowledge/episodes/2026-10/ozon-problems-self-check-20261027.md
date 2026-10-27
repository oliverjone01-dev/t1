# Problems page - author self-check

Scope: user requested new dashboard tab from 27.10 TZ. Default previous Mon-Sun; eight blocks, daily data, weekly breakdown, posting table and CSV. User approved dates/gross/cohort in chat. PR527. Publication awaits independent gate and merge approval.

Known limits explicitly visible: customer delivery reschedules and late deliveries remain unknown until two daily observations and promise/fact field semantics confirmed. Actual-handover delay percentage unavailable; count of Ozon-registered SELLER_DELAY is shown instead. Finance charges and index charges do not add together. No independent bank/document reconciliation claim. Source-specific row-backed diagnostics, not accounting profit.

| # | Check | Result / evidence |
|---|---|---|
|1|Figures tagged|Yes: DATA banner, nulls and source coverage; unverified metrics not calculated|
|2|Verifiable source|Yes: probe runs40513272890/40514100457/40514708838/40515894955; source contract doc|
|3|No conflict with source|Yes: specialized index date semantics used, generic shifted history excluded|
|4|Terminology|Yes: posting vs unit; return goods vs refund; cohort cancellation|
|5|Brand|GENGLASS, Ozon|
|6|Owner|Manager review by Ivan; daily collector in GitHub|
|7|Deadline|No invented deadline; first-source import and postmerge collection before publication|
|8|Resources|Existing Seller secrets, batch methods; no per-order cabinet crawl or logistics mutations|
|9|Metric|Approved metric spec, common model, explicit FBS-family numerator/denominator|
|10|Milestone|Draft PR, local preview, source probes, audit before merge|
|11|Nontrivial|Separates Defect penalties from FlexiblePayments and legacy other bucket|
|12|Second order|No cross-metric loss total, one posting may show multiple problems|
|13|Alternatives|API rating/history excluded due one-day attribution difference; use specialized index|
|14|Usability|Eight cards, graphs, weekly summary, clickable problem filter, export|
|15|Cross-source|Document-family reconciliation absent; not claimed; raw/logistic ledger consistency only|
|16|Voice|Simple Russian labels|
|17|Anti-slop|No inflated promises or synthetic financial claims|
|18|Dash|No U+2014 in new content|
|19|Output|Native dashboard navigation, source code only; temporary HTML outside repository|
|20|Audience|Manager can choose week, filter issue and download specific orders|
|21|Downside|Missing payment excluded from delivery loss; missing timestamps not zero; API failure stops writes|
|22|P9|Every displayed value sourced; no savings/causality extrapolation|
|23|Crisis|API pagination/403/malformed rows tested; no public credentials or buyer PII|
|24|Dependencies|Daily workflow main-only, after successful order collection; auto-deploy workflow_run|
|25|Reversibility|Feature branch, no cabinet mutations, data outside fetched interval retained|

Tests: targeted Problems + posting connector tests; real first full source has4003 postings,43 return rows,50 fine events,21 defect-charge events,18 registered-delay events. Test source: collected artifact outside repo, not committed to feature branch.
Golden cabinet source rows:17.10 charge478;20.10 charge5215.50;21.10 charge6700.38. Full cabinet/specialized API window total14617.71 is same-family consistency only.

Working tree contains untracked rating seed NDJSON/JSON for local preview only; not product diff. Bootstrap daily collector obtains these automatically after merge. Reviewer must verify source files, rather than assume untracked preview seeds are deployed.
