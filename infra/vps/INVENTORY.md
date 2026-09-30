# Инвентаризация: что переносим на сервер

Снято 29.09.2026 с `.github/workflows/*.yml` (49 воркфлоу) и шагов `deploy-pages.yml`.
Статус: ✅ перенесено в контур (пилот), ⏳ ждёт своей волны, 🟦 остаётся в GitHub, ➖ не нужно на сервере.

## Волны (переносятся кластерами: у кого общие данные, тот едет вместе)

Главное правило: пока волна не переключена, её данные пишет **только** GitHub, а сервер
работает параллельно и сверяется (фаза 2 в README). После переключения данные пишет
**только** сервер, а cron в воркфлоу убирается в том же PR. Два писателя одних данных
держать нельзя.

| Волна | Что | Кто читает данные этой волны |
|---|---|---|
| 1. РОП ГГ | rop-snapshot (b24-cron + b24-snapshots), офис, личные дашборды менеджеров, Telegram-бот РОП, rop-tg-guard | ai-rop-nightly, sales-audit (ИИ, см. README §7), /dialog-experiments/ |
| 2. Bitrix-остальное | производство, ПТО, экономика (+recon), РОП Glass Memory, диалоги | rop-tg-bot, sales-audit (диалоги) |
| 3. Маркетплейсы и реклама (ветка main) | OZON (ozon-snapshots, orders-backfill, sync), Маркет (ym-snapshots), Директ, SEO/GEO harvest, Keys.so, Wordstat, конкуренты, Контур | хаб, KATYA, /market/, /direct/, /seo/, /kontur/ |
| 4. Статика и прочее | хаб, академия, план, ozon-research, phoenix, markplan, smm, stand-protocol, integra, kp-gm, op-gm, messages, Точка | - |

## Воркфлоу

| Воркфлоу | Расписание (UTC) | Волна | Статус | Примечание |
|---|---|---|---|---|
| b24-cron | 17 */3 * * * | 1 | ✅ `rop-snapshot` | вместе с офис-дашбордом |
| b24-snapshots | 20 2 * * * | 1 | ✅ входит в `rop-snapshot` | тот же полный снимок; слот 02:17 есть в расписании |
| rop-tg-bot | пн-пт 05:00, 06:00, 06:15, 13:30, 14:30, 14:45 | 1 | ⏳ | «прогрев» через dispatch b24-cron заменить на `gg-job rop-snapshot`; ссылки github.io -> домен; v.txt читать с диска |
| rop-tg-guard | */30 5-16 пн-пт | 1 | ➖ | страховка от потерянных запусков GitHub; на сервере это делают `Persistent=true` и алерты |
| ai-rop-nightly | 0 5 * * * | 1 | 🟦 | Anthropic API недоступен с российских IP (README §7) |
| sales-audit | пт 09:00, 1-е число 09:00 | 1 | 🟦 | то же + читает rop.json и dialog.json из git |
| mgr-photos | пн 04:23 | 1 | ⏳ | фото менеджеров для личных дашбордов |
| export-contacts, export-leads | вручную | 1 | ➖ | выгрузки контактов в git **прекратить**: xlsx клиентов не должен попадать в репозиторий; на сервере - в папку без веб-доступа |
| b24-gm-snapshots | 17 5, 47 9 | 2 | ✅ `rop-gm-snapshot` + `rop-gm-snapshot-late` | /rop-gm/; дашборд печётся в задаче, не на деплое |
| prod-cron | 37 5, 7 10 | 2 | ✅ `prod-snapshot` + `prod-snapshot-late` | /prod/ /prod2/ |
| pto-cron | 47 5 | 2 | ✅ `pto-snapshot` | /pto/; как в GitHub, страница не пересобирается (с 24.09) |
| economics-cron | 47 5, 17 10 | 2 | ✅ `economics-snapshot` + `economics-snapshot-late` | /economics/layers.html; два слота - две строки jobs.conf |
| econ-recon | 37 */3 | 2 | ✅ `econ-recon` | /economics/, /econ-control/; дизайнеры и карта полей (в GitHub по ручному запуску) - `ECON_FULL=1 gg-job econ-recon` |
| field-map | пн 06:00 | 2 | ⏳ | схема полей Bitrix |
| b24-dialog-cron | 37 5 | 2 | ✅ `dialog-snapshot` | снимок + скоринг + страница; ИИ-шаг не переносится (приостановлен и в GitHub); dialog.html без истории в git данных |
| ozon-snapshots | 0 6 | 3 | ⏳ | после неё в GitHub шёл deploy-pages (workflow_run) - на сервере site=yes |
| orders-backfill | 0 5 | 3 | ⏳ | |
| sync | 0 5 (если включён) | 3 | ⏳ | проверить при переносе, не дублирует ли ozon-snapshots |
| ym-snapshots | 40 6 | 3 | ⏳ | /market/ |
| direct-snapshots | 20 6 | 3 | ⏳ | /direct/ |
| harvest | 0 0 | 3 | ⏳ | /seo/ (GEO-monster) |
| keyso-collect | пн 02:30 | 3 | ⏳ | |
| wordstat-semcore | пн 04:00 (если включён) | 3 | ⏳ | |
| competitors-import, competitors-pilot | 0 5 / 0 7 (если включены) | 3 | ⏳ | |
| kontur-snapshot | пн-пт 06:00 | 3 | ⏳ | /kontur/ (свой пароль KONTUR_PASS) |
| tochka-snapshots | 0 19 | 4 | ⏳ | банк: вечерняя сводка в Telegram, данных в git не пишет |
| deploy-pages | push в main, 0 10, после снимков | - | ⏳ заменяется `gg-site` | шаги переезжают в `site/steps/` по волнам |
| analytics-tests | PR и push | - | 🟦 | CI остаётся в GitHub |
| *-probe (10 шт.), b24-cost-by-type, b24-money-export, econ-timeline, econ-tovar-probe, direct-goals-seo, direct-monthly-cpl, monthly-channels, card-groups-import, ym-ping | вручную | по данным | ⏳ по запросу | переносятся как задачи без расписания: запуск `gg-job <имя>` |

## Разделы сайта (шаги deploy-pages.yml)

| Раздел | Ветка-источник | Волна | Статус |
|---|---|---|---|
| /rop/ /rop2/ | rop-dashboard-v1 | 1 | ✅ `site/steps/20-rop.sh` |
| /office/ | office-dashboard-v1 | 1 | ✅ `site/steps/21-office.sh` |
| /rop-<фамилия>/ | manager-lakomova + rop-dashboard-v1 | 1 | ⏳ |
| /dialog-experiments/ | dialog-experiments + rop + dialog | 1-2 | ⏳ |
| /rop-preview/ /rop-experiments/ | ветки-песочницы | 1 | ⏳ превью (README §8) |
| /rop-gm/ | rop-gm-dashboard-v1 | 2 | ✅ `site/steps/24-rop-gm.sh` |
| /prod/ /prod2/ | prod-dashboard-v1 | 2 | ✅ `site/steps/25-prod.sh` |
| /pto/ | pto-dashboard-v1 | 2 | ✅ `site/steps/26-pto.sh` (гейт клиентских полей) |
| /economics/ /econ-control/ | economics-dashboard-v1 | 2 | ✅ `site/steps/23-economics.sh` |
| /dialog/ | dialog-export-v1 | 2 | ✅ `site/steps/27-dialog.sh` |
| / (хаб), /market/, KATYA | main | 3 | ⏳ |
| /kontur/ /direct/ /seo/ | main | 3 | ⏳ |
| /direct-preview/ /preview/ | ветки превью | 3 | ⏳ превью |
| /academy/ /plan/ /ozon-research/ /phoenix/ /markplan/ /smm/ /stand-protocol/ | main | 4 | ⏳ |
| /op-gm/ /messages/ /integra/ /kp-gm/ | свои ветки | 4 | ⏳ |
| /status/ | сервер | - | ✅ `site/steps/90-status.sh` (новое) |

## Что захардкожено на github.io (исправить в фазе 4)

Адрес `oliverjone01-dev.github.io/t1` встречается в 6 файлах кода, в том числе в хабе
(`analytics-mvp/public/dashboards/index.html`) и в `rop-tg-bot.yml`. До исправления nginx
переписывает эти ссылки на лету (`sub_filter` в `nginx/gg.conf.template`).
