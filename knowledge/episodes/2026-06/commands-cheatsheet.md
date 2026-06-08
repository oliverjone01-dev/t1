# GENGROUP v9 - команды взаимодействия (зеркало для Google Sheets)

**Дата:** 2026-06-08
**Авторство:** Claude (gengroup-agents-v9), voice по skill humanizer-ru
**Источник для импорта:** `commands-cheatsheet.csv` (UTF-8, comma-separated, с кавычками)

## Как использовать этот файл

1. Открой Google Sheets, новый документ.
2. File → Import → Upload → выбери `commands-cheatsheet.csv`.
3. Separator: Comma. Convert text to numbers: NO (чтобы не сломались приоритеты P0-P4).
4. Закрепи первую строку (View → Freeze → 1 row).
5. Опционально: цветовая заливка по колонке «Приоритет» (P0 красный, P1 оранжевый, P2 жёлтый, P3 голубой, P4 серый).

## Структура приоритетов

| Приоритет | Что значит | Когда трогать |
|---|---|---|
| **P0 BLOCKER** | Без этого DELIVER невозможен. Hook + Step 12.5 + FENIX. | Каждая сессия, каждый деливер. |
| **P1 STRATEGIC** | Большие решения, multi-agent, кризис. | Еженедельно или по триггеру. |
| **P2 PRODUCTION** | Per-deliverable: контент, скрипты, КП, лендинги. | Ежедневно. |
| **P3 SPECIALIZED** | Узкие задачи: SEO, конкуренты, CRM, тренинги. | Ad hoc, 2-5 раз в месяц. |
| **P4 META** | Системные фишки и процессы. Не зовёшь напрямую. | Знать о существовании. |

## Полный список (46 пунктов)

См. `commands-cheatsheet.csv` в этой же папке. Каждая строка: № / приоритет / название / тип / что делает / когда стрелять / как вызвать / подводный камень.

## Топ-7 для повседневной работы

1. **`/feniks <path>`** - аудит перед deliver. Без этого Roadmap не публикуется, КП не отправляется.
2. **`/reality-audit <text>`** - тегирование цифр. Срабатывает hook автоматом на 27 триггерных слов.
3. **`Use feniks to audit <path>`** - тот же FENIX, но через subagent (когда хочется явного review).
4. **`Use data to verify figures`** - спрашивает «откуда цифра» на каждую.
5. **`/council <question>`** - multi-agent для cross-functional (3+ департамента, финансы >5M).
6. **`/crisis <trigger>`** - Protocol 8 activation. 4 агента, 24 часа.
7. **Auto-invoke skills** - brand / content-factory / humanizer-ru / encyclopedia-router грузятся сами на триггер. Можно не звать явно.

## Скрытные фишки (часто не используются)

- **Pre-Score Block standalone.** 5 вопросов Q1-Q5 из phoenix-eval можно запустить как «pre-flight check» без полного 25-checkpoint аудита. Экономит 30 минут.
- **Document-Type checklists.** 4 дополнительных listа (Strategy, КП, Landing, PPTX) внутри phoenix-eval. Тоже работают standalone.
- **`/agent activate <name>`.** Возвращает к жизни одного из 24 v8 агентов. Требует обоснования через Protocol 9.
- **Glossary bridging phrases.** Skill `glossary-v21` переводит client old-speak в v2.1 без direct correction. Менеджеру не нужно поправлять клиента вслух.
- **Inter-Skill Feedback Loop.** 3 повтора одной ошибки FENIX = автоматический update source skill. Skills эволюционируют сами.
- **Snapshot date.** Любые динамичные данные >90 дней = принудительный refresh. Без даты FENIX Accuracy-2 = 0/2.
- **Memory Tiering priority.** Конфликт «глоссарий vs episode» → глоссарий побеждает (Semantic > Procedural > Episodic > Working).
- **A2A schema validation.** Все межагентные сообщения проверяются schemas/a2a-message.json. Boris owner.

## Voice note (humanizer-ru применён)

Описания выше прошли через 5 блоков humanizer-ru: канцелярит, copula avoidance, significance inflation, promo, structural slop. Em dash и en dash отсутствуют. Где была инфляция эпитетов («ключевой», «важный», «эффективный») - заменено на конкретику (цифры, триггеры, имена файлов).

## Что НЕ попало в таблицу (out of scope)

- Bitrix24 MCP coupling (Sprint 3+, ждёт Иван).
- Browser/Computer Use для FENIX + СЕМЁН (Sprint 3+).
- Telemetry collector via Stop hook (Sprint 4+).
- First Reflexion CC-19 запуск (Protocol 15, после Tier 1+2 phoenix-eval rework).
