# Переезд VPS

Ветка `claude/friendly-brahmagupta-me4gk0` · PR #423 (draft) · план и контур в `infra/vps/` этой ветки
(README, INVENTORY, чек-листы). Сквозные правила по данным: [../semantic/data-privacy-migration.md](../semantic/data-privacy-migration.md).

**Цель.** Дашборды, сборы данных и расписания уходят с GitHub Actions/Pages на свой сервер в РФ.
Готово, когда 4 волны из `infra/vps/INVENTORY.md` переключены и Pages выключен.

**Порядок фаз.** 0 безопасность → подготовка (сервер, домен, S3, бот алертов) → 1 bootstrap.sh →
2 пилот РОП + Офис с параллельным прогоном 3-5 дней → 3 волны 1-4 → 4 закрытие Pages → 5 эксплуатация.

## 30.09.2026 · аккаунт Timeweb есть, выгрузки контактов из git убраны
**Сделано.** Воркфлоу `export-contacts` и `export-leads` удалены: они коммитили xlsx с контактами
клиентов в публичную ветку `rop-dashboard-v1` (пункт 5 фазы 0, исполнитель Claude). PR #423 слит с main
локально, конфликт только в `traces/2026-09-29/agents.jsonl` (объединено 123 + 53 строки → 134, потерь 0).
**Решения.** ЯДИ: аккаунт Timeweb Cloud на ООО «ДЖЕН ГРУП» заведён, баланс 3 000 ₽ (скриншот 30.09).
**Где в коде.** `.github/workflows/export-*.yml` удалены в этом PR; слияние PR #423 с main пока локально.
**Проверено.** `infra/vps/test/smoke-local.sh` на слиянии с main: «ВСЁ ЗЕЛЁНОЕ». `workflow_hygiene.py`:
одно предупреждение К7 по `infra-check.yml` (пайп без pipefail), исправлено, предупреждений 0.
Репозиторий на 30.09 всё ещё `private: false`, `has_pages: true` (GitHub API).
**Осталось.** Файлы `exports/won-contacts.xlsx` и `exports/junk-leads.xlsx` лежат в ветке
`rop-dashboard-v1` (и в истории). Сервер не заказан, домена нет, S3 и бота алертов нет.
Решения Ивана по ИИ-задачам и 152-ФЗ не получены.
