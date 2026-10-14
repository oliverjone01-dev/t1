# Пробы ФЕНИКСА 14.10.2026: Маркет «Отчет», блок 3а

Песочница: `git archive <rev> analytics-mvp | tar -x -C <scratch>/sb`; tsx и vitest из кэша npx, jsdom ставится в отдельный каталог scratch (`npm i jsdom@24`). Пути к jsdom, tsx и vitest в `render.js`, `build.sh`, `mut.py` - абсолютные пути песочницы 14.10, перед запуском поправить.

| Скрипт | Что делает | Запуск |
|---|---|---|
| build.sh | сборка страниц Маркета в каталог вне репозитория | `bash build.sh <analytics-mvp> <data-ym abs> <out>` |
| render.js | jsdom: блок 3а, строки блока 3, плашки, лист Excel (перехват rpxZip) по месяцам | `node render.js <out>/katya-report.html <json> [2026-10,2026-09]` |
| show.py, xl.py | печать блока 3а со страницы и из Excel | `python3 -I show.py <json> 2026-09`; `python3 -I xl.py <json> 2026-10` |
| indep.py | пересчёт 3а по сырому netting.ndjson своим кодом + пробы реестра (статус x п/п, дубли, платёжки, «В пути» по дням) | `python3 -I indep.py <netting.ndjson> 2026-10-10 [agg|probe|all]` |
| snap.py | последние п/п и «В пути» по снимку из git | `git show <sha>:analytics-mvp/data-ym/netting.ndjson \| python3 -I snap.py <sha>` |
| vputi.py, vputi2.py | «В пути» по статусу заказа и дате доставки (orders.ndjson) | `python3 -I vputi.py <netting> <orders> 2026-10-11 2026-09` |
| mut.py | 12 мутантов нового кода, vitest двух файлов, откат с проверкой | `python3 -I mut.py` |
