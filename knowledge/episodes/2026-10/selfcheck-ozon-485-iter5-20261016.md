# Self-check автора PR #485 перед ФЕНИКС iter5 (head b246e4c, хеш e4bc0cf255f5a6db)

По knowledge/feniks/eval-checklist.md, 25 пунктов: да / нет / частично.

| # | Пункт | Ответ | Почему |
|---|---|---|---|
| 1 | accuracy_1_figures_tagged | частично | В теле PR цифры с метками [ДАННЫЕ]/[расчёт]; в комментарии yml «~4,5 мин» и «17-21 ч» без метки (вес 0 в iter3) |
| 2 | accuracy_2_sources_verifiable | да | prices_daily/gap_daily 14.10, gh api runs 54-56 и jobs, пробы R2/R3/R8/B3/W1/P1 лежат в knowledge/episodes |
| 3 | accuracy_3_no_conflict_with_rag | да | База 14.10 = PRICE_BASE плана; режим 15.10 (N1) назван в PR и вынесен (Иван «разберись отдельно») |
| 4 | accuracy_4_glossary_terminology | да | «наша цена», «предельная», «витрина» как в plan-tab.ts; палитры/коллекции не упоминаются |
| 5 | accuracy_5_brand_names_correct | да | QUATRIS, PROFIX, KONUX, TRUBIS L120 по sku_taxonomy.json |
| 6 | actionability_6_owner_assigned | да | Код - автор PR; цена в кабинете - Иван; N1 и записи реестра - автор после мержа |
| 7 | actionability_7_deadline_buffer | частично | Срок цен 16.10 задан Иваном; приёмка повторов 3 дня после мержа; буфер по N1 не задан |
| 8 | actionability_8_resources_listed | да | Файлы и шаги перечислены в PR; новых ресурсов не нужно, сбор автоматический |
| 9 | actionability_9_metric_concrete | да | «повтор 6/8+ и зелёный шаг» + 0 красных «Сбор по заказам» за 3 дня; статус цены по priceStatus |
| 10 | actionability_10_milestone | да | Первый прогон после мержа (вечерний съём 16.10), 3 дня приёмки, решение 29.10 по плану |
| 11 | insight_11_nontrivial | частично | Нетривиально: retry внутри клиента вместо повтора шага, таймаут ради коммита заказов; таблица цен - механика |
| 12 | insight_12_second_order | частично | Назван эффект на спидометры KONUX и TRUBIS L120 и сдвиг статусов из-за N1; количественно не оценён (оценка ФЕНИКСА N3 +0,3-0,8 заказа [ГИПОТЕЗА]) |
| 13 | insight_13_alternatives_analyzed | да | Повтор шага K7, кэш postings, Retry-After - в PR с причиной отказа; база 15.10 vs 14.10 показана Ивану в рублях |
| 14 | insight_14_anti_median | нет | Неприменимо в полной мере: инфраструктурная правка и таблица, творческой части нет |
| 15 | insight_15_cross_domain | частично | Связка сбор -> цепочка #484 -> страница плана; финансы и продажи не затронуты |
| 16 | brand_16_voice | да | Внутренний технический текст, язык простой |
| 17 | brand_17_anti_slop | да | Запрещённых формул нет |
| 18 | brand_18_no_em_dash | да | U+2014 в дельте 0 (P1 iter4) |
| 19 | brand_19_output_routing | да | PR + отчёты в knowledge/episodes, трейс в traces |
| 20 | brand_20_tone_audience | да | Для Ивана - рубли и проценты, без жаргона в вопросах |
| 21 | risk_21_downside | частично | Downside 429 и таймаута разобран; 3 из 6 новых строк на 16.10 «частично» из-за N1, не из-за Ивана - сказано в PR; catch continue (K3) вне PR |
| 22 | risk_22_p | частично | Вероятность затяжного 429 низкая [ГИПОТЕЗА], не измерена |
| 23 | risk_23_crisis_scenarios | да | Затяжной 429: таймаут 30 мин, коммит заказов идёт, прогон красный (W1 S2/S3/S5) |
| 24 | risk_24_dependencies | да | Вызывающие accrual (3 скрипта), шаги yml, PLAN_FILE, client.js price_when перечислены |
| 25 | risk_25_reversibility | да | v3 не правится, откат = PLAN_FILE на v3; ретраи откатываются одним revert; кабинет не трогаем |
