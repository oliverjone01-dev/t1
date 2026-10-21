# Google delivery/TZ audit, iteration2

**8.00/10, return** on immutable `2babf54530c3c0f7292fdbaf9b819eb928ad71aa`, `AUDITED 0b75eba859e32a6b`. Independent Codex review by the FENIKS role.

The firstreturn remains intact. All15committed product/spec paths and the reworkdelta are covered. No product/data/ref/memory changes by this reviewer. The original two blockers were fixed; two further independent counterexamples prevent go.

## Fixed and independently confirmed

- A full-source disappeared trip remains in unseen_keys; nextactive-only status stays1 and archive_needed=True.
- A sole priorpositive bill becomingzero nowblocks; an isolatedchangeddate withouttheoldkey also blocks.
- Actual fetched live run39605088637 shows allfour default+03 CSVbounds inside the intendedwindow ending20October. UTC/MSK pairedproof from39603979177 remainsvalid. The timezonepart has no new blocker here.

## Reproducible new blockers

1. **Accepted primarytrip is unstable.** Import order72685709-0383-1,07October,ship1000,paid7500. On nextread keep that exactsourceevent and add a genuine additionaltrip for the sameorder/date,ship2000,paidunknown. merge_events allows both, then project sorts by(date,order,-shipcents). The primary ledger changes ship1000->2000 and paid7500->0; the formerfirsttrip becomes extra1000/paid7500. Total3000conservation passes, but firsttrip/datebasis accounting has changed. Persist primaryevent identity onceaccepted, rather than recomputing from sortedwholehistory. A newlyrecovered earlier-date event can cause the same class of primaryswap by datesort.
2. **Identical accepted input fails its own replay.** Firstread CSV contains sameorder/date positive1000 plus explicitzero. Initialimport succeeds and records one priced event. Secondread of the identicalCSV throws positivebecamezero because zero-set matches order/date, even though the acceptedpositive fullkey is stillpresent. No sourcevalue changed. The zerotransition guard must distinguish actualdisappearance of the positivekey from an unchangedcoexistingzero, or reject this ambiguity consistently at firstimport as well. A successfulimport cannot become an error on identicalreplay.

Commands: `python3 -B /private/tmp/ozon-delivery-audit/iter2-counterexamples.py` from repositoryroot. This script extracts immutable2bab Python modules/tests into temporarydirectories, imports the real functions, and uses syntheticCSV only. Evidence is copied to `feniks-probes-ozon-delivery-sheet-iter2`.

## Five questions

1. Proof: actualfunction calls, immutable Git source, JSON before/afterledger rows.
2. Downside: exactgrandtotals do not protect whichamount is recognized as the primaryorder delivery versus an extra trip on its own date.
3. Resources: no newservices; correction is lifecycleidentity, not newfinancialformula.
4. Forgotten surface: projections rebuild all accepted new-window events, so persistentidentity must survive newtrip arrival and reordering.
5. Shortanswer: warningstate andTZ are improved; firsttrip preservation and repeatability are stillincorrect in demonstrated cases.

## data-guard and constraints

Originalapprovedfields/window/repeattrip contract are unchanged. Priorread-only sourceprobing,25Python+58TS evidence remain in firstreport;29Python/newhealth regressions are authorreported on rework and are not substituted for these newcounterexamples. IndependentdefaultMSK liveproof was read fromGitHub. No externalcarrier-invoice reconciliation or productionimport is claimed. Eight-step review remains stopped at built-ininvariants/sourcepreservation and newhashreview; no workaround by changing approved accountingbasis is authorized by this audit.

## Red-team probes

|ID|Result|Evidence|
|---|---|---|
|H1|PASS|Independent --rev2bab hash0b75eba859e32a6b. Full15product/spec paths from iter1 and reworkdelta reviewed; immutable Python import snapshot used. Later report/trace-only commits do not change producthash.|
|B1|PASS|Approvedspec5goldens/six-tab mapping and sourceprobe read; author source93events362861.87 not misrepresented as independent carrier-invoice reconciliation. Actual pairedAPI runmetadata/log independently fetched readonly.|
|B2|PARTIAL|New delivery05-20Oct scope; legacy up to04Oct is preserved by tests and code. No production Google importer yet and no independent carrier invoice family available; threeperiod financial reconciliation not claimed.|
|B3|PASS|25Python regressions independently pass: complete eventkey/order+date+cost; copiesmerge, distincttrips separate, cent splits conserved; old24 combined-trip baseline not repartitioned.|
|B4|PASS|Prior stickywarning nowpersists and drives archive_needed; priorpositive->zero nowthrows; existing healthretainedcase tests warning.|
|B5|PASS|Sourcewindow05Oct and Moscow offset are approved contract constants, not fabricatedmoney; no usermetric hardcodes added.|
|B6|PASS|Independent API run39603979177 success metadata at9ff3951d and actual log confirm pairedUTC/MSK DATE effect; transport body tests now capture realfetch arguments including year-boundary.|
|B7|FAIL|Independent primaryswap fixture: acceptedprimary1000/paid7500, addactualsame-daytrip2000/paidNone whilekeepingoldsourcekey; projection rewritesprimary2000/paid0 and makesoldprimaryextra1000. Total3000doesnotprove firsttrip/accountingbasis invariance.|
|P1|PASS|Own25Python tests and58targetedTS tests pass; sharedarticle rule, baselinebytepreservation, repeats/extra trips/invalidheaders/dates/money/stagefailure covered.|
|P2|PASS|Original bugs closed on immutable2bab: fullmissing1->nextpartial1, archive_neededtrue; priorpositive->solezero blocks.|
|P3|PASS|Changeddate/samecost withoutoldkey nowblocks; both actualold/new keys together allowed as separatetrips. This doesnot fix identity of first acceptedprimary when projectionresorts events.|
|P4|PASS|Independently fetched actualdefaultMSKlive39605088637: four campaignbounds all end20Oct,outsideempty; pairedUTC/MSK result remains confirmed. No regression inTZdelta.|
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
|P6|FAIL|Identicalsource positive1000+zero placeholder sameorder/date: firstimport succeeds, identicalreplaythrowsacceptedpositivebecamezero. Zeroguard examines previousorder/date only, evenwhenoldpositive fullkey is stillpresent.|
|P7|FAIL|iter2-counterexamples.json new-higher-trip-replaces-primary: primary1000->2000 and paid7500->0; oldprimary movedtoextra1000. project sorts(date,order,-shipcents) on everyreplay without persistentprimarykey.|

## Score and evidence ledger

Accuracy8,actionability8,insight8,brand10,risk6. Weighted2.00+2.00+1.60+1.50+0.90=8.00.25checkpoint totals are inJSON. FAILB7 requiresreturn.

anchor: 8.1 reestr-go is numericallynear, but our8.00 remainsreturn: counters/totals alone pass while entityidentity changes. The new primaryswap evidence is stronger than the prior warning-only gap and justifies no prematurego despite fixing stickywarnings.

|Gap|Evidence|Checkpoint|
|---|---|---|
|BLOCKER: adding a new higher-priced trip for the sameorder/day can change the alreadyacceptedprimary and move its originalcost/payment to the extraseries. This violates the firsttrip preservation/datebasis contract even though allgrandtotals stillmatch.|iter2-counterexamples.py/json: acceptedrow1000/paid7500, incomingincludesold1000+new2000; afterprimary2000/paid0, newextra1000/paid7500.|accuracy_3|
|BLOCKER: initialvalidsource with a positive and explicitzero row succeeds, but replaying exactly thatsource fails. Positive->zero rejection must distinguish lostpositivekey from an unrelated/unchangedzero row or reject the ambiguity consistently from thefirstimport.|Samefixture firstprepare positive1000+zero=>success, secondprepare sameCSV/state=>ValueError; source didnotchange.|risk_21|

Rework: Persist the identity of an accepted primarytrip perorder and reuse it when reprojecting; do not pick a newprimary by sorting cost/date on eachrun. Newactualtrip must enter extras and leave originalprimaryship/payment/firstdate unchanged, even if highercost/same-day or recoveredearlierdate. Distinguish a positive->zero transition from unchangedcoexistingzero when oldpositivekey is still present; enforce one consistent initial/replay policy. Add idempotence and primary-stability regressions; rerun29Python/currentTS/fullCI and request finaliteration on newhash.

AUDITED: 0b75eba859e32a6b
VERDICT: return
