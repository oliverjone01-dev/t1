# Маршрутизация задач

> Дерево решений: какой агент, skill или команда. Перенесено из CLAUDE.md §11 дословно, кроме ссылок на удалённые скиллы. Нумерация разделов сохранена как в CLAUDE.md v9.1.

## 11. Decision tree: какой агент / skill / команда

```
Запрос Ивана
  │
  ├── Финансы/Roadmap/стратегия? ─── YES ──> Reality Audit (P9) → ДАТА + ФЕНИКС + МАРКО
  │
  ├── Контент (статья, пост, лендинг)? ─── YES ──> marco + maks (+humanizer-ru skill) → feniks Step 12.5
  │
  ├── Скрипт продаж, возражение? ─── YES ──> viktor (+humanizer-ru skill)
  │
  ├── SEO/сайт/AI Visibility? ─── YES ──> semyon (browser-use) → feniks Step 12.5
  │
  ├── CRM/1С/Bitrix? ─── YES ──> boris (A2A JSON)
  │
  ├── Кризис (триггер из P8)? ─── YES ──> /crisis → spartak + feniks + roman + emma
  │
  ├── Multi-team задача (3+ департамента)? ─── YES ──> /council → spartak оркестрирует
  │
  ├── Тренинг/буклет/проверка знаний? ─── YES ──> trener
  │
  └── Что-то рутинное (read, list, fix typo)? ─── default ──> сам, без агентов (haiku)
```
