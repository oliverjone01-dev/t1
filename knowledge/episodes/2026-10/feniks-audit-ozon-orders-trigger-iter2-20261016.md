# ФЕНИКС · PR #484 (orders-backfill: сбор после съёма с мака), итерация 2 - GO 8.40

- **Голова:** ff3af7e4. Код в 39ea4f35 поверх a8b1100d, затем отчёт iter1 с [skip ci].
- **Хеш К11:** `audit_hash.py --rev ff3af7e4` = e54801a487a73f3e, совпал с запросом. Охват - все пути ветки вне knowledge/episodes и traces, три файла: orders-backfill.yml, ozon-snapshots.yml, deploy-pages.yml (в нём изменён только комментарий в строке 62). Поэтому audited_hash пишу.
- **Self-check:** сокращённый, 5 утверждений запроса. Все проверены ниже. Оценка по прецеденту серии.
- **JSON:** `feniks-audit-ozon-orders-trigger-iter2-20261016.json`, VALID. Пересчёт весов: 0.25×9 + 0.25×9 + 0.20×6 + 0.15×10 + 0.15×8 = 8.40, в поле 8.40.
- **Пробы:** `feniks-probes-ozon-orders-trigger/iter2_probes.sh`. Песочница в scratch, в /home/user/t1-wt записи нет.

## Итог

**GO, 8.40** (accuracy 9 / actionability 9 / insight 6 / brand_fit 10 / risk_awareness 8). FAIL по пробам класса A и B7 нет.

anchor: 8.5 timur-activation (итерация 3, go) - наш артефакт ниже на 0.1. Как у ТИМУРА на третьей итерации, каждый пункт return закрыт и подтверждён живьём. Но звено деплоя после бот-диспатча не проверено и теперь покрывает все прогоны ozon (K8), а в теле PR неточная строка про actionlint. Дрейф: iter1 7.30, iter2 8.40, +1.10, в обычной полосе второй итерации.

## Пять пунктов запроса

1. **A5b - закрыт** (R1-R5, тело шага из YAML ff3af7e4, оболочка `bash -eo pipefail`):
   - R1, чужой push после checkout: код 0, свежие заказы в origin. Было: код 0 при потерянных заказах;
   - R2, мутант без `pull --rebase`: код 1, `::error::push данных не удался`. Раньше такой случай шёл зелёным;
   - R3, грязное дерево (package-lock.json) и чужой push: autostash срабатывает, код 0;
   - R4, конфликт в orders_daily: код 1, rebase не оставлен открытым;
   - R5, без гонки: код 0;
   - SC2015 в actionlint на этом файле больше нет.
2. **K7 - механика верна (T1), действенность не измерена.**
   - Для всех трёх шагов: коды npx [1,0] дают паузу 60 и код 0; [1,1,0] - паузы 60 и 120, код 0; [1,1,1] - код 1. continue-on-error сохранён.
   - Против 429 эффект не доказан: 16.10 повтор прогона 54 через 20 мин упал уже на другом шаге начислений. Посчитать красные прогоны за первые 3 дня.
3. **K1 - закрыт.**
   - У ozon-snapshots в `on` остался только workflow_dispatch. Запуски идут только из шага orders: push утром и вечером плюс schedule. По модели iter1 это 3 прогона ozon в день без дубля, стресс S1 восстанавливается.
   - Зависимости от снятого cron:
     - sync.yml запускается только руками, от cron не зависел;
     - своё расписание deploy-pages (09:47) осталось, комментарий к нему обновлён;
     - проверок event_name в ozon-snapshots и в скриптах нет;
     - deploy-pages по workflow_run теперь всегда получает прогоны, запущенные ботом, это K8.
   - Устарели комментарии orders-backfill.yml:10-11 и :23, а также latency в трёх yaml из knowledge/semantic/metrics.
4. **Тело PR - обновлено.**
   - Есть 4,5-7,7 ч с источником, «с 30.09», критерий успеха (~08:30 МСК) и ответственный.
   - Пункт «вне PR» записан.
   - Неточно: «actionlint чистый на трёх файлах».
5. **actionlint.**
   - orders-backfill.yml чистый.
   - ozon-snapshots.yml:163 (SC2086) и deploy-pages.yml:107, 286, 355 (SC2012): уровень info, строки вне диффа, замечания были и до PR.
   - hygiene: ошибок 0, у orders-backfill 8 предупреждений К7 без `# dg-ok`.

## Red-team probes

| ID | Result | Evidence |
|---|---|---|
| A5b | PASS | R1-R5: гонка, мутант, autostash, конфликт, без гонки |
| T1 | PASS | Повтор 3 шагов: паузы 60/120, код 1 после 3 неудач |
| K7 | PARTIAL | Действенность против 429 не измерена |
| K1 | PASS | ozon только workflow_dispatch, 3 прогона в день без дубля |
| K2 | PARTIAL | Зависимостей от cron нет; устарели комментарии :10-11, :23 и latency в semantic |
| K6 | PARTIAL | orders-backfill чистый; 5 info-замечаний в двух других файлах, были до PR |
| K8 | N/A | workflow_run после бот-диспатча [НЕ ПРОВЕРЕНО]: у 4 upstream 0 бот-прогонов из 100 |
| A5c | PARTIAL | catch continue вне диффа, записан в PR |
| A6 | PARTIAL | actions: write на весь workflow (:37) |
| P1 | PASS | Тело PR под голову, длинных тире 0 |

## Gaps (go не блокируют)

1. **K8** - deploy-pages.yml:57-59: workflow_run после бот-диспатча ozon не проверен, а теперь так запускаются все прогоны. Если на первой цепочке он не пришёл, нужен план Б: dispatch deploy-pages в конце ozon-snapshots по шаблону b24-cron.yml:130-147. Записать его в PR.
2. **K7** - orders-backfill.yml:71-97: действенность повтора проверить по красным прогонам за 3 дня.
3. **Устаревшие комментарии** - orders-backfill.yml:10-11 и :23.
4. **Latency в semantic (вне диффа)** - ozon-price-test-gap-shift.yaml:53, ozon-v5-strategy-profit.yaml:45, ozon-monthly-report.yaml:65.
5. **Тело PR** - строка «actionlint чистый» неточна; число прогонов в день (orders 3, ozon 3) не записано.
6. **Гигиена К7** - 8 предупреждений без `# dg-ok`, новое `|| true` в строке 129; actions: write на весь workflow (:37).
7. **Один путь расписания для ozon** - пропущенный cron orders в день без съёма (как 03-04.10) оставит день без ozon. Ручная кнопка остаётся.
8. **Вне диффа** - acq-sku-daily.ts:56 и pnl-accrual-daily.ts:93 (catch continue): нужна запись в реестр и отдельный PR.

Мерж - по слову Ивана «мерж» (decisions 15.10).

AUDITED: e54801a487a73f3e
VERDICT: go
