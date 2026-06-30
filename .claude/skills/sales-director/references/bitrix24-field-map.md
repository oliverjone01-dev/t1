# Карта полей Bitrix24 категории 49 (Заказы GG RF)

**Owner:** sales-director + boris (CRM owner)
**Last update:** 2026-06-30 (после миграции из amoCRM)
**Source:** `analytics-mvp/src/scripts/b24/fetch-rop.ts:24-31` + ТЗ Кости

## Существующие поля (что fetch-rop.ts уже тянет)

### Стандартные сделки Bitrix
- `ID` - идентификатор сделки
- `TITLE` - название
- `ASSIGNED_BY_ID` (mgr) - ответственный менеджер
- `STAGE_ID` (stage) - текущая стадия (C49:NEW, C49:WON и т.д.)
- `STAGE_SEMANTIC_ID` (stageCode) - семантика (NEW, IN_PROGRESS, WON, LOST)
- `OPPORTUNITY` (budget) - сумма сделки
- `DATE_CREATE` (created) - дата создания
- `CLOSEDATE` (closed) - дата закрытия
- `SOURCE_ID` (source) - источник лида

### Кастомные поля (UF_CRM_*)

| Поле | UF_CRM_* | Что значит | Кто заполняет |
|---|---|---|---|
| `client` | UF_CRM_1767958427410 | B2B / B2C / Дилер | Менеджер при quals |
| `assort` | UF_CRM_DEAL_AMO_NSRJIWLJQEERRQTL | Ассортимент (Столы, Зеркала и т.д.) | Менеджер при quals |
| `reason` | UF_CRM_DEAL_AMO_ELDDYDEQCJZIKJIM | Причина провала | Менеджер при closing-lost |
| `dir` | UF_CRM_69A7F70A18816 | Бренд (genglass / valonti / metal_gm / gentero / glass-memory) | Авто либо менеджер |

### Лиды (UF_CRM_*)
- `UF_CRM_1772609158` (UF_LEAD_DIR) - направление лида

### История стадий
- `crm.stagehistory.list` - все переходы между стадиями
- Используется для `dwellCur` (дней в текущей стадии)
- Используется для `touchReal/touchAll` (количество касаний)

## Поля, которых НЕТ, но критично нужны (требование из ТЗ Кости)

Приоритет создания - **до запуска любой доработки дашборда**.

### Priority 1 (blocker для всех 5 sales-director dashboards-блоков)

| Имя поля | Тип | Обязательность | Stage гейт |
|---|---|---|---|
| Дата решения клиента | Date | Mandatory при переводе на C49:3 (Принимают решение) | Робот блокирует переход без значения |
| Дата следующего контакта | Date | Mandatory при переводе на C49:CONTACT_LATER | Робот блокирует |
| Причина отказа (структурированная) | Enum [Дорого / Сроки / Конкурент / Дубль / Спам / Передумал / Маркетплейс / Другое] | Mandatory при `C49:LOSE` или `C49:APOLOGY` | Робот блокирует переход |

### Priority 2 (для качественной аналитики)

| Имя поля | Тип | Обязательность | Цель |
|---|---|---|---|
| Дата изготовления (план) | Date | На C49:EXECUTING и C49:1 | Контроль производства |
| Decision-maker | String (Имя + Роль + Контакт) | Mandatory на сделках budget >300K | Multi-threading дисциплина |
| Discount % | Decimal | Auto-calc из price_listed - budget | Discount discipline metric |
| Source channel detail | Enum (n8n / Avito / Instagram / direct / referral / другое) | Mandatory на лиде | Канальная атрибуция |

### Priority 3 (nice-to-have, для расширенной аналитики)

| Имя поля | Тип | Цель |
|---|---|---|
| Conversation tone score | Auto-calc (NLP по комментариям) | Quality monitoring |
| Дата quote-acceptance клиентом | Date | Контроль КП-cycle |
| Followup count (auto) | Integer | Алгоритм 3 касаний |
| Days to first touch | Auto-calc | Speed-to-lead metric |

## Стадии воронки (PIPE)

Полный список из `build-rop.ts:100-101`:

```javascript
const PIPE = [
  ["C49:NEW",                  "Новая сделка"],
  ["C49:UC_LRFLH9",            "Квалификация"],
  ["C49:PREPARATION",          "Формируется предложение"],
  ["C49:UC_OGZUU0",            "(служебная)"],
  ["C49:PREPAYMENT_INVOIC",    "Отправлено КП"],
  ["C49:3",                    "Принимают решение"],
  ["C49:UC_8JTBV2",            "Долгострой"],
  ["C49:EXECUTING",            "Предоплата получена"],
  ["C49:FINAL_INVOICE",        "В производстве"],
  ["C49:1",                    "В производстве (2)"],
  ["C49:2",                    "В логистике"],
  ["C49:WON",                  "Закрыто WON"],
  ["C49:LOSE",                 "Закрыто LOSE"],
  ["C49:APOLOGY",              "Закрыто APOLOGY"]
]
```

## Стадии, которые ТЗ Кости предлагает добавить

| Стадия | ID-предложение | Между какими | Зачем |
|---|---|---|---|
| Счёт отправлен | C49:INVOICE_SENT (новый) | C49:3 → C49:EXECUTING | Контроль оплаты счёта (sep. от КП) |
| Связаться позже | C49:CONTACT_LATER (новый) | После C49:WON / параллельная воронка | Хранилище отложенных без шума в основной воронке |

**Решение архитектуры:** делать новые стадии в C49 либо отдельной воронкой?

- В C49 - проще для аналитики, единая база метрик. Минус: загружает воронку технической логикой.
- Отдельная воронка - чище основная, но требует cross-funnel reports.

**Рекомендация sales-director:** обе в C49. Простота data-pipeline важнее эстетики Bitrix.

## Роботы Bitrix (требование из ТЗ Кости)

| Робот | Стадия | Условие | Действие |
|---|---|---|---|
| Контроль времени KP | C49:PREPAYMENT_INVOIC | 1 рабочий день без touchReal | Задача менеджеру |
| Эскалация KP | C49:PREPAYMENT_INVOIC | 3 рабочих дня без touchReal | Задача менеджеру + РОПу |
| Фиксация даты | C49:3 | Переход без «Дата решения клиента» | Блокировка перехода |
| Напоминание о дате решения | C49:3 | За 2 дня до «Даты решения» | Reminder менеджеру |
| Эскалация по дате решения | C49:3 | 1 день после «Даты решения» без change | Задача менеджеру + РОПу |
| Контроль оплаты счёта | C49:INVOICE_SENT (new) | 1 рабочий день без действия | Задача менеджеру |
| Эскалация оплаты счёта | C49:INVOICE_SENT (new) | 2 рабочих дня без действия | Задача менеджеру + РОПу |
| Возобновление позже | C49:CONTACT_LATER (new) | За 1 день до «Даты следующего контакта» | Reminder менеджеру |
| Loss-reason validation | C49:LOSE / C49:APOLOGY | Переход без «Причины отказа» | Блокировка перехода |

## Sales-director рекомендации Boris (CRM owner)

**Прежде чем создавать поля:**

1. Согласовать формат с Иваном (что обязательно vs рекомендовано)
2. Скоординировать с Roman (мapping discount % - влияет на маржинальные отчёты)
3. Не ломать историю - старые сделки получают значение «не заполнено» вместо валидации
4. Робот-валидаторы запускать в режиме «warning» 14 дней, потом «block»
5. Train менеджеров до запуска hard-валидации (через trener)

**Critical path:**

```
[boris] создаёт поля Priority 1 в Bitrix
  → [trener] training сессия 1 час на отдел
    → [boris] роботы warning-mode 14 дней
      → [sales-director] daily check заполнения
        → [boris] переключение на block-mode
          → [sales-director] добавляет блоки в dashboard
            → [feniks] Step 12.5 audit перед production rollout
```

## Текущие baseline-показатели (snapshot 2026-06-30)

Для калибровки sales-director рекомендаций. Источник - `analytics-mvp/rop/data/rop.json` после применения чисток Димы.

| Метрика | Текущее | План | Gap |
|---|---|---|---|
| Активные продавцы в ростере | 25 | 25 | 0 |
| Лидов / месяц (без junk) | ~250 | 400+ | -150 |
| CR1 | 36% (с шумом 182 системных) / 55% target | 55% | -19pp |
| CR2 | 14% | 16% | -2pp |
| Speed-to-lead median | ~6 часов | <1 час | -5 часов |
| Средний чек | 80K | 80K | 0 |
| Zombie ratio (медианно) | ~28% | <10% | -18pp |

**Conclusion:** топ-3 рычага из 6 conversion squeezes (см. SKILL.md) дают math:
- Speed-to-lead +10pp на CR
- Чистка zombies +6pp
- Алгоритм 3 касаний +4pp

Суммарно +20pp потенциального roi на conversion если эти три рычага реализуются в Q3-2026.

## Лог изменений в этой карте

- 2026-06-30: создание после миграции с amoCRM, синтез с Костиным ТЗ
- следующий update: после реализации Priority 1 полей в Bitrix (orientation: 14 дней)
