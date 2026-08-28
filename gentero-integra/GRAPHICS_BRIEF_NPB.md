# Съёмка под новые разделы GM. Промты для Nano Banana Pro

Три кадра. Все сняты и подключены 09.08.2026, промты ниже оставлены для
пересъёмки и для переноса приёма на другие разделы. Слоты в вёрстке стоят
независимо от файлов и до их появления
показывают схематичный чертёж, поэтому страница выглядит законченной на
любом этапе.

Формат промтов рассчитан на Nano Banana Pro: модель хорошо держит длинное
связное описание сцены и плохо реагирует на списки параметров через запятую.
Поэтому арт-дирекция здесь идёт прозой, а не набором тегов, как в
`GRAPHICS_BRIEF_GM.md` для предыдущей партии.

## Куда класть

PNG или JPG из генератора кладём в `gentero-integra/public/img/src/` под
именами из таблицы. Дальше `python3 prepare-images.py` обрежет по центру,
приведёт к размеру и положит WebP в `gentero-integra/public/img/`. Строки в
`SPEC` уже добавлены, ничего править не нужно.

| Имя файла | Размер после обработки | Где стоит | Состояние |
|---|---|---|---|
| `gm-suz` | 1600 x 900 | Раздел 06, «Партнёр получает не скидку, а поток» | подключён, 69 КБ |
| `gm-ritual` | 1600 x 900 | Раздел 07, начало раздела | подключён, 24 КБ |
| `gm-expo` | 1600 x 900 | Раздел 07, после «Что делаем руками» | подключён, 23 КБ |

Апскейла в скрипте нет. Генерируйте не меньше 1600 по ширине, лучше 2048.

---

## Общая рамка. Ставить в начало каждого промта

```
Editorial product photography in a near-black studio environment.
Single key light at 5200K placed 45 degrees camera left, cool rim light at
6500K from behind the subject, key to fill ratio around 8:1. Shot on a
full-frame camera at 50mm equivalent, aperture f/6.3, tripod mounted, no
motion blur. The palette is strictly desaturated: charcoal, graphite, cold
steel, bone white. There must be no warm amber tones, no teal grade, no
orange highlights anywhere in the frame. Shadows stay deep but keep detail,
blacks are never crushed. Surfaces show honest material texture: brushed
steel, the green polished edge of thick glass, matte powder coating, dry
granite. This is photographic realism, not a 3D render.
Absolutely no text, no lettering, no numbers, no logos, no watermarks, no
signatures anywhere in the image. No people, no faces, no hands.
```

Причина такой рамки: страница тёмная, единственный акцентный цвет лаймовый и
он занят интерфейсом. Тёплый или бирюзовый оттенок в кадре начнёт спорить с
акцентом вместо того, чтобы его поддерживать.

---

## 1. `gm-suz` · стартовый набор партнёра

Соотношение 16:9, горизонталь. Кадр работает под подписью, поэтому нижняя
пятая часть должна быть спокойной.

Идея кадра: показать, что партнёр получает вещественный набор, а не обещание.
Сознательно отказываемся от изображения экранов и интерфейсов. Ноутбук с
таблицей выглядит как сток, набор образцов выглядит как инструмент.

```
[РАМКА]

An overhead flat lay on a dark brushed steel worktop, camera looking straight
down. Arranged in a loose grid: nine rectangular glass samples of the same
size but different finishes, some clear with a green polished edge, some
frosted, some deep smoke grey, each about the size of a playing card and
raised slightly on thin dark spacers so a shadow separates them from the
surface. Next to the samples, a short stack of matte black anodised hardware:
clamps, a base plate, a set of stainless fasteners laid in a neat row. In the
lower right corner, the corner of a closed matte grey folder, deliberately
cropped by the frame edge, completely blank with no printing of any kind.
Composition is orderly but not sterile: the grid is slightly imperfect, as if
a person just laid it out. The bottom fifth of the frame is quiet empty
worktop for a caption.
```

Чего не должно быть: раскрытого каталога с текстом, экранов, планшетов,
телефонов, визиток, ярлыков с надписями. Любая надпись убивает кадр, потому
что она сразу читается как чужой бренд.

---

## 2. `gm-ritual` · образец в зале агентства

Соотношение 16:9, горизонталь. Самый деликатный кадр всей серии: он про
ритуальный рынок, и здесь легко скатиться либо в мрачность, либо в
неуместную нарядность. Нужна сдержанная точность выставочного зала.

```
[РАМКА]

A compact vertical memorial stele of thick laminated glass, roughly 60 cm
tall, standing on a low polished granite plinth in a quiet showroom interior.
The glass is clear with a faint green polished edge, its surface completely
blank with no engraving, no portrait, no ornament of any kind. Behind it, at
a distance and thrown out of focus, the suggestion of a dark showroom wall
and a second plinth, indicating a display space rather than a workshop. The
lighting is museum-like: a narrow beam from above grazes the glass edge and
makes it glow along the polished side, while the surrounding room falls away
into darkness. On the floor beside the plinth lies a soft caustic reflection
cast through the slab. The mood is restrained, dignified and modern, closer
to a design gallery than to a funeral parlour. Nothing in the frame suggests
grief directly: no flowers, no candles, no crosses, no religious symbols.
The left third of the frame is quiet darkness.
```

Два жёстких запрета для этого кадра. Первый: на стекле не должно быть ни
портрета, ни гравировки, ни дат. Портрет несуществующего человека на
мемориальном изделии это ложь в кадре, которую нельзя показывать
собственникам. Второй: никакого кладбищенского контекста, оград, надгробий
рядами и травы. Кадр про шоу-рум, а не про место захоронения.

---

## 3. `gm-expo` · выставочный стенд

Соотношение 16:9. Стоит вторым кадром в разделе 07, разбивает длинный блок
между лестницей действий и выводом. Смысл кадра: показать формат участия, где
работает изделие, а не стойка с полиграфией.

```
[РАМКА]

An empty exhibition stand in a dark trade show hall, photographed from a low
three quarter angle. The stand is a simple dark structure with two lit
plinths, each holding a vertical glass panel with a green polished edge.
Narrow spotlights from above pick out the glass and leave the structure
itself in shadow. The hall behind is deep dark space with faint suggestions
of other stands far out of focus. Every surface of the stand is blank: no
signage, no banners, no printed graphics, no screens. The stand reads as
confident and minimal, more like a gallery installation than a commercial
booth.
```

Проверка принятого кадра: стенд читается как галерейная инсталляция, на
конструкции нет ни одной надписи, зелёная кромка стекла видна, зал позади
уходит в темноту. Соседние стенды в расфокусе не мешают, потому что не несут
читаемых логотипов.
