# ТЗ 02 · Видео-нейронки: Shorts / Клипы

Для: Kling 2.x / Veo 3 / Runway Gen-4 (b-roll и метафоры), HeyGen или аналог (talking-head), CapCut/Descript (монтаж). Привязка: «Контент-план v2», вкладка «4. Shorts (117)». Формат: 9:16, 1080x1920, 15-30 сек, до 20 МБ для TG.

## 1. Архитектура ролика (жёсткая, из плана)

| Секунды | Блок | Правило |
|---|---|---|
| 0-2 | ХУК | Первый кадр = стоп-палец: цифра во весь экран или паттерн-прерывание. Хук из колонки «Хук» плана, дословно |
| 2-8 | Бит 1 | Боль/факт + amber-акцент |
| 8-15 | Бит 2 | Пруф: цифра с источником НА ЭКРАНЕ (мелкий grey caption) |
| 15-22 | Бит 3 | Механика решения, mint-акцент |
| 22-28 | Вывод | Одна цифра/фраза крупно + CTA «полный разбор - в канале» |

Правила: мятные субтитры на тёмной плашке ВСЕГДА (смотрят без звука); смена кадра каждые 2-4 сек; никакой музыки громче голоса; вывод-кадр держится 3 сек.

Fallback 15 секунд: хук 0-2с + ОДИН сильнейший бит 2-9с + вывод-CTA 9-15с (биты 2-3 выбрасываются, не сжимаются).

**ГЕЙТ ЦИФР (обязателен):** цифры в кадре и субтитрах не уходят в продакшн без sign-off агента data (источник до генерации, не постфактум).

## 2. Style Prefix для видео-генерации

```
Vertical 9:16 cinematic video, dark tech editorial mood. Deep black environment #0A0F0D,
teal #00BFA5 ambient grid lines barely visible, dramatic side lighting with mint #4EEAC0
rim light. Amber #FF8C42 accents only on problem elements. Slow deliberate camera moves
(push-in, orbit), shallow depth of field, photoreal, 24fps, no text burned in.
```

## 3. Шаблоны видео-промптов по типам

### V-A · Объект-метафора (открывающий кадр шокера)
```
[VIDEO PREFIX] Macro shot: a plain gold coin standing on edge on dark reflective surface,
slowly igniting from one side, amber #FF8C42 fire particles drifting right, coin slowly
dissolving. Camera: slow push-in. Duration 5s, seamless loop. NO cryptocurrency symbols,
no text.
```
Вариации объекта: leaking bucket with glowing drops / hourglass with amber sand draining /
smartphone with missed call notification glow / funnel with drops escaping through holes.

### V-B · UI-анимация (raw-достоверность)
```
[VIDEO PREFIX] Screen-recording style: dark Telegram chat interface, incoming client
message at 01:47 AM, bot reply appears in 2 seconds with typing indicator, booking
confirmed card slides in with mint #4EEAC0 accent. Clean UI motion, 6s.
```

### V-C · Данные-визуал (пруф-бит)
```
[VIDEO PREFIX] Animated data visualization: bold white number counter rolling up to
"<ЦИФРА>", thin amber #FF8C42 bar chart growing, small grey source caption zone reserved
bottom. Premium fintech motion design, 4s.
```

### V-D · Talking-head (Dollar Shave механика: дерзко и просто)
HeyGen/съёмка на телефон (сырая честность работает лучше глянца):
- Кадр: тёмный фон, мятный rim-light сбоку (LED-лента), камера на уровне глаз, крупность по грудь.
- Скрипт = 3 бита из плана дословно, разговорный тон «свой, который шарит», без суфлёрского взгляда.
- Первая фраза = хук, без «привет, на связи».

## 4. Готовые пакеты · Неделя 1 (4 shorts из плана)

### Short 1 (вт 21.07): «Твой конкурент получает твоих клиентов. Бесплатно.»
- Кадр 0-2с: V-A монета загорается + субтитр-хук.
- 2-8с: V-D talking-head бит 1 «8 из 10 бизнесов живут без стратегии» (caption: НАФИ).
- 8-15с: V-B чат: заявка ночью остаётся без ответа, утром «уже записался к другим».
- 15-22с: V-B бот отвечает за 30 сек, mint.
- 22-28с: V-C вывод: «3-5 из 10 заявок ты просто забываешь» + CTA-плашка.

### Short 2 (чт 23.07): «Сколько заявок ты похоронил в этом месяце?»
- 0-2с: V-C счётчик рублей крутится вверх amber.
- Далее: расчёт по битам плана (А х 0.4 х чек), финал «160 000 ₽ в мусор» + CTA «точный расчёт в боте».

### Short 3 (сб 25.07): «Клиент ждёт ответ 5 минут. Потом уходит. Навсегда.»
- 0-2с: V-B пропущенное сообщение WhatsApp, таймер тикает amber.
- ДО/ПОСЛЕ: split-screen тёмный/мятный, финал «ответ за 30 секунд решает сделку».

### Short 4 (вс 26.07, standalone): «Проверь за 10 секунд: знаешь ли ты цену своего клиента»
- V-D talking-head с формулой на экране (V-C оверлей), финал «не знаешь = переплачиваешь».

Остальные 113 роликов собираются из этих 4 конструкторов; сценарии по битам уже в плане, вкладка 4.

## 5. Чек-лист качества видео

1. Хук-кадр работает БЕЗ звука и БЕЗ субтитров (визуально понятен)
2. Субтитры мятные, ≤7 слов на экран, не перекрывают лицо/объект
3. Источник цифры на экране в момент цифры
4. Ни одного кадра длиннее 4 сек
5. Вывод-кадр скриншотится как самодостаточная картинка
6. Лица не узнаваемы (кроме talking-head основателя)
7. Экспорт: 1080x1920, H.264, ≤20МБ, обложка = хук-кадр
8. Чек-лист супер-виральности: kill-пункты K1-K3 пройдены + >=6/10 остальных
