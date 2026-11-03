# FENIKS: independent Ozon reliability hardening audit

[ДАННЫЕ] Audited hash independently recomputed: 9c69207e7dc09ab0. Initial request hash6b3e09d0682a5f81 was superseded by the additional provenance-label allowlist and its regression; that delta was included. This is a fresh audit, not a reused GO from the earlier automation release.

Class: gate + dashboard delivery + workflow. Self-check: `ozon-hardening-self-check.md`, all25 points present. Product code remained read-only. Only audit artifacts and temporary fixtures were written; no remote mutations or Git writes to the product repository. Codex does not activate the Claude agent write hooks, so role scope was observed manually.

## Scope

All product-change paths at the audited hash:
```
```

Read source and changed tests in full. Cross-check: existing semantic native-cabinet contract, self-check and handoff, data-guard requirements, actual stored sanitized capture, reference red-team probes and calibration anchors, GitHub primary documentation. No financial definition changed. The orders types write moved after its existing row validation; both Python merge/sort and TS latest selection now compare instants rather than ISO string order.

## Red-team evidence

| Probe | Result | Reproduction / evidence |
|---|---|---|
| A5 source guard | PASS | Exact Receive step from parsed YAML, actual TS/Python validators: fresh sanitized row accepted, wrong BASE_SHA rejected before blob download. |
| A5 publish race | PASS | Exact Publish step, actual temporary Git commits/trees, mock gh transport: main advanced after initial check; final nonforce update rejected; concurrent commit retained. |
| A6 export scope | PASS | Actual Git diff between fixture parent and publisher commit has exactly cabinet_capture.json; sole parent is checked_head. No force update accepted. |
| A7 timestamp | PASS | Fresh/stale/future/conflicting timestamp, partial-day and timezone-offset regressions passed. |
| B3 preservation | PASS | Original history and measured SKU/scheme rows preserved; shrinking or ambiguous refinements rejected. |
| B7 private-data rejection | PASS | Actual TS validator rejects raw_report, browser_cookie, secret_token unknown fields; mismatching totals; arbitrary provenance-label text. The source-provided free label class is now an enumerated allowlist. |
| D7 receipt retry | PASS | First failed run9 allows explicit attempt2. Three immediate repeat calls while only old run9 is visible retain unknown/attempt2; dispatch count remains2. Later indexed run10 in-progress or failed does not authorize a third dispatch. |
| D7 workflow isolation | PASS | First orders step is continue-on-error with timeout30; finance/realization and commit have no orders-success condition. Dispatch explicitly runs when not cancelled and on main. Exact final shell returns nonzero for failed orders, zero for all successes. |
| D7 queue guard | PASS | Exact continuation shell suppresses orders dispatch while snapshots is active; both idle permits dispatch. |
| D8 watchdog | PASS | Skipped Pages cannot hide real last publication; waiting/overdue run reports attention; ordinary active run waits; rerun start time controls timeout. |
| D11 syntax | PASS | Ruby YAML parses both changed workflows; bash -n checks every shell block after context placeholder substitution. Main-only job guards parsed and checked. |

Reproducer artifacts, run from repository root:

```
python3 -B knowledge/episodes/2026-11/feniks_hardening_probe.py
python3 -B knowledge/episodes/2026-11/feniks_receipt_probe.py
python3 -B knowledge/episodes/2026-11/feniks_hardening_data_probe.py
python3 -B -m unittest discover -s analytics-mvp/tools/cabinet -p 'test_*.py' -v
```

[ДАННЫЕ] Independently run Python suite:48 PASS. Independently run Vitest cabinet-capture, cabinet-funnel, orders-daily:40 PASS, including the final provenance whitelist case. An initial wrong node test runner invocation was corrected to Vitest; its runner error was not a product failure. An older probe expected indefinite wait for a7-hour queued orders job; the hardened implementation correctly reports attention, so a new probe uses a fresh queued run to verify no eviction.

GitHub explicitly distinguishes pre-continue-on-error outcome from successful post-override conclusion; the final workflow checks outcome, which keeps the run red while independent collectors continue. [GitHub steps context](https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#steps-context). Step continuation and positive timeout syntax match [GitHub workflow syntax](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#jobsjob_idstepscontinue-on-error). GitHub expression evaluation was reviewed against these primary docs; no claim that a local Bash harness is a GitHub-hosted runner.

## Five stress questions

1. Evidence: source validation and operational outcomes exercised through real local validators, actual Git objects, mock API boundaries and regression suites. No claims of new independent financial reconciliation.
2. Downside: invalid or stale source stays rejected; last good data remain; ambiguous dispatch cannot be blindly replayed. Ref conflict leaves main intact.
3. Resources: existing authenticated gh and browser session; no new credential requirement or widened token permission introduced. API adapters bounded; orders job/steps bounded.
4. Missing dependencies: real login/CAPTCHA, GitHub runner availability, external Ozon report validity and scheduled source-to-live completion remain operational dependencies. A full source-to-live success still needs its actual dated evidence.
5. First operational check: distinguish collected, submitted, committed and live published. Receipt intentionally does not claim live publication.

## Evidence ledger and limits

No remaining reproduced blocking gap in the audited product scope. Prior repros are resolved; no validator was relaxed to fit inconsistent native totals. Auditor did not open or export today's raw XLSX; its specific rejection remains author/source evidence, while the mismatched-total rejection class was independently exercised.

Local mocks proved payloads, object graph, method/force arguments and refusal behavior. They do not prove repository branch-protection configuration, actual GitHub API availability, or that the next scheduled native source report will be accepted. Durable idempotence assumes preserving the per-package receipt as documented; run-name reconciliation after receipt loss depends on Actions indexing. Recopying a package into a new receipt-free directory is not an approved recovery procedure.

## Score

Accuracy9, actionability9, insight8, brand9, risk9. Weighted total =9*.25 +9*.25 +8*.20 +9*.15 +9*.15 =8.8.

anchor:8.5 timur-activation iteration3 - current8.8: payload attacks, rapid retry lag and actual Git divergence probes pass; remaining source/session limitations are explicit rather than concealed.

GO applies to merging these hardened workflows and tools at the audited hash. It is not a certificate of future unattended account access or a replacement for checking the first real scheduled source-to-live run.

AUDITED: 9c69207e7dc09ab0
VERDICT: go
