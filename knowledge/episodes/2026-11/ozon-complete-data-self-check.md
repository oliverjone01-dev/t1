# Self-check: восстановление передачи данных Ozon

Область: актуальные цены/остатки/расчётные тарифы всего кабинета; исходные 7/28-дневные выгрузки конкурентов; общая проверка свежести. VPS и кабинетные настройки не изменяются.

1. Источники: реальные XLSX, контроль SHA256 по журналам; 18 архивных срезов и новый каталог 09.11 12:07. Да.
2. Население: все строки каталога, SKU уникален. Да.
3. Периоды: наблюдение цен по МСК; конкурентные окна7/28 без выдуманных границ. Да.
4. Отмены/возвраты: формулы заказов не меняются. Н/П.
5. Базы денег: разрыв цен отделён от фактической компенсации; прибыль не утверждается. Да.
6. Пропуски: null; не ноль. Да.
7. Свежесть: отдельный контроль каталога, бустинга, соинвеста, конкурентов и FBS. Да.
8. Покрытие: счётчики SKU, пропуски watchlist, лимиты1000. Да.
9. История: сервер merge по дню/фазе, запрет отката, backfill только явным окном. Да.
10. Идемпотентность: submit учитывает новый payload. Да.
11. Схемы: заголовки полей каталога, строгий контракт JSON. Да.
12. Независимая сверка денег: не выполнялась, не заявляется. Н/П.
13. Источник цены: фактическая цена реализации; без Ozon Card. Да.
14. Сборка: все17страниц smoke прошли на stage. Да.
15. Tests: 54 Python + 109 targeted TypeScript tests passed; exact-value DOM checks passed.
16. Full typecheck has errors outside new modules; clean baseline comparison not run. Full test suite is not green; only targeted checks claimed.
17. UI: full catalog, search, history; competitors 33 columns and pagination. DOM checks passed; visual check passed in Chrome: latest catalog, filter and product history.
18. XSS: HTML escaping и JSON '<' escaping. Да.
19. Privacy: no PII, credentials, raw XLSX or cost inputs. Expanded publication scope is being checked against all prior decisions.
20. Исторические эталоны: KONUX cap115803/buyer46670 на04.11вечер, точныйgap59.6987988221%. Да.
21. Schedule: prepare includes catalog automatically; competitor import documented. Automation prompts unchanged pending publication.
22. Deployment: local only; bot publication prepared, not dispatched.
23. Live: not verified; payload is not published.
24. Ограничения: соинвест по карте/компонентыбустинга/CPOsettings отсутствуют в XLSX; нельзя объявлять свежими; APIошибки проверяются.
25. Доказательство исправления: старая версия не выводит каталоги и использует октябрьских конкурентов; новая DOMпроверка требует точные поля из новых файлов, далее live.
