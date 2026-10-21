# Независимый аудит целостности сборщиков OZON, iter1

Проверяющий: Codex по роли/checklist ФЕНИКСА, без имитации Claude/Opus. Класс mixed: ETL, финансовые данные, workflow и публикация.

**7.60/10, return.** Три воспроизводимых пути продолжают терять прежние положительные данные при неполном/повреждённом ответе. Слияние этой головы не подтверждено. Новые17тестов проходят, но этих атак не содержат.

HEAD `44a94fed0b0cc2bf0ee132e4e816fa8076325242`; сам пересчитал `audit_hash.py --rev HEAD` = `1a985e9ad8394033`. Охват все21путь из `git diff --name-only $(git merge-base origin/main HEAD) HEAD` (приложен covered-paths.txt); data/main/refs/продукт/память не изменял. Отчёты/доказательства и трейс исключены изhash алгоритмом. Гарантий исполнения Claude hooks в Codex нет, write-scope соблюдён самостоятельно.

## Blockers с воспроизведением

Запуск из `/Users/gengroup/Documents/Codex/t1/analytics-mvp`: `node --import tsx /private/tmp/ozon-integrity-audit/probes.mts`, затем extra-probes.mts и finance-probes.mts. Копии скриптов/выходов в соседнем feniks-probes-ozon-collector-integrity. Они используют настоящие модули HEAD, меняют cwd на отдельный tmp и подменяют только API-границы; сеть запрещена. Даты берутся от closedDay, не из fixture ожиданий.

1. **CSV1/CSV2.** В отчёте валидный SKU123 + непустая строка с пустымSKU и расходом25/продажами100. Guard пропускает строку, ad-sku удаляет прежнийSKU456, checkpoint становится21.10, лог пишет100%покрытия. Некорректное BROKEN в колонке корзины также превращается в0. attribution-report.ts проверяет не все используемые числа и разрешает любое отсутствиеSKU как metadata. Требуется отказ до замены и checkpoint; разрешать только явно установленный total/пустую строку.
2. **ADS1.** Сохранены camp1/sp100 иcamp2/sp50 за20.10; campaigns знает обе, dailyStats возвращает толькоcamp1. ads-daily main завершается успешно, удаляетcamp2. sourceHealth показываетok по20.10; проверка полноты опирается уже на обрезанныйads_daily и не замечает50руб. Guard должен сравнивать полные старые ненулевые ключи внутри окна с новым ответом, не только проверять, что весь массив непуст.
3. **FIN1/FIN2.** ПолныйFROM06.02; сохранены19.10=-10 и20.10=-20. Ответ byday19валиден, byday20=[]. acq иpnl удаляют20.10 и записываютsuccess through20.10. Старыйсрез целиком ещёнепуст, поэтому guard не срабатывает. Проверять все затронутые гранулярности до первогоrename, включая датированные/недатированные perorder.
4. **KEY1 (helper).** `${r.date}|${r.sku}` превращает отсутствующийsku вliteralundefined; validateRows принимает, collectDaily пишет rowбезsku и completedledger. На входе текущего Seller есть дополнительная фильтрацияsku, поэтому этот кейс не объявляю доказанной внешней потерей Sellerданных; helperконтракт всёравно нарушен. Проверять компонентыключа до строкового соединения.

## Что прошло и реальные ограничения

- HTTP503 второго дня сохраняет побайтно прошлый dailyфайл и не пишетledger. Повторный курсорaccrual ловится; законные2страницы возвращают2строки. Курсор отсутствует ->однастраница принимается, liveконтракт последнейстраницы ещёожидается.
- Самостоятельно запущен collector-integrity.test.ts:17/17. Родительские полные логи прочитаны:1208/1208,71файл, smoke23/23. Их не выдаю за новый собственныйполныйпрогон. БазовыеHTTPrequest/state/download/timeout/types/shortFROM кейсы закрыты.
- CPO исключается поpaymentType изочереди и знаменателя, не поHTTPошибке; атака сCPO1000руб рядомсCPC100руб не включилаCPO вcoverage.
- Финансовые формулы вdiff не меняются. Все запросы/агрегации и валидации расположены до записей; каждыйrename атомарен. Общее многофайловое восстановление послеprocess/diskcrash не реализовано и честно disclosed.
- Послеbudgetdeadline checkpoint не продвигается; нет доказательства полного восстановления всехкампаний до концаочереди. Покрытие старымистроками не доказывает успех текущейпопытки.
- Новыеjobs snapshots толькоmain, verifycontentsread иforkPRguard; probe не пишетdata/кабинет. deploy красногоOZONmain берёткодmain и прогоняет smoke, не исполняет артефакты чужогоworkflow. bash-n52multilineблока (27+25) безошибок. Полный YAMLparser в текущемNode/Python не установлен, поэтому формальная YAMLвалидация здесьне заявлена; workflow-hygieneCI родителяsuccess прочитанвсообщении.
- UI предупреждение о старомCPO понятно и не выдаёт0позиций сегодня. SharedhealthHtml встроен вbuildkatya/buildtests. Однакоfailedattempt хранитсятольков/tmpаккумуляторе: свежаяmaxdate может скрывать упавшийповтор. Показатьfailuremetadata или сузитьclaim о предупреждении каждойпотери.
- LiveDATECSV CI39594095997 ещёвработе; **go на неподтверждённый формат не выдан**. Независимого финансового документа нет; измененияобоснованы сохранностьютранспорта, не сверкойсбанком.

## Восемь шагов data-guard

1. Pre-mortem: registry_match самостоятельно вернулE027/К7(11),E018/К6(6); исходные4faultinjection прочитаны.
2. Контракт доаудита: документprobe прочитан, определенияденег/date/attribution не меняются. Сохранность поcampaign/day/SKU является требованием.
3. Probe: fixtureошибки подтверждены, liveCSV pending. Не объявлен завершённым.
4. Инварианты: HTTPfailure закрыт; CSV/полнота срезов/ключи провалены описаннымиатаками.
5. Трипериода пересчитаны: сентябрь312/24185394руб,01–15.10 186/12685902руб,20.10 25/1525483руб; unique=counts. Это контроль неизменённой базы, не crossfamilyфинансоваясверка. data ветка не меняет.
6. Claims1208/23прочитанывлогах; собственные17/17 и6атак сохранены. Утверждение«исправлено полностью» не подтверждено.
7. Этотаудит return на фактическийhash. Нужны доработка/новыйhash/iter2 до слияния.
8. Ретро: выявленныепути E027ещёоткрыты; переданоавтору. Реестр/память не изменял, решение обэскалации/продуктовыеисправления автору.

## Пять вопросов

1. Доказательства: реальныеимпортированные модули, изолированныефайлы, отказсети, stdout иJSON приложены.
2. Downside: частичныйAPIresponse может уменьшить финансовыеистории и получитьложныйsuccess; не толькозаморозитьобновление.
3. Ресурсы: текущиеNode22/24/Actions, безновыхсервисов; APIочередь требуетпродолженияпрогонов.
4. Забытое: компонентысоставногоключа, непустые perdayсрезы внутри непустойистории, failuremetadata дляоднодневногоповтора.
5. Инвесторскийответ: «старые данные защищены при503» подтверждено; «при неполномуспешномответе» пока нет.

## Red-team probes

| ID | Result | Evidence |
|---|---|---|
| H1 | PASS | HEAD44a94fed, independently audit_hash --rev HEAD=1a985e9ad8394033; full21paths in covered-paths.txt; no analytics-mvp/data changes. |
| B1 | PASS | Parent full log1208/1208 and smoke23/23 read; own vitest17/17; prior collector-failure-probes.json read; claims are fixture evidence, not financial verification. |
| B2 | PARTIAL | periods.json: September312/24185394; October1-15 186/12685902; October20 25/1525483; counts unique. No independent document and no production refresh on branch. |
| B3 | FAIL | extra-probes.mts KEY1: composite key2026-10-20|undefined accepted; collectDaily writes missingSKU and completed ledger. |
| B4 | PARTIAL | healthHtml shared by build-katya/build-tests. ADS1 deletes camp2 then sourceHealth returnsok; no gap row because lost daily source is also baseline for campaign coverage. |
| B5 | PASS | No money literal added; 55/7/60/62/9/12 are declared collection limits. Archive2026-09-07 explicitly labelled historical; dynamic health counts derived. |
| B6 | PARTIAL | Liveformat probe pending in CI39594095997; assertions about deployed freshness not made. Through dates alone cannot signal failed retry of an already-current source. |
| B7 | FAIL | CSV1 malformed blankSKU deletes oldSKU456, advances checkpoint and says100%coverage. ADS1 drops priorpositivecamp/day without error. FIN1/2 drop old20.10 amounts, record through20.10; deploy permits redOZONmain and health uses this false-success state. |
| P1 | PASS | DAILY1 HTTP503 on second day preserves exact oldbytes and noledger; targeted17testspass confirm finance503/typesfailure/shortFROM/reportfailures. |
| P2 | FAIL | CSV1 partial malformedSKU row skipped; CSV2 BROKENcart accepted and becomes0. Newformat guard doesnot validate entire usedschema. |
| P3 | PASS | PAGE1 repeated accrual cursor throws; PAGE2 valid twopage returns2. PAGE3 absentcursor accepted, final-envelope contract remains notverifiedlive. |
| D1 | PASS | No self-claimed audit score in changedproduct code/spec; selfcheck has no score. |
| D2 | N/A | Noagentdelegation added; this is ETL/GitHubworkflow, not agent runtime. |
| D3 | N/A | Noagentfrontmatter changed. GitHubworkflow inspected separatelyD11. |
| D4 | PASS | audit-report JSON validation required before delivery; checkpoint25 and weighted7.60 independently computed. |
| D5 | N/A | Noagentrole/tier changes. |
| D6 | N/A | No skilltrigger changes; verifyworkflow pathfilters explicit. |
| D7 | PASS | Failure collectors exit1; snapshots commits validparts then finalfailure; unsupportedCPO filtered by paymentType; nofailure classified CPO. |
| D8 | PARTIAL | Async sequential windows<=60days; default9min and workflowSKU12min; verifytimeout25min. Budgetreport can remain queued; old coverage doesnot prove current attempt complete. |
| D9 | PASS | No memory modifications; verify contentsread; snapshots main-only jobs; no writes in collector-probe.ts. |
| D10 | N/A | NoCowork/agentrole scope. |
| D11 | PASS | bash-n on52 workflow multiline blocks (27snapshots+25deploy); no shellparseerrors. Inlineverify run simple; workflowmain guards/read-onlypermissions/forkrestriction inspected; no unsafe artifact execution added. |

## Оценка и калибровка

|Критерий|Балл|Вес|Вклад|
|---|---|---|---|
|accuracy|7|0.25|1.75|
|actionability|8|0.25|2.00|
|insight|8|0.2|1.60|
|brand_fit|9|0.15|1.35|
|risk_awareness|6|0.15|0.90|

Итого7.60. Все25checkpoints вJSON; суммы совпадают сscores. Оценка7.60 неотменяетreturn: FAILB7.

anchor: 7.6 timur-activation iter1 return: equal7.60. Core direction is sound and live fixture attacks expose destructive paths; like timur, guard declarations are insufficient until bypasses are closed. Lower than8.1 reestr-go, where counters and all three surfaces were independently reproduced without destructive findings.

## Evidence ledger

|Gap|Evidence|Checkpoint|
|---|---|---|
|BLOCKER CSV: malformed nonempty blankSKU row is ignored; oldSKU456 removed and state advanced; BROKENcart silently becomes0.|node --import tsx probes.mts: CSV1 error empty,changedtrue,state1=2026-10-21; old456absent. CSV2 toCart0 forBROKEN. attribution-report.ts loop skips missingSKU and numeric selection excludescart.|accuracy_3|
|BLOCKER ADS: partial dailyStats array removes existingpositive campaign/day; statusok after loss and coverage checker loses its baseline.|node --import tsx extra-probes.mts ADS1: oldcamp1sp100/camp2sp50; returnedonlycamp1; exitok, remaining1, healthРасходкампанийok.|risk_21|
|BLOCKER FIN: valid empty reply for one formerlynonempty day removes prior financial amount while otherdays keep entire file nonempty; through advances.|node --import tsx finance-probes.mts FIN1/FIN2: old19=-10/20=-20; byday19one,20empty; outputonly19,status20.10.|risk_23|
|Composite string key can conceal missing fields as literalundefined; collectDaily writes malformed row and ledger.|extra-probes.mts KEY1 acceptedtrue, writtenrowwithoutsku, ledgertrue. validateRows checks nonempty stringsegments but not literalundefined.|accuracy_3|
|Live DATECSV and accrual envelope contract pending; cannot grantgo on fixtures alone. No external monetary document in this task.|self-check24 APIprobe pending; parent run39594095997 in_progress; collector-probe.ts onlyformat/counts, no externalmoneydocument.|accuracy_2|
|Failure attempt metadata is not persisted for dashboard; current maxdate can hide unsuccessful retry. Multi-file crashtransaction intentionally out ofscope.|source-health.ts reads rows+collector_status success only; snapshots failures accumulator/tmp not persisted; selfcheck explicitly discloses no crossfilerename transaction.|risk_24|

## Конкретная доработка

Reject malformed nonempty CSV rows; validate every consumed numericfield includingcart; guard full old nonzero keys within intended slice at campaign/day/SKU granularity before replacingdata or anycheckpoint. Apply to adsdaily, adsku, attr, collectDaily, allfinance files before firstwrite. Composite keys must reject missing/null/undefined actualcomponents. Add regressions for CSV1/2,ADS1,FIN1/2,KEY1 and validemptywithnopriorrows; verify nofalse positives on legitimate explicitzero. Confirm liveCSV/last_id contract, rerun targeted/full/smoke and request iteration2 on newhash. Persist/display failedattempt signal or narrow claim about visiblepartialfailures.


## Final provenance clarification

The author started product rework in the shared checkout after blockers were delivered. The worktree hash consequently changed. This audit/trace covers immutable rev44a94fed only, not the uncommitted rework. The auditor did not modify product/data/refs/memory.

A minimal source import closure was extracted with git show44a94fed into /private/tmp/ozon-integrity-audit/audited-source; installed node_modules are linked. All three replay-*.mts use that immutable snapshot and reproduced the original findings with exit0. Full gitarchive could not fetch unrelated lazyobjects, so no unsupported fullsnapshot claim is made.

Live probe39594095997 update received from parent: Seller135types, byday110, totals1, views600, postings/accrual3 succeeded. Four DATECSV reports had no rows or a different date. This does not establish whether the API legitimately lacks SKU data or there is a parsing/date problem. No unsupported API failure claim is made. Live CSV acceptance and coverage remain unresolved.

AUDITED: 1a985e9ad8394033
VERDICT: return
