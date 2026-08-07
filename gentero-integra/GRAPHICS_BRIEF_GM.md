# Съёмка под вкладку DG & GM. Промты и куда класть

Четыре кадра. Слоты в вёрстке уже стоят и до появления файлов показывают
схематичный чертёж, поэтому страница выглядит законченной на любом этапе.

## Куда класть

PNG из генератора кладём в `gentero-integra/public/img/src/` под именами
из таблицы ниже. Дальше `python3 prepare-images.py` сам обрежет по центру,
приведёт к нужному размеру и положит WebP в `gentero-integra/public/img/`.
Апскейла в нём нет: если исходник меньше цели, файл останется как есть
и в лог упадёт предупреждение.

| Имя файла | Размер после обработки | Где стоит |
|---|---|---|
| `gm-hero` | 2400 x 1350 | Фон первого экрана |
| `gm-portrait` | 1600 x 900 | Раздел «Это не идея, а действующий бизнес» |
| `gm-complex` | 1600 x 900 | Раздел «Дистрибьюторская сеть» |
| `gm-metal-fence` | 1600 x 900 | Раздел «Металл серийно» |

После генерации добавить эти четыре строки в `SPEC` внутри
`prepare-images.py`, иначе скрипт их не увидит.

---

## Общая арт-дирекция. Ставить в начало каждого промта

```
Editorial product photography, near-black environment.
Key light 5200K at 45 degrees from camera left, rim light 6500K from behind
subject, key to fill ratio 8:1. Aperture f/6.3, full-frame 50mm equivalent,
tripod, no motion blur. Palette strictly desaturated: charcoal, graphite,
cold steel, bone white. No warm ambers, no teal grade, no orange highlights.
Deep shadows retain detail, no crushed blacks. Surfaces show honest texture:
brushed steel, polished glass edge, matte powder coat.
Absolutely no text, no lettering, no logos, no watermarks, no signatures.
No people, no faces, no hands.
Photographic realism, not render. Shallow but controlled depth of field.
```

Причина такой рамки: страница тёмная, единственный акцентный цвет лаймовый
и он занят интерфейсом. Если в кадре появится тёплый или бирюзовый оттенок,
фотография начнёт спорить с акцентом, а не поддерживать его.

---

## 1. `gm-hero` · фон первого экрана

Соотношение 16:9, горизонталь. Работает под текстом, поэтому левая треть
должна быть спокойной и тёмной: там ложится заголовок.

```
[ART DIRECTION BLOCK]

A single vertical memorial stele of thick laminated glass, 18 mm, standing
on a low dark granite base in an empty studio space. The glass is clear with
a faint green edge visible on the polished side. Light passes through the
slab and throws a soft caustic line on the floor behind it.
Composition: subject positioned in the right third of the frame, left two
thirds are empty graduated darkness for text overlay. Camera slightly below
eye level. Background falls to near black within one meter.
Mood: quiet, restrained, dignified. Not gloomy, not funereal kitsch.
No engraving, no portrait, no inscription on the glass. Blank slab only.
```

Проверка: если заголовок «GLASS MEMORY. Пополам.» ляжет поверх и станет
нечитаемым, кадр не подходит.

---

## 2. `gm-portrait` · керамическая печать

Ключевой кадр всей вкладки: он должен объяснить технологию без слов.

```
[ART DIRECTION BLOCK]

Macro-detail of a tempered glass panel with ceramic-fired imagery, shot at
a low grazing angle so the viewer sees that the image sits INSIDE the glass,
not on its surface. The polished edge of the glass is in sharp focus in the
foreground, showing the layered cross-section of the laminate.
A fingertip-free steel gauge or a caliper rests beside the edge for scale.
The imagery inside the glass is an abstract soft grey gradient, deliberately
non-figurative: no face, no portrait, no photograph of a person.
Composition: horizontal, edge running diagonally from lower left to upper
right. Background near black, out of focus.
Emphasis: depth of the material, thickness of the laminate, the fact that
color lives within the glass body.
```

Требование «не лицо» обязательно. Изображение человека в ритуальном контексте
делает кадр историей про конкретную смерть, а страница про производство
и партнёрство.

---

## 3. `gm-complex` · мемориальный комплекс

Показывает, из чего состоит крупный чек: не одна позиция, а ансамбль.

```
[ART DIRECTION BLOCK]

A complete memorial ensemble photographed as a product set on a neutral
dark studio floor, arranged as an architectural composition rather than
a grave site: a tall glass stele, a low steel fence section with laser-cut
geometric ornament, a glass flower box, a minimal steel bench.
All elements share one design language: straight lines, hairline profiles,
matte black powder coating on the steel, clear glass with polished edges.
Composition: horizontal, elements arranged in receding depth, tallest at
left. No ground, no grass, no cemetery context, no crosses, no religious
symbols, no flowers.
Treat it like furniture photography for a design catalogue.
```

Отсутствие кладбищенского контекста принципиально: кадр смотрят три
собственника, и он должен читаться как продуктовая линейка.

---

## 4. `gm-metal-fence` · металл серийно

Единственный кадр, где мы производители, а не покупатели. Он должен
показывать станок и повторяемость.

```
[ART DIRECTION BLOCK]

Detail shot of a laser-cut steel fence section, square profile tube 40x20 mm,
with a repeating geometric ornament cut clean through the wall of the tube.
The cut edges are sharp and unpolished, showing the characteristic laser kerf.
Matte black powder coating on part of the frame, bare steel on the freshly
cut section, so the two finishes are visible in one frame.
Composition: horizontal, the fence runs diagonally through the frame,
sharpest focus on the nearest ornament, falling off toward the back to show
that the pattern repeats identically many times.
No welds, no forged decorative elements, no scrollwork. The point is machine
precision and repeatability, not craft.
```

Отсутствие ковки принципиально: весь смысл раздела в том, что орнамент
режется лазером серийно, а не куётся поштучно.

---

## Как проверить, что серия сошлась

Сгенерировать первым `gm-portrait`, он самый сложный по свету. Остальные
три делать в том же треде, ссылаясь на него как на референс освещения.
Затем открыть все четыре на одном экране рядом: если у одного кадра фон
теплее или холоднее остальных, переснять именно его, а не подгонять
цветокоррекцией.

Плюс проверка на анти-медианность: если такой же кадр выдал бы генератор
по запросу «стеклянный памятник», кадр отклоняется. Отличать должны
детали, которые мы назвали явно: видимая толщина ламината, лазерный рез
без ковки, отсутствие кладбищенского контекста.
