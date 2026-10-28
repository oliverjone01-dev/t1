# ФЕНИКС: rFBS сроки и статусы, итерация 2

Класс: дашборд/цифры. Итог: GO 8,40/10. Проверен весь продуктовый diff ветки codex/rfbs-delivery-timeline, включая новые файлы сборщика, тестов и семантической спецификации. Аудит выполнен независимым агентом; продуктовый код не менялся.

## Проверенный результат

[ДАННЫЕ] Самостоятельно прочитаны active + archive Google-ведомости. Прямая календарная арифметика дала 218 рейсов, 147 пригодных фактов, 57 будущих фактов и 6 отмен/возвратов. Три опоздания: 47230491-0150-1 = 1 день, 56155971-0227-2 = 7 дней, 0150459090-0331-1 = 2 дня. Итоги совпали с безопасным JSON, моделью и HTML. Это сверка с ведомостью, а не независимое доказательство перевозчика.

Самостоятельно запущены 49 Python тестов доставки и 52 TS/DOM теста Problems: PASS. Вручную атакованы дедупликация, приватные поля, промежуток между снимками и повторный запуск. Существующие денежные функции и реестры в diff не изменены. Общий build/CI и публикация остаются обязанностью автора; этот аудит не заявляет чистый общий CI.

## Evidence ledger

Первоначальный gap B3 воспроизведён на hash 82edd8daa4dde7e1: две строки одного заказа без номера рейса и с разными артикулами при одинаковых сроках схлопывались в одну. Команда: импорт tools/tests/delivery_timeline_test.py; collect([row(**{'2':'','3':'GGT-ONE'}),row(**{'2':'','3':'GGT-TWO'})]). Результат до исправления: rows=1, arts=[GGT-ONE,GGT-TWO]. Исправлено автором: на итоговом hash такой same-tab и cross-tab ввод вызывает ValueError, точные копии остаются одним рейсом. Регрессионный тест добавлен и пройден. Открытых блокирующих gaps нет.

## Пробы B1-B7
- B1 PASS: Independent read-only Google active+archive fetch and direct date arithmetic: 218 unique trips,147 valid facts,57 future facts,6 terminal rows; late1/7/2days on3orders. Matches source snapshot and model.
- B2 PASS: Closed September, Oct1-15, current Oct1-28: live baseline shift counts null/null/0, queue218 and late3 intentionally period-independent. Synthetic observed history independently expected1/1/2, model equals.
- B3 PASS: Initial audit reproduced silent merging of different unnumbered trips. Fixed in b7f35c870436dafe: same-tab and cross-tab differing articles rejected, exact copies dedup; distinct ledger IDs preserved.49Python tests pass.
- B4 PASS: Direct source arithmetic -> model147 completed/3late -> HTML3late and218table rows. Money model and source unchanged.52ProblemsTS/DOM checks pass.
- B5 PASS: Counters generated from source/model; grep for source counts/identifiers in template/client found only unrelated CSS hex sequences, no fixed operational totals.
- B6 PASS: Snapshot28Oct, current source independent read matches; production page rebuilt and checked after final template refresh. No invented pre-baseline history.
- B7 PASS: Injected private status, phone and note fields stripped; arbitrary contacts/addresses not published. Future facts/conflicts excluded from completion, missing rows not cancellation. Source limitation and unknown history visible.

B6 повторно выполнена после обновления превью: full-build/katya-problems.html и GENGLASS-Проблемы-rFBS.html оба дают 218 строк, 0 jsdomErrors, контейнер tariff-kpis. Screenshot rfbs-preview.png осмотрен: 4 KPI в строку, фильтр опозданий показывает 3 рейса с 7/2/1 днями; дата источника и независимость очереди от периода видны.

B2 команда node --import tsx импортирует model.ts. На реальном baseline: сентябрь/1-15 октября/текущий октябрь = null/null/0 переносов; актуальная очередь во всех периодах 218. Отдельная фикстура из 3 событий 12.09, 10.10, 28.10 дала ожидаемые 1/1/2 события. До первого снимка отображается н/д.

B7 фикстура с PRIVATE CONTACT в неразрешённых колонках, строкой SECRET CONTACT +79991234567 в артикуле и именем/телефоном в статусе не публикует эти значения. Статус нормализован в Неизвестный статус, артикулы ограничены допустимыми кодами. JSON встроен через безопасное экранирование <; DOM текст дополнительно экранирован. Неподтверждённые даты и конфликты видны.

## 25 пунктов и 5 вопросов

1-5: источники внешние, факты проверены, три периода пройдены, термины рейс/отправление разграничены, бренд сохранён.
6-10: релиз выполняет автор после слова Ивана; шаг ежедневного существующего workflow добавлен; бюджет/новые сервисы не требуются; метрика проверки 218 рейсов; контроль перед публикацией предусмотрен.
11-15: конфликты будущего факта и устаревшего статуса отражены; первоначальная обещанная дата неизвестна; история только по обнаружению; денежный и операционный контуры разделены; неоднозначная идентичность блокируется.
16-20: читаемые короткие заголовки, оформление существующее, таблица ограничена по высоте; обе стороны план/факт видны; Comprehension Gate PASS.
21-25: пробелы и конфликт не превращаются в ноль; нет финансовых гипотез; пробы выполнены; сетевой отказ сохраняет старый снимок; откат кода возможен без изменения Google-таблицы.

Q1: факты подтверждены живой ведомостью. Q2: неполный/невалидный источник не заменяет предыдущий снимок, конфликтные строки исключаются из завершённых/просроченных. Q3: используются существующий cron/workflow и Python stdlib. Q4: нет исторических обещаний и независимого подтверждения перевозчика, это явно раскрыто. Q5: в интерфейсе за один экран видны просрочки, срок/факт и необходимая проверка.

## Остаточные ограничения

Дата в ведомости не равна обещанию Ozon. Первого снимка недостаточно для исторических переносов. Будущий факт может быть предварительным вводом логиста; источник не доказывает доставку независимо. Полная проверка фактической публикации нужна после мержа. Разрешение на новую публикацию требует отдельного слова Ивана «мерж». В source snapshot есть 85 строк с предупреждениями, они видимы пользователю.

anchor: 8.1 dialogs-registry после исправления; этот результат немного выше за воспроизведённые identity/privacy/history пробы, но ниже 8.9 annotate из-за отсутствия независимого перевозочного подтверждения.

Оценка: 8.5×0.25 + 8.5×0.25 + 8.0×0.20 + 8.5×0.15 + 8.5×0.15 = 8.40.

AUDITED: b7f35c870436dafe
VERDICT: go
