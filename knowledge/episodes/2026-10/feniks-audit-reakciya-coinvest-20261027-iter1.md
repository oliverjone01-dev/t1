# ФЕНИКС: Реакция, история соинвеста, iteration1

RETURN7.30/10. Проверен код134e5369, все8изменённых путей. p9_required=true.

## Блокирующие замечания

1. `coinvest_history.py/load_history`: пустой существующий gap_daily принят, новый участок исчезает без ошибки. Независимая проба вернула только18.09 вместо отказа. Нужен guard пустого/полностью непригодного участка до заменыJSON.
2. `gap-history.mjs`: warnDays общего читателя потерян. Фикстура50зрелыхSKU,20нулей даёт warnDays26.10, но bridge сохраняет20нулей без предупреждения. Передатьwarning и показать короткую метку затронутого периода, не менять численные значения.

## Независимая проверка

59тестов PASS:10Python,49TS. `/tmp/feniks-coinvest-probes.py` проверил rawratio52.31% для3артикулов,29/30дней всех5групп, gap04.10, архивные ряды и885старых эффектов.526событий: все неcoinvest поля/эффекты неизменны. Null разрывает SVGлинию. Текущий день отдельноpartial. Формула и денежные поля не менялись.

B1–B4 PASS; B5 PARTIAL(старые ограничения зафиксированы); B6FAIL пустойисточник; B7FAIL потеряwarning. Полныйtsc неgreen: автор сравнил71старуюошибку baseline/current, аудитор не заявляет исправление. Просмотрбраузера/полнаясборка выполнены автором, не выдаются за независимые пробы.

## Область

- analytics-mvp/katya/reakciya/app_kpi_timeline.js
- analytics-mvp/src/scripts/build-reakciya.ts
- analytics-mvp/tools/reakciya/README.md
- analytics-mvp/tools/reakciya/build.py
- analytics-mvp/tools/reakciya/coinvest_history.py
- analytics-mvp/tools/reakciya/gap-history.mjs
- analytics-mvp/tools/reakciya/test_coinvest_history.py
- knowledge/semantic/probes/reakciya-coinvest-history-20261027.md

Существующие ограничения(старыйSKUmap,causalwording,alertdate) не перепроектировались. Отчёт оценивает именно новый источник истории. Публикация не выполнена.

AUDITED: b76b23ca5ee943c6
VERDICT: return
