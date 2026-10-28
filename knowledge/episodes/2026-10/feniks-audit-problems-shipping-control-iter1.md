# FENIKS: Problems shipping control, iteration1

[ДАННЫЕ] Independent audit of all product paths in worktree88567fdbcd0ef469 on base b5f799e2. Product code and real publisher were not modified. Only audit files and temporary fixtures written.

Verdict: RETURN, 8.00/10. Monetary source arithmetic is correct; delivery coverage reporting needs correction before publication.

## Comprehension and scope
Internal operational dashboard with public hosting. Discount/surcharge vs fines separate; unknown rates stay unknown, stale queue date visible. No inferred rate from elapsed hours and no156-in-delivery claim. Verified all changed/untracked product files including importer, installer, CI, specs, tests, HTML/model/client/data and delivery adapter.

## Five stress questions
1. Evidence: raw PSV independently recalculated; Google sanitized replay status independently compared with rendered data.
2. Downside: a missing shipment cost could understate losses while full coverage conceals the gap; current blocker.
3. Resources: Python stdlib, existing Node/jsdom and local publisher, no additional paid services.
4. Forgotten dependency: full browser pixels unverified; Google/local publisher availability remains visible risk.
5. Investor/manager answer:10 discounts,8 surcharges,6 standard; net estimated tariff effect5337.57 RUB saving among24 confirmed, not a full-period accounting result.

## Verification
Independent rerun43 Python and36 TypeScript tests pass. Own fixture attacks: delivery cost replacement, idempotence, partial replay, non-price mismatch, ambiguous second trip; installer actual-script fixture with original backup and bash syntax. Independent raw/source/model/UI comparison on3 periods passes. Parent full-suite evidence1337pass3fail inspected alongside baseline3same failures78pass; not claimed green. Production build/smoke logs reported successful. No private contacts/source API JSON exported.

## Evidence ledger
| Gap | Evidence | Checkpoint |
|---|---|---|
| Problems does not carry missing-cost/undated source rows into warnings and coverage; 22.10 falsely receives full delivery coverage. | outputs/problems-preview-data/delivery_sheet_state.json missing_keys=[[78945257-0523-1,2026-10-22]], undated_rows=2; generated HTML model summarize(...,2026-10-22,2026-10-22).metrics.deliveryLoss.coverage={n:1,total:1,full:true}. data.ts:24-35 only examines accepted ledger rows. | accuracy3, risk22 |
| Pixel rendering/live deploy unverified | Local URL policy refusal; jsdom is semantic only; real installer unactivated | actionability10 |

## Red-team
| Probe | Result | Evidence |
|---|---|---|
|B1|PASS|Independent Decimal recalculation from raw cabinet PSV: 180 observed, 24 confirmed, discount10936.31, surcharge5598.74, net-5337.57 RUB. No financial accrual claim.|
|B2|PASS|September closed:0 rows/null; October18-22:91 rows/23 facts/9724.67 discount/5598.74 surcharge; October1-28:180/24/10936.31/5598.74. Raw Python vs model vs jsdom agree.|
|B3|PASS|180 unique posting keys. Duplicate source rejected. Full delivery replay unique correction replaces one event; repeat idempotent; ambiguous groups/partial replay rejected.|
|B4|FAIL|Delivery status missing_cost=1 and undated_rows=2 absent from Problems warnings. Missing date2026-10-22 still coverage n1/total1/full:true.|
|B5|PASS|New monetary totals all derived; ladder rates explicitly source contract/user input and only source step rows. No hardcoded180/24/10936 totals in UI.|
|B6|PARTIAL|Fresh generated HTML and source date28Oct verified semantically. Pixel/browser layout not verified due local URL policy; no workaround.|
|B7|FAIL|Uncertain delivery completeness leaks to published HTML: source missing_keys contains [78945257-0523-1,2026-10-22], summarize deliveryLoss full:true on22Oct.|
|A1|N/A|No approval/security gate altered. Installer is exact anchored text patch, not permission enforcement.|
|A5|PASS|Installer exercised against temporary copy of real publisher: exact patch, backup original, idempotence and bash -n pass; real publisher untouched.|

##25 checkpoints
|Checkpoint|Score|
|---|---|
|accuracy_1_figures_tagged|2/2|
|accuracy_2_sources_verifiable|2/2|
|accuracy_3_no_conflict_with_rag|0/2|
|accuracy_4_glossary_terminology|2/2|
|accuracy_5_brand_names_correct|2/2|
|actionability_6_owner_assigned|2/2|
|actionability_7_deadline_buffer|1/2|
|actionability_8_resources_listed|2/2|
|actionability_9_metric_concrete|2/2|
|actionability_10_milestone|1/2|
|insight_11_nontrivial|2/2|
|insight_12_second_order|2/2|
|insight_13_alternatives_analyzed|2/2|
|insight_14_anti_median|1/2|
|insight_15_cross_domain|1/2|
|brand_16_voice|2/2|
|brand_17_anti_slop|2/2|
|brand_18_no_em_dash|2/2|
|brand_19_output_routing|1/2|
|brand_20_tone_audience|2/2|
|risk_21_downside|2/2|
|risk_22_p9_hard_rules|1/2|
|risk_23_crisis_scenarios|1/2|
|risk_24_dependencies|1/2|
|risk_25_reversibility|2/2|

Scores: accuracy8, actionability8, insight8, brand9, risk7. Weighted2+2+1.6+1.35+1.05=8.00. B7 override requires return.

anchor: 6.7 dialogs-registry ->8.1 after repair: this artifact at8.0 has verified source totals and dedup but a remaining coverage disclosure defect. Verdict return overrides arithmetic score.

Rework: Propagate missing_cost, undated_rows and retained_unseen source limitations to visible delivery freshness/warnings. Exclude known missing-key dates from delivery coverage. Unknown-date/unseen uncertainty must prevent false full coverage. Add regression tests on this source fixture and re-audit new hash.

AUDITED: 88567fdbcd0ef469
VERDICT: return
