# Внешние дизайн-скиллы: источники

Установлены копированием (не симлинками), чтобы пережить одноразовый контейнер
Claude Code on the web. Тот же принцип, что и в `CLAUDE_DESIGN_KIT_SOURCE.md`.

Дата установки: 2026-08-01.

## 1. taste-skill (Leonxlnx)

- Источник: https://github.com/leonxlnx/taste-skill
- Коммит: `e988add20dab0fa97d7a76781c48961c8184288e` (2026-07-23)
- Лицензия: MIT, см. `TASTE_SKILL_LICENSE`
- 13 скиллов. Имя папки = поле `name` из frontmatter, поэтому оно не всегда
  совпадает с именем папки в апстриме.

| Установлено как | В апстриме | Что делает |
|---|---|---|
| `design-taste-frontend` | `taste-skill` | Основной анти-слоп фронтенд-скилл (87 КБ). Лендинги, портфолио, редизайны |
| `design-taste-frontend-v1` | `taste-skill-v1` | Legacy v1, сохранён для совместимости. Дублирует предыдущий |
| `brandkit` | `brandkit` | Генерация бренд-бордов, лого-систем, айдентика-деков |
| `industrial-brutalist-ui` | `brutalist-skill` | Стиль: швейцарская типографика + военный терминал |
| `minimalist-ui` | `minimalist-skill` | Стиль: тёплый монохром, бенто-сетки, без градиентов |
| `high-end-visual-design` | `soft-skill` | Шрифты, отступы, тени, карточки уровня агентства |
| `gpt-taste` | `gpt-tasteskill` | UX/UI + GSAP-моушн, структура AIDA. Запускает Python для рандомизации лейаута |
| `image-to-code` | `image-to-code-skill` | Сначала генерирует картинку дизайна, потом код по ней. Написан под Codex |
| `imagegen-frontend-web` | `imagegen-frontend-web` | Генерация веб-референсов картинками |
| `imagegen-frontend-mobile` | `imagegen-frontend-mobile` | То же для мобильных экранов |
| `redesign-existing-projects` | `redesign-skill` | Аудит существующего сайта, вычистка генерик-AI-паттернов |
| `stitch-design-taste` | `stitch-skill` | Генерация `DESIGN.md` под Google Stitch |
| `full-output-enforcement` | `output-skill` | Запрещает обрезать код и ставить заглушки в выводе |

## 2. skills (Emil Kowalski)

- Источник: https://github.com/emilkowalski/skills
- Коммит: `70744e3816f1d93eafb697161a8b880a7384c5ff` (2026-07-27)
- Лицензия: MIT, см. `EMIL_SKILLS_LICENSE`
- 8 скиллов, имена папок совпадают с апстримом.

| Скилл | Что делает |
|---|---|
| `emil-design-eng` | Философия полировки UI, дизайн компонентов, невидимые детали |
| `apple-design` | Подход Apple к интерфейсам и физике движения, перенесённый в веб |
| `animation-vocabulary` | Обратный словарь: описание эффекта → точный термин |
| `find-animation-opportunities` | Read-only поиск мест, где анимации нет, а нужна |
| `improve-animations` | Аудит моушна в кодовой базе + план внедрения |
| `review-animations` | Ревью анимаций по высокой планке. По умолчанию флагает, а не одобряет |
| `pick-ui-library` | Подбор библиотеки под задачу: числа, OTP, графики, drag-and-drop |
| `prototype` | Несколько разных версий UI-куска за визуальным пикером |

## 3. impeccable (mdskills.ai) - НЕ УСТАНОВЛЕН

`https://www.mdskills.ai/plugins/impeccable` заблокирован egress-политикой
окружения: прокси отдаёт 403 на CONNECT к `www.mdskills.ai:443`. Обходить
политику нельзя, поэтому скилл не поставлен. Нужен прямой git-репозиторий
или файлы.

Отдельно: скилл `teach-impeccable` уже есть в репозитории с 2026-06-20, но он
из другого источника (`futurepitcher/claude-design-kit`) и это не тот же
плагин.

## Совместимость с CLAUDE.md

Проверено при установке.

1. **Коллизий имён нет.** Ни одно из 21 имени не пересекается с существующими
   скиллами репозитория и с ростером агентов v9.
2. **Скан на опасные паттерны чист.** Обращений к секретам, `.env`, ключам API,
   выкачивания сторонних скриптов в файлах скиллов нет.
3. **Em dash.** Описания и тела внешних скиллов содержат `-` (em dash), который
   запрещён §7 CLAUDE.md. Источники не правились - правило действует на выход
   для клиента, а не на текст стороннего инструмента. При генерации русского
   контента финальный проход `humanizer-ru` обязателен как и раньше.
4. **Язык.** Все 21 скилл англоязычные и заточены под западный веб-продукт.
   Брендовые правила GENGROUP они не знают. Для любого деливерабла бренда
   `gengroup-brand` / `valonti-brand` остаются ведущими, внешние скиллы -
   вспомогательными.
5. **Step 12.5 не отменяется.** Ни один из этих скиллов не заменяет
   адверсариальный гейт ФЕНИКСА перед публикацией.

## Пересечения внутри набора

Набор избыточен по стилям и анти-слопу. Дубли смыслов:

- `design-taste-frontend` vs `design-taste-frontend-v1` - вторая явно legacy
- `design-taste-frontend` vs `frontend-design` (design kit) vs `ui-ux-pro-max`
- `redesign-existing-projects` vs `polish` + `audit` (design kit)
- `high-end-visual-design` vs `frontend-design`
- `improve-animations` / `review-animations` / `find-animation-opportunities`
  vs `animate` (design kit)

Прополка - решение Ивана. Удаление лишнего сократит шум при выборе скилла.
