# Карта репозитория GENGROUP (t1)

Одна строка на место. Сначала найди здесь, потом открывай. Большие файлы (xlsx, pdf, json-выгрузки, `data/`) целиком не читать.

## Знания и память
- `CLAUDE.md` - маршрутизатор: жёсткие правила, ростер, ссылки на `knowledge/os/`
- `knowledge/os/` - разделы бывшего большого CLAUDE.md дословно: ростер, протоколы, гейты, стиль, маршрутизация, источники, DoD аналитики, среды
- `knowledge/decisions.md` - журнал решений по всему репозиторию. Решённое не пересматривать без новой записи
- `knowledge/facts.md` - реестр проверенных цифр: источник, тег, дата проверки
- `knowledge/episodes/YYYY-MM/` - эпизоды: аудиты ФЕНИКСА, Council, диспуты (история, не переписывать)
- `knowledge/semantic/` - устойчивые правила и определения метрик (ставки ЯМ, метрики диалогов, поиск заказа)
- `knowledge/reflexion/` - ежемесячные ретро системы (Protocol 15)
- `knowledge/feniks/` - чек-лист аудита (25 чекпоинтов), калибровочные якоря, red-team пробы агента feniks
- `knowledge/sales/` - карта полей Bitrix24 категории 49 и методика оценки менеджеров
- `knowledge/sales-analysis/examples/` - образцы недельного и месячного отчёта по продажам
- `sessions/handoff/` - передаточные файлы переездов между сессиями, `_TEMPLATE.md` - шаблон
- `HANDOFF.md` - памятка, как передать проект коллеге в его собственный репозиторий
- `traces/YYYY-MM-DD/` - трейсы агентов (Protocol 14, история)

## Агенты и скиллы
- `.claude/agents/` - ростер из 13 агентов (feniks, spartak и бойцы), `archive/v8/` - неактивные агенты v8
- `agents/` - копия ростера для плагина, синхронизируется `bash .claude-plugin/sync-agents.sh`
- `.claude/skills/` - скиллы проекта: `roster-protocol`, `council`, `crisis`, `reflexion`, `pereezd`, `kostya-ai`, `direct`, дизайн-кит и др.
- `.claude/hooks/` - хуки: P9-детектор, Anti-Slop, гейты ФЕНИКСА, deliver-gate, трейсы, датчик контекста; `tests/run-hook-tests.sh` - регрессия
- `.claude/settings.json` - права и регистрация хуков; `.claude/workflows/council.js` - детерминированный Council (только по opt-in)
- `.claude/agent-memory/` - память feniks, spartak, data (калибровка, не факты бизнеса)
- `.claude-plugin/` - плагин `gengroup-roster` для Cowork и других репозиториев, `export-plugin.sh` - выгрузка в ветку `plugin`
- `agents-v9/` - манифест v9, миграция v8→v9, установка в Cowork и плагин
- `schemas/` - JSON-схемы A2A, audit-report, council-vote, agent-trace, roadmap-entry; `validate.py`, `smoke-test.py`

## Дашборды и аналитика
- `analytics-mvp/` - аналитика OZON/ЯМ: коннекторы, SQLite, витрины, дашборды; `fixtures/` только референс
- `kontur-dashboard/` - «Контур»: один интерфейс по проектам холдинга (GENGLASS, GLASS-MEMORY), деньги и динамика
- `kontur-ds/` - дизайн-система Контур DS 1.5 для рабочих интерфейсов
- `ozon-research/` - карта ниш Ozon для производственных цехов, сайт-упаковка исследования
- `genglass-plan-calculator/`, `gg-plan-radar-v2-src/` - План-Радар: калькулятор выполнения плана ОП GENGLASS
- `tochka-bank/` - ежедневный синк остатка и поступлений Точка Банка в Telegram
- `GENGLASS_Analytics_v12_hub/` - место загрузки документов аналитики для аудита ФЕНИКСА
- `DOC_00..DOC_05_*.md` - исходное ТЗ аналитики OZON: архитектура, API, n8n, дашборды, IA отчётов
- `.github/workflows/` - кроны снимков (Bitrix24, OZON, ЯМ, Директ, Точка, Контур) и деплой GitHub Pages

## SEO, контент и реклама
- `gg-seo-geo-monster/` - движок органической и AI-видимости 5 брендов: семядро, контент-раны, решения (`DECISIONS.md`)
- `SEO_PIPELINE_content_forge_prompt.md` - промпт генерации статей (Content Forge)
- `yandex-direct/` - настройка и аудит Яндекс.Директ, снимки и дашборд
- `smm/` - SMM-стратегия GENGROUP, промпты, рассылки
- `phoenix/` - лендинг-отчёт по направлению перегородок GENGLASS
- `GG-markplan-2026/` - единый маркетинговый план 2026 по 5 брендам (`DECISIONS.md`, `ROADMAP.md`)
- `*.png` в корне - изображения продукции (стеклянные двери, перегородки, фурнитура) для контента

## Продажи
- `gg-sales-academy/` - учебная платформа отдела продаж на разборах работы с клиентами
- `Kostya-analitycs-2026/` - разборы работы менеджеров и воронки (docx, xlsx, `extracted/`)
- `gg-message-automation/` - панель автосообщений в рабочие чаты (Telegram, Bitrix24)
- `kp-glass-memory/` - КП GLASS-MEMORY для физлица
- `glossary.md` - глоссарий брендов v2.1 (палитра, линия, коллекция)

## Бренды и партнёры
- `GENGROUP_BASE/` - Production Reference Library в Markdown (производство, бренды, регламенты, логистика, глоссарий)
- `GENGROUP_PRL_*.pdf` - та же библиотека PRL в PDF
- `stand-protocol/` - протокол совместного стенда MEBELIT × VALONTI
- `integra-gg-dg/` - «ИНТЕГРА 2.0»: документ к решению собственников GG и DG

## Исходные документы в корне
- `1_*.docx`, `1_Презентация_GENGLASS.pdf` - регламенты, продажи, энциклопедия GEN GROUP, анкета, презентация
- `GENGROUP_AI_MASTER_SYSTEM_v7_0.docx`, `GENGROUP_Protocol_9_Reality_Audit.docx`, `GENGROUP_Marketing_Strategy_2026.docx` - исходные системные документы
- `GENGROUP_v8_PRO_CHANGELOG.md` - история версий системы (не переписывать)
- `CLAU*.docx`, `CLAU*.pdf`, `GENGLASS__и_VALONTI___конкуренты_РФ_.pdf`, `VALONTI_каталог*.pdf` - исследования рынков и каталоги
- `TURBIUM_*`, `turbium_jtbd_*`, `edinoe_issledovanie_msb.docx`, `svodny_otchet_msb.docx`, `Эталон карусел-*`, `референс-TURBIUM-*` - материалы TURBIUM (основной проект TURBIUM - отдельный репозиторий turbium)
- `TZ_REBUILD_CLAUDE_CODE.md` - ТЗ пересборки системы под Claude Code
- `.impeccable.md` - дизайн-контекст проекта для скиллов дизайн-кита
