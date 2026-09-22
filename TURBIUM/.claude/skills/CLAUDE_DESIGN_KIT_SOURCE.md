# Claude Design Kit: источник

Скиллы дизайн-кита установлены из стороннего репозитория (копированием, не симлинками,
чтобы пережить одноразовый контейнер Claude Code on the web).

- Источник: https://github.com/futurepitcher/claude-design-kit
- Коммит: 139e31559f2cd0a09db5b93e385bb10cd062c23d
- Дата установки: 2026-06-20
- Лицензия: см. CLAUDE_DESIGN_KIT_LICENSE

## Состав
- `ui-ux-pro-max/`: база знаний (67 стилей, палитры, 57 пар шрифтов, 25 типов графиков,
  99 UX-гайдлайнов, 13 стеков: React, Next.js, Vue, Svelte, Flutter и др.). Содержит
  `data/` (CSV-базы) и `scripts/` (search.py, core.py, design_system.py).
- `frontend-design/`: SKILL.md плюс `reference/` (typography, color-and-contrast,
  motion-design и др.). Apache-2.0, на основе Anthropic frontend-design.
- 21 точечный скилл: adapt, animate, arrange, audit, bolder, clarify, colorize,
  critique, delight, distill, extract, harden, normalize, onboard, optimize,
  overdrive, polish, quieter, remotion-best-practices, teach-impeccable, typeset.

## Не установлено из кита (осознанно)
- `agents/` (accessibility-auditor, ui-migration-architect): в GENGROUP строгий ростер
  12 агентов и протокол активации (Protocol 9). Не добавляю без обоснования.
- `rules/frontend-architecture.md`: скиллами не используется. Доступно в источнике.

## Внимание
Скилл `ui-ux-pro-max` содержит исполняемые Python-скрипты в `scripts/`. Это сторонний код,
он запускается только при явном вызове скилла. При желании проведите ревью перед использованием.
