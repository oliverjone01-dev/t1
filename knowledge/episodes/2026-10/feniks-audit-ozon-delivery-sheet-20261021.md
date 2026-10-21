# Independent audit: Google delivery sheet and Performance calendar boundaries

**8.10/10, return** on `ab7094cf6dc450b6c6b98919fe15a40294569e37`, hash `9eaf420560f75c3e`. Independent Codex review by the FENIKS role; not Claude/Opus.

All15committed changed paths were reviewed. Approved cost/paid/window and repeat-trip decisions were read before probes. No product/data/main/ref/memory modifications by the reviewer. Existing user approval of the metric contract is respected; this return is about two reproducible completeness bugs, not a request to reapprove fields.

## Blockers

1. **Known disappeared trip is forgotten by the warning state.** Import one priced trip5691, then perform a full read with the trip absent: expense is correctly retained and retained_unseen_events=1. Next active-only read still does not contain the trip, but retained_unseen_events becomes0, archive_needed isFalse and allfive incompleteness flags are0. A fresh read does not establish recovery of the missing source row. The unresolved identity must remain in state until observed/resolved; daily skip of archive cannot certify its absence as repaired.
2. **Positive bill becomes explicit zero without an alert.** After the same import, an active row with the sameorder/date but cost0 is skipped. The previouslyaccepted5691expense remains by append-only policy. zero_cost_rows=1, but all five missing/retained flags are0. I generated the actual outputs/status and imported the real sourceHealth: it returns **statusok** with a currentdate and all counts0. A firstseen zero can be a valid nonexpense; a priorpositive-to-zero transition is a known conflicting change and requires a separate unresolved warning/review.

Both cases use immutable source snapshots from ab7094cf, synthetic source rows, no network and temporary output only. Reproduction: `python3 -B /private/tmp/ozon-delivery-audit/focused-probes.py` from repositoryroot; `node --import tsx .../health-probe.mts` from analytics-mvp. Evidence/scripts are copied into `feniks-probes-ozon-delivery-sheet`. No new product code was written.

A date7->8 change for the sameorder/cost also produces2events and11382expense, with one retainedunseen warning. Under the approved key this is ambiguous between correction and genuineextra trip; expense must not be erased automatically. At minimum the warning must persist, so the first blocker also covers safe presentation of this case.

## What passed

- Independently executed25Python regressions and58TS targeted tests: allpass. These include historybytepreservation, initial/replayed import, archive moves, duplicatekey merging, priceambiguity, extra trips, nullpayments, centconservation, safeerrors/city and tempfile failure.
- The old24combined-trip baseline is not repartitioned; historical lines through04Oct and originalextra trips remain exact prefixes. New repeats are separate extra-trip entries and do not modify oldorder ship.
- Shared event_articles keeps the existing XLSX soldcomponent/parent rule. Currencyamount and paidNone semantics remain separate; no tax/COGS/deliveryincome formula changed here.
- Raw contacts/addresses are not serialized. Publiccity is selected from the explicitroute whitelist; inputerrors do not echo sourcevalues. Unrecognizedcities remain in expense under a safe label.
- API timezone fix is supported independently: I fetched metadata and actual log of read-only run39603979177. Campaign45812525: UTC20rows,last19Oct,outside19Oct versusMSK16,last18Oct,outsideempty. Campaign40015169: UTC8,last19Oct versusMSK7,last18Oct,outsideempty. This agrees with the committedsourceproof. The default transport now sends +03:00 and realfetchbody tests cover one day,7days and yearboundary. No filtering-away of outside rows replaces the corrected boundary.
- Filehash/status logic detects partialreplacement; tempwrites+fsync precede rename. The absence of one filesystem transaction is explicitly disclosed. No productiondelivery import is claimed yet.

## Eight data-guard steps

1. Pre-mortem E009/E010/E011 duplicate/trip and E001date risks read in sourceprobe; priorE027 falsefreshness risk is the current reproducedfailure.
2. Approved spec and userwindow05Oct, allsix-tab review, primary/archive roles and decision02Oct respected.
3. Source schema/goldens/source93events are documented; pairedliveAPI evidence independently read. Sheet data is not independent proof of actualcarrier invoices.
4. 25+58tests pass, but independent two lifecycle probes reveal incomplete state invariants.
5. Threeperiod financial reconciliation is not fabricated: newwindow05-20Oct and exactlegacyhistory are the tested contract; fullproduction/import/invoicecheck remain separate.
6. Claims distinguish code/sourceform proof from productiondata recovery. Healthy status for a knownconflict is not accepted.
7. Return tied to independentlycomputedhash `9eaf420560f75c3e`; request newhash after rework.
8. Blockers sent to author with exactcommands/evidence; no memory/registry or product edited by auditor.

## Five questions

1. Proof: immutable module snapshots, real sourceHealth consumer, own tests and fetchedliveAPI log.
2. Downside: expense preserved while unresolved source discrepancy disappears from UI; apparentfreshness can hide stale or ambiguous cost.
3. Resources: existing Pythonstdlib/Actions; bounded3retries/45s/8MB and weekly/gap recovery, no newcredentials or sharing.
4. Forgotten surface: unresolved event identities must survive daily/archive transitions, including positivebill->zero.
5. Short answer: history and TZ transport are protected in coveredcases; complete-looking delivery status is still reproduciblywrong.

## Red-team probes

|ID|Result|Evidence|
|---|---|---|
|H1|PASS|Independently hash --rev ab7094cf=9eaf420560f75c3e; all15branchpaths reviewed. Product/data/ref/memory not changed by reviewer; immutable Python/TS snapshot for faultprobes.|
|B1|PASS|Approvedspec5goldens/six-tab mapping and sourceprobe read; author source93events362861.87 not misrepresented as independent carrier-invoice reconciliation. Actual pairedAPI runmetadata/log independently fetched readonly.|
|B2|PARTIAL|New delivery05-20Oct scope; legacy up to04Oct is preserved by tests and code. No production Google importer yet and no independent carrier invoice family available; threeperiod financial reconciliation not claimed.|
|B3|PASS|25Python regressions independently pass: complete eventkey/order+date+cost; copiesmerge, distincttrips separate, cent splits conserved; old24 combined-trip baseline not repartitioned.|
|B4|FAIL|Real sourceHealth on zero-bundle returns Google delivery statusok with allmissing counters0 although current source bill0 and retained expense5691 disagree.|
|B5|PASS|Sourcewindow05Oct and Moscow offset are approved contract constants, not fabricatedmoney; no usermetric hardcodes added.|
|B6|PASS|Independent API run39603979177 success metadata at9ff3951d and actual log confirm pairedUTC/MSK DATE effect; transport body tests now capture realfetch arguments including year-boundary.|
|B7|FAIL|Authoritative full-read missingevent warning1 becomes0 on next active-only run without recovery; explicit priorpositive->zero change also hides known discrepancy. Both produce currenthash-valid outputbundle and apparentlycomplete status.|
|P1|PASS|Own25Python tests and58targetedTS tests pass; sharedarticle rule, baselinebytepreservation, repeats/extra trips/invalidheaders/dates/money/stagefailure covered.|
|P2|FAIL|focused-probes.py: fullretained1 -> daily0, archive_neededFalse, expense5691unchanged; anothercase priorbill5691 -> source0 retains5691 with all5incompleteflags0.|
|P3|PARTIAL|Changing shipmentdate7->8 for sameorder/cost retains oldevent and addsnewcost(5691->11382), warningretained1. Ambiguous correction vs true additionaltrip under approvedkey; requires persistent warning/manual investigation, not silent deletion.|
|P4|PASS|Actual paired log:45812525 UTC20rows ends19Oct/MSK16 ends18;40015169 UTC8 ends19/MSK7 ends18. Both+03outsideempty. Strict outputwindowguard retained, no clipping workaround.|
|P5|PASS|Publiccity is canonicalroute-whitelist only; safe outputevent schema excludes rawaddress/contact/comment. Error masks values. Existingprivacyfixtures pass; source state whitelist imported from declaredroutecolumns.|
|D1|PASS|No selfclaimed audit score in product/selfcheck.|
|D2|N/A|Noagentdelegation changes.|
|D3|N/A|Noagentfrontmatter changes.|
|D4|PASS|JSON auditreport and trace schema validated before delivery;25checkpoints and weighted8.10 verified.|
|D5|N/A|No roles/tiers changed.|
|D6|N/A|No skilltrigger changes.|
|D7|PASS|Sheetsadapter fails before writes on invalidsource; workflow recordsfailure and retains olddata. Eachtempwrite+fsync precedes renames; statuslast withhashes detects partialbundle, noallfiletransaction claimed.|
|D8|PARTIAL|45sHTTPtimeout,3boundedretries,8MBcap; archiveweekly/36h/unresolvedcosts. Knownunseen/zero conflict missing from persistent scheduler state causes currentblocker.|
|D9|PASS|NoAPIsecrets or sourcecontacts read into report, no workflowdispatched byreviewer; readonly retrieval of existing pairedlog only. Ignore temporary stagingdir preventspartialtemp artifacts from gitadd-A.|
|D10|N/A|NoCowork runtime changes.|
|D11|PASS|Python25 and TS58 execute on changedmodules; workflownewstep simpleboundedcommand and branch main restriction retained; CIaddedPythonrun. FinalfullCI remains separate from scopedindependentresults.|

## Score

|Criterion|Score|Weight|Contribution|
|---|---|---|---|
|accuracy|9|0.25|2.25|
|actionability|8|0.25|2.00|
|insight|8|0.2|1.60|
|brand_fit|9|0.15|1.35|
|risk_awareness|6|0.15|0.90|

2.25+2.00+1.60+1.35+0.90=8.10. FAILB7 requires return regardless of numericalthreshold. Checkpoint25 vector is inJSON.

anchor: 8.1 reestr-go is nearestnumeric anchor, but our8.10 verdict is return due FAILB7: preserved data do not make an unresolved source conflict complete. Mechanically closer to7.9 timur-return: most protections are real, one reproducible bypass still exists. Higher than original collector7.6 because historical money is preserved rather than deleted.

## Evidence ledger

|Gap|Evidence|Checkpoint|
|---|---|---|
|BLOCKER: full-source disappearance is not persisted in state. After one full warning, a normal active-only read clears retained_unseen_events without recovery and does not force archive verification.|focused-probes.json retained-warning-clears-without-recovery: first1,next0,archive_needed_nextfalse,expense5691both; nextstate lacks persistentunseenkeyset.|risk_21|
|BLOCKER: an accepted positive bill becoming explicit zero is skipped before event merge; oldexpense remains but no incompleteflag/UIwarning distinguishes the known conflict.|focused-probes.json priced-row-becomes-explicit-zero: ship5691,zero_cost_rows1,allincompleteflags0; health-probe.out actual statusok.|accuracy_3|
|A changed shipment date with the sameorder/cost can represent a correction or a secondtrip; existing append-only key retains both. Keep the discrepancy visible until resolution; do not silently drop historical expense.|focused-probes.json datechange7->8: events2,ship11382,retained1; approved fullkey includesdate so sourceidentityisambiguous.|insight_12|
|Cross-file filesystem transaction is absent; hashes detect partialreplacement but firstproductiondelivery import and readback still unperformed. No independent carrier-invoice reconciliation.|write_bundle uses separateos.replace perfile withstatuslast; selfcheck explicit; productionnotrun; Google93events authorread not actualcarrier-invoice.|risk_24|

Concrete rework: Persist unresolved accepted-event keys across reads, clear each only with authoritative recovery/resolution. Active-only reads cannot clear archive-proven disappearance; schedule archive/review while unresolved. Detect priorpositive->explicitzero conflict separately, preserve expense until approved resolution and surface warning; genuine firstseenzerobill remains a valid nonexpense. Add fullmissing->activeonly/realhealth regressions, positive->zero/empty distinctions and reappearance clearing. Preserve bytehistory and oldtrip rules; rerun25+58/currentfullCI and request iteration2 on newhash.

AUDITED: 9eaf420560f75c3e
VERDICT: return
