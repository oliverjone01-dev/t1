# Self-check автора: PR «Карта объединённых карточек из Seller API» (head 7ee253b)

По knowledge/feniks/eval-checklist.md, 25 пунктов: да / нет / частично.

| # | Пункт | Ответ | Почему |
|---|---|---|---|
| 1 | accuracy_1_figures_tagged | да | Цифры в PR с метками [ДАННЫЕ] и ссылкой на run 38907089199 / analytics-tests |
| 2 | accuracy_2_sources_verifiable | да | Логи card-groups-probe run 1-4, data/card_groups.json на main |
| 3 | accuracy_3_no_conflict_with_rag | да | model_id = card_id кабинета (4681610246), 498/498 совпало с картой 23.09 |
| 4 | accuracy_4_glossary_terminology | да | «объединённая карточка», «артикул», «SKU» как в card-kin.ts |
| 5 | accuracy_5_brand_names_correct | да | TRUBIS, GGT-03-5-1 по данным API |
| 6 | actionability_6_owner_assigned | да | Код - автор; ночной шаг - ozon-snapshots; съём мака - Иван |
| 7 | actionability_7_deadline_buffer | частично | Приёмка - первый ночной прогон после мержа; буфер не задан |
| 8 | actionability_8_resources_listed | да | Новых секретов и сервисов нет, те же OZON_SELLER_* |
| 9 | actionability_9_metric_concrete | да | source/imported_at/35 карточек/GGT-03-5-1 в файле + card-kin зелёный |
| 10 | actionability_10_milestone | да | Ночь 16-17.10 |
| 11 | insight_11_nontrivial | да | 404 без offer_id; ключ API = ключ кабинета, проверено сверкой 498/498 |
| 12 | insight_12_second_order | частично | Перенос снятых с продажи держит историю; влияние на родню в тестах (контроль) не пересчитано |
| 13 | insight_13_alternatives_analyzed | частично | Мак/кабинет и гугл-таблица названы, сравнение кратко в коде |
| 14 | insight_14_anti_median | нет | Неприменимо: инфраструктура |
| 15 | insight_15_cross_domain | частично | Карта питает card-kin, cpc-card-spread, build-boost, plan-tab; прогон страниц на новой карте не сделан (файл пишет ночь) |
| 16 | brand_16_voice | да | Технический текст простым языком |
| 17 | brand_17_anti_slop | да | Запрещённых формул нет |
| 18 | brand_18_no_em_dash | да | U+2014 в дельте нет |
| 19 | brand_19_output_routing | да | PR + episodes |
| 20 | brand_20_tone_audience | да | Для Ивана - что изменится и когда |
| 21 | risk_21_downside | частично | Fail-closed на пустой/битый ответ; если OZON перетасует model_id - moved виден в логе, но не блокирует |
| 22 | risk_22_p | да | P9 hard rules не задеты: финансов и бюджетов нет |
| 23 | risk_23_crisis_scenarios | да | Сбой API - карта прежняя, warning в итоге синка |
| 24 | risk_24_dependencies | частично | Потребители card_groups.json перечислены в п.15; card-kin читает imported_at |
| 25 | risk_25_reversibility | да | Откат: убрать шаг из ozon-snapshots, вернуть файл из git |
