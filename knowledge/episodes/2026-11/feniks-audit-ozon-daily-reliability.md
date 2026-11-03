# FENIKS audit: Ozon daily reliability

Class: mixed operational workflow, publication gate and dashboard delivery. Product files were read only; probes write only temporary files. Project agent hooks are not registered in this Codex subagent, so role write restrictions were observed manually.

Self-check: present, 25 points. Cross-checks: metric contract `knowledge/semantic/metrics/ozon-cabinet-funnel-delivery.yaml`, data-guard gate contract, calibration anchors, current stored capture and actual TS validator. No new financial definitions or independent financial reconciliation claimed.

Scope: all changed product paths at this hash: four workflow files, AUTOMATION.md, accept_capture.py, submit_capture.py, watchdog.py, test_automation.py. Unrelated untracked DOCX were excluded from git by the author without deletion. Independently recomputed hash after exclusion is ca2b54f4d56ec6b7; request initial b70333d7fe30ce62 was superseded only by this scope exclusion.

## Decision

RETURN. Score 7.5 = 8*0.25 + 8*0.25 + 7*0.20 + 8*0.15 + 6*0.15. One blocking operational bug; no evidence of unsafe acceptance or history corruption in probes.

anchor: 7.6 timur-activation iteration1 - current 7.5: exact gate rejects injected payloads, but failed source publication is hidden by watchdog health status.

## Evidence ledger

| Gap | Evidence | Checkpoint |
|---|---|---|
| P1: failure of cabinet publication is silently healthy | `python3 -B knowledge/episodes/2026-11/feniks-ozon-probes.py`: each latest cabinet failure, cancelled, timed_out returns `{"action":"ok","failed":[]}`. `watchdog.py:40` excludes cabinet via WORKFLOWS[:3]. | risk_23 |

Fix: mark failed cabinet attempt as attention until superseded by a successful cabinet publication. Do not rerun unchanged rejected data; retain the last good snapshot and existing validators. Add regression covering all failure outcomes and successful later recovery.

## Red-team probes

| ID | Result | Evidence |
|---|---|---|
| A5 | PASS | Exact Receive step extracted from YAML executed with mock gh and real TS/Python validators. Valid fresh sanitized row accepted; mismatching expected SHA rejected before download. Reproducer feniks-receive-probe.py. |
| A7 | PASS | Stale, future and conflicting timestamps rejected. |
| B3 | PASS | History missing from incoming remains intact; same timestamp correction rejected. |
| B7 | PASS | Real TS validator rejects unknown secret_token/raw_report/browser_cookie fields and mismatched totals. No external API writes made. |
| D7 | FAIL | Cabinet failure returns false healthy status as above. |
| D8 | PASS | Same snapshots run attempt1 reruns; attempt2 attention. Pending source returns wait. Missing snapshots chain dispatches snapshots. |

All 12 author automation unit tests passed independently. Exact server receive shell executed successfully, including TS validator + merge + merged TS validator. Full build and external GitHub dispatch/deploy were not executed by auditor. Existing source scope and native report parser remain the validation trust boundary: typed sanitized JSON is not cryptographic proof of a native XLSX. This is the existing trusted executor model, not a newly detected bypass.

## Five stress questions

1. Evidence: source JSON validated by actual TS validator; assertions reproduced, no monetary claims.
2. Downside: failed native report keeps historical good data but watchdog currently hides its failure.
3. Resources: API chain on GitHub; native report still needs awake Mac, browser session and current chat.
4. Missing dependency: login/CAPTCHA and managed approvals remain explicit; source-to-live cannot be guaranteed unconditionally.
5. First operational question: is native source fresh, accepted and live? Current status falsely answers yes for failed ingestion, hence RETURN.

## Reproducibility and limits

Run `python3 -B knowledge/episodes/2026-11/feniks-ozon-probes.py` and `python3 -B knowledge/episodes/2026-11/feniks-receive-probe.py`. No product code edited. No git commit/push or remote mutation performed. Python YAML parser unavailable; exact receive shell execution provides direct runtime coverage of that step, while GitHub expression semantics and real scheduled run remain author/server validation work.

Git status captured before audit artifacts:
```
?? knowledge/episodes/2026-11/feniks-audit-ozon-daily-reliability.json
?? knowledge/episodes/2026-11/feniks-ozon-probes.py
?? knowledge/episodes/2026-11/feniks-receive-probe.py
```

AUDITED: ca2b54f4d56ec6b7
VERDICT: return
