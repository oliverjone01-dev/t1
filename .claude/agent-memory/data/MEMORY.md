# ДАТА - память источников (project scope)

Только карта источников и их надёжность. Никаких PII и чисел без пути.

## Где что лежит
- OZON живые данные: `analytics-mvp/data/` (n8n → fetch:live). `fixtures/` - только референс, в отчёты не подавать.
- Директ: `traces/YYYY-MM-DD/direct-writes.jsonl`, отчёты ТИМУРА в `knowledge/episodes/`.
- Bitrix24 категория 49: снимки `analytics-mvp/rop/data/rop.json` (см. skill sales-director).
- `knowledge/semantic/` - на 2026-09-06 содержит только `dialog-dashboard-metrics.md`; прайс и история продаж отсутствуют → 27000 / 350+ / 16000 м² = [ГИПОТЕЗА] до выгрузки.

## Повторяющиеся расхождения
- Директ «конверсии» vs CRM-лиды: 37/39 против 2 за 2026-07-07 [ДАННЫЕ: knowledge/episodes/2026-07/agent-timur-activation-20260708.md, раздел «Incremental value»] - никогда не подавать конверсии кабинета как лиды.
- Хэштеги 10 / 15 / 30 в трёх файлах [ДАННЫЕ: knowledge/episodes/2026-06/council-carousel-factory-v4-20260625.md, Phase C] - тройное расхождение не закрыто.
