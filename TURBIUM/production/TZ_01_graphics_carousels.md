# ТЗ 01 · Графические нейронки: карусели и статичные посты

Для: Nano Banana Pro (основная), запасные: Midjourney v7 / FLUX. Привязка: «Контент-план v2», вкладка «3. Карусели (78)». Владелец: ВИЗУАЛ (арт-директор фабрики). Гейт: первый слайд каждого типа - на phoenix-eval как эталон.

## 1. Style Prefix (вставляется в начало КАЖДОГО промпта)

```
Dark premium social media slide, vertical 4:5 (1080x1350), deep black background #0A0F0D.
Subtle dark teal #00BFA5 geometric grid pattern, barely visible. Moody, high-contrast,
cinematic lighting. Style: dark tech editorial branding (HUBONKT aesthetic). Color roles:
amber #FF8C42 = problem/alert, mint #4EEAC0 = solution/CTA, pure white = facts/numbers,
cool grey #8A9A94 = sources/captions. Minimum 30% negative space. Photorealistic digital
art, 8K quality.
```

## 2. Обязательный финал каждого промпта

```
Bottom left corner: tiny mint #4EEAC0 logo mark "Tb" inside square brackets.
```

## 3. Негатив-лист (добавлять всегда)

```
NO: cryptocurrency symbols on coins, recognizable human faces, em dashes in rendered text,
stock-photo smiling people, purple/blue neon, rainbow gradients, clutter, watermark,
lens flare overuse, comic style.
```

## 4. Правила текста в рендере

- Русский текст передавать в промпте В КАВЫЧКАХ с указанием: шрифт (bold condensed sans-serif, Inter Black / Bebas Neue), размер (huge/medium/small), цвет по роли.
- Слова-боли красить amber, слова-решения mint, факты white. Максимум 12 слов на слайде.
- Если генератор портит кириллицу: генерировать фон БЕЗ текста с зоной под него («upper 40% reserved for text overlay»), текст накладывать в Canva/Figma.

## 5. Шаблоны промптов по типам слайдов

### Тип A · Обложка-ШОКЕР (объект-метафора)
```
[STYLE PREFIX] COMPOSITION: upper 45% bold white condensed text: "<ХУК СТРОКА 1>",
below it 2.5x larger glowing amber #FF8C42 with soft light emission: "<УДАРНОЕ СЛОВО>".
Lower third: <ОБЪЕКТ-МЕТАФОРА: plain gold coin standing on edge half-dissolving into
bright amber fire particles flying right / cracked hourglass with amber sand / leaking
bucket with glowing drops>. Object emits warm amber glow. [NEGATIVE] [Tb MARK]
```

### Тип B · Факт-шок (чистая типографика)
```
[STYLE PREFIX] Center-dominant, text only. Top small white: "<ИСТОЧНИК, ГОД>".
Center: giant bold white "<ЦИФРА>". Below medium white: "<РАСШИФРОВКА 5-8 СЛОВ>".
Below smaller cool grey #8A9A94: "<ПОДСТРОЧНИК>". Grid slightly more visible - cold,
clinical, no warm tones. [NEGATIVE] [Tb MARK]
```

### Тип C · Голос клиента (raw-скриншот)
```
[STYLE PREFIX] Center: realistic Telegram-style chat bubble, dark grey #1C1C1E rounded
corners, white system font text: "<ЦИТАТА VoC ИЗ RESEARCH>". Grey username above:
"<РОЛЬ, НАПР. Владелец автосервиса>". Subtle amber #FF8C42 border glow. Raw, authentic,
like a real screenshot. [NEGATIVE] [Tb MARK]
```

### Тип D · Калькулятор/данные
```
[STYLE PREFIX] Stylized calculation laid out vertically: step lines in white, key numbers
in amber #FF8C42, final result line 2x larger in amber with glow. Background element:
faint funnel with leaking glowing drops. Small grey source caption. Clean data-visual
aesthetic, like premium fintech UI. [NEGATIVE] [Tb MARK]
```

### Тип E · Решение (mint-выдох)
```
[STYLE PREFIX] Calm composition, more air. 3 short lines bold text, key action words in
mint #4EEAC0: "<СТРОКА 1>" / "<СТРОКА 2>" / "<СТРОКА 3>". Right side: minimalist mint
glow icons (chat bubble, bell, funnel). Relief feeling after tension. [NEGATIVE] [Tb MARK]
```

### Тип F · CTA + Loop (зеркало обложки)
```
[STYLE PREFIX] MIRROR of slide 1 composition. Same object as cover but INTACT/HEALED,
emitting soft mint #4EEAC0 glow, mint particles floating up. Upper text bold white:
"<CTA ВОПРОС>", below 2.5x larger glowing mint: "<БЕСПЛАТНО / ОДНО СЛОВО>". Small white:
"AI-аудит за 5 минут → ссылка в шапке". [NEGATIVE] [Tb MARK]
```

## 6. Готовые промпты · Неделя 1 (карусель №1 «Конкурент получает твоих клиентов бесплатно»)

Слайд 1 (Тип A):
```
[STYLE PREFIX] COMPOSITION: upper 45% bold white condensed text: "Твой конкурент получает
твоих клиентов.", below it 2.5x larger glowing amber #FF8C42: "Бесплатно." Lower third:
single plain gold coin with smooth blank surface standing on its edge, tilting,
half-dissolving into bright amber #FF8C42 fire particles flying right. Warm amber glow on
dark surface below. [NEGATIVE] [Tb MARK]
```
Слайд 2 (Тип B): цифра "8 из 10", источник "НАФИ, 2025", расшифровка "бизнесов не имеют маркетинговой стратегии", подстрочник "Вообще никакой."
Слайд 3 (Тип C): цитата "Я потратил 120к на Директ. Получил 40 лидов. Купили двое. Это нормально?", роль "Владелец автосервиса".
Слайд 4 (Тип B/D): "Из 10 заявок ты забываешь перезвонить" + гигантское "3-5" + iPhone Notes со вычеркнутой заметкой "Перезвонить клиенту - Андрей", источник KT-Team.
Слайд 5 (Тип E): строки "Бот принимает заявку за 30 секунд." / "CRM напоминает перезвонить." / "Воронка доводит до оплаты." Mint-слова: Бот, CRM, Воронка.
Финальный слайд (Тип F): монета ЦЕЛАЯ с mint-свечением, текст "Узнай, где ты теряешь деньги." + "Бесплатно."

**ГЕЙТ ЦИФР (обязателен):** числовые слайды не уходят в рендер без sign-off агента data: источник проверяется ДО генерации, не постфактум. Цифры в примерах выше ("8 из 10 НАФИ", "3-5 KT-Team", "160 000 ₽") проходят ре-верификацию перед первым батчем.

Остальные 77 каруселей собираются этими же 6 типами: хук и слайды берутся из строк вкладки «3. Карусели», объект-метафора выбирается КРЕА из библиотеки (монета, ведро, песочные часы, колба, воронка, разбитый экран, чемодан с контактами, стикер на мониторе).

## 7. Share-картинка Калькулятора потерь (пик недели 4, механика Wrapped)

```
[STYLE PREFIX] Square 1080x1080 result card. Center: giant amber #FF8C42 number
"<N> ₽/мес" with glow, above it white text "Я теряю", below mint #4EEAC0 text
"Проверь себя: turbium.ru/calc". Elegant Tb element card in corner like a periodic table
tile. Design so beautiful people WANT to share it. [NEGATIVE] [Tb MARK]
```

## 8. Чек-лист качества (каждый рендер)

1. Палитра точная (пипеткой: #0A0F0D фон, амбер/минт не «поплыли»)
2. Текст читается с телефона на превью (прищурься)
3. Кириллица без артефактов (иначе: фон + оверлей)
4. Воздух ≥30%, лого [Tb] на месте
5. Amber только у боли, mint только у решения
6. Финальный слайд зеркалит обложку (loop с инверсией, независимо от числа слайдов)
7. Чек-лист супер-виральности (skill viral-mechanics): kill-пункты K1-K3 пройдены + >=6/10 остальных
