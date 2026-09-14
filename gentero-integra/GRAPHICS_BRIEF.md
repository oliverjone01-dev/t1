# ИНТЕГРА 2.0 - бриф на графику (GPT Image 2.0)

Десять изображений. Одна съёмка, один свет, один фотограф. Если картинки будут
выглядеть как десять разных стоков, весь эффект пропадёт, поэтому блок
арт-дирекшна ниже вставляется в КАЖДЫЙ промт без изменений.

Дата брифа: 2026-08-01. Целевая страница: https://oliverjone01-dev.github.io/t1/integra/

---

## 1. Куда сохранять

```
gentero-integra/
  public/
    index.html
    img/                        <- сюда лягут .webp, их делаю я
      src/                      <- сюда клади PNG из GPT Image
        hero-bg.png
        cat-01-railing.png
        cat-02-door-frame.png
        cat-03-shower.png
        cat-04-swing.png
        cat-05-sliding.png
        cat-06-partition.png
        warehouse-parts.png
        glass-processing.png
        og-cover.png
```

Имена без расширения менять нельзя: `cat-01-railing` и остальные девять прописаны
в разметке. Регистр важен.

**Важно про расширение.** В `index.html` стоят десять `.webp`, а не `.png`. Клади
PNG в `img/src/`, я сконвертирую и положу `.webp` рядом в `img/`. Если положить PNG
прямо в `img/`, страница их не увидит и останется на чертежах.

Клади PNG как выгрузилось из GPT Image, ничего не трогай. Конвертацию в WebP,
ресайз, обрезку под точный размер и сжатие делаю я: Pillow с поддержкой WebP уже
стоит в окружении. Если сконвертируешь сам, страница тоже заработает, но вес
будет хуже.

### Как передать мне

Любой из трёх способов, по удобству:

1. **Приложить файлы в чат.** Можно партиями, я разложу по путям сам.
2. **Положить в репозиторий** на ветку `claude/gentero-plan-03609o` в
   `gentero-integra/public/img/src/` и написать «картинки на месте».
3. **Прислать по одной** по мере готовности. Страница собрана так, что работает
   с любым количеством готовых картинок: отсутствующие слоты показывают
   аккуратную тёмную панель, а не сломанную иконку. Ничего не развалится, если
   половина ещё не готова.

---

## 2. Размеры и формат

| Файл | Пропорция | Выгружать из GPT Image | Итог на сайте |
|---|---|---|---|
| `hero-bg` | 16:9 | landscape, максимальный размер | 2400x1350 WebP q82 |
| `cat-01` … `cat-06` | 3:2 | landscape | 1200x800 WebP q80 |
| `warehouse-parts` | 16:9 | landscape | 1600x900 WebP q80 |
| `glass-processing` | 16:9 | landscape | 1600x900 WebP q80 |
| `og-cover` | 1.91:1 | landscape | 1200x630 WebP q85 |

Если GPT Image не даёт ровно нужную пропорцию, бери ближайшую **шире** нужного и
запас по краям 10%. Обрежу по центру композиции сам.

**Безопасные поля.** В каждой картинке держи 8% от каждого края свободными от
смыслового содержания. Карточки каталога имеют скругление 18px и обрезают углы,
а `hero-bg` уходит под градиентную шторку слева на 45% ширины.

---

## 3. Блок арт-дирекшна (вставлять в каждый промт целиком)

```
ART DIRECTION (apply exactly, do not reinterpret):
Single continuous photographic series, one photographer, one lighting setup.
Register: industrial premium editorial. Architectural documentation crossed with
high-end product photography. Not catalogue-white. Not warm lifestyle. Not CGI.

Lighting: one large soft key light from upper left at 45 degrees, colour
temperature 5200K. One hard rim light from behind right at 6500K, used only to
separate metal edges and glass edges from the background. Key to fill ratio 8:1.
Shadows deep and controlled, never muddy, never crushed to pure black.

Optics: full-frame camera, 50mm lens for wide subjects and 85mm for detail
subjects, aperture f/6.3, deep focus, the whole product sharp edge to edge. No
shallow depth-of-field gimmicks. No lens flare. No vignette beyond a natural 15%
falloff.

Palette: near-black to charcoal background (#060807 through #1a1d1b), cool
neutral greys, brushed stainless steel (#8e9490), anodised aluminium, and glass
showing a faint cyan-green refraction along its polished edges. Muted throughout.
Absolutely no yellow-green or lime accent anywhere in the image.

Surfaces: matte and physically believable. Brushed metal shows a real grain
direction. Glass shows real thickness at the edge. No blown-out specular
highlights, no plastic sheen, no mirror-perfect reflections.

Post: subtle film grain equivalent to ISO 400. Gentle contrast S-curve. Blacks
lifted to roughly #0a0c0b rather than pure zero. No HDR halos, no clarity
oversharpening, no colour grading toward teal-and-orange.

Absolutely forbidden in the image: any text, lettering, numbers, signage, labels,
logos, brand marks, watermarks, price tags, human faces, hands, people, arrows,
UI elements, or measurement callouts. No recognizable proprietary hardware
designs: patch fittings, floor closers, point fixings and track systems must use
generic neutral geometry, never the distinctive silhouette of a specific
manufacturer's product line.
```

Причина запрета текста и логотипов отдельно: любая надпись или знак, который
сгенерирует модель, будет выдуманным. Ставить выдуманные марки на фото,
подписанное как наш каталог, нельзя. Все подписи делает вёрстка.

Причина запрета узнаваемой фурнитуры: у ведущих производителей патч-фитингов,
напольных доводчиков и точечных креплений геометрия узнаваемая и защищённая.
Крупный план чужой запатентованной формы в нашем каталоге создаёт проблему на
ровном месте. Нужна нейтральная типовая геометрия.

---

## 3.А. Как удержать единый стиль между генерациями

Текстовый промт сам по себе консистентности не даёт: модель дрейфует по свету и
тону от кадра к кадру. Требование «шесть карточек читаются как одна съёмка»
выполняется процедурой, а не формулировкой.

**Порядок работы, не нарушать:**

1. Первым генерируй **`cat-02-door-frame`**. Это самый простой кадр: фронтальная
   геометрия, один объект, минимум сцены. Проще всего понять, поймала модель свет
   или нет. Сделай 3 варианта, выбери один. Это эталон серии.
2. Все остальные пять карточек генерируй **в том же треде**, следом за эталоном,
   добавляя в конец промта строку:
   `Match the lighting, tonality, grain and colour temperature of the previous
   image in this conversation exactly. Same studio, same session.`
3. `warehouse-parts`, `glass-processing`, `og-cover` и `hero-bg` генерируй
   последними, там же и с той же строкой.
4. Новый тред начинать нельзя: ссылка на предыдущий кадр работает только внутри
   одного разговора.

**Метод самопроверки, без него всё предыдущее бессмысленно.** Собери шесть
карточек каталога на одном экране рядом. Не по одной, а разом. Смотри три вещи:

- какая **светлее или темнее** остальных;
- какая **теплее или холоднее** по балансу белого;
- у какой **другая зернистость** или другая резкость.

Любая, которая выбивается хотя бы по одному признаку, идёт на перегенерацию, а не
в правку. Оценить «одна ли это съёмка», глядя на картинки по очереди,
физически невозможно, глаз не запоминает тон.

**Норма расхода:** 3 варианта на кадр, берёшь 1. На десять картинок это порядка
30 генераций. Если на кадр уходит больше пяти попыток, дело не в удаче, а в
промте: напиши мне, поправлю формулировку.

**Если модель отказывается генерировать.** Обычно спотыкается на словах, которые
читаются как запрос реального бренда или помещения. Убирай из промта названия
и заменяй на описание: не «Dorma-style patch fitting», а «generic brushed
stainless patch fitting». Отказы по словам `warehouse`, `factory`, `industrial`
лечатся заменой на `fabrication workshop interior`.

---

## 4. Промты

Каждый промт самодостаточен: копируешь блок арт-дирекшна, затем блок SUBJECT
ниже, отправляешь одним сообщением.

---

### 4.1 `hero-bg.png` - первый экран

Что это: цех в работе, задаёт регистр всему документу. Уходит под тёмную шторку
слева, справа остаётся читаемым.

```
SUBJECT:
Interior of a modern metal and glass fabrication workshop, photographed as a wide
establishing shot. Depth of field runs deep into the room. In the near-right third
of the frame, a vertical rack holds large tempered glass panels standing on edge,
their polished edges catching the rim light as thin cyan-green lines. Behind them,
softly out of emphasis but still sharp, sits heavy machinery: a fibre tube laser
and a CNC router, both matte industrial grey, powered down and clean. Steel dust
is absent, the floor is swept polished concrete in cool grey.

Composition: the left 45 percent of the frame is deliberately near-empty and
falls into deep shadow, giving a dark region for text. The visual mass sits right
of centre. Horizon line of the machinery at roughly two thirds height. Ceiling
shows industrial trusses and linear LED fixtures, dimmed, receding into darkness.

Mood: quiet, capable, expensive, slightly cold. A workshop that is under-used and
waiting, not a workshop mid-shift. No motion blur, no sparks, no welding light.

Aspect ratio 16:9, landscape.
```

---

### 4.2 `cat-01-railing.png` - перила и ограждения со стеклом

```
SUBJECT:
A stainless steel and glass balustrade installed on the edge of an interior
mezzanine. Round brushed stainless handrail, 50mm diameter, running horizontally
across the frame. Vertical stainless posts at regular intervals. Between and below
the handrail, panels of clear tempered glass 10mm thick, held by polished point
fixings, their exposed edges showing genuine glass thickness with a cyan-green
tint. The mezzanine floor is pale polished concrete. Behind the balustrade the
space drops away into a darker double-height volume.

Composition: three-quarter view from a standing eye height of 1.6 metres, camera
positioned so the handrail runs from lower left to upper right across the frame at
a shallow diagonal, giving the image direction. The glass reads as transparent,
not as a grey sheet: you can see the darker volume through it. Repetition of the
posts creates rhythm.

Aspect ratio 3:2, landscape.
```

---

### 4.3 `cat-02-door-frame.png` - стеклянная дверь в алюминиевой коробке

```
SUBJECT:
A single interior swing door: a clear tempered glass leaf 10mm thick set inside a
slim anodised aluminium frame of a P-shaped profile, wall-to-wall, in a dark
minimal interior. Matte black anodised finish on the frame, brushed stainless
lever handle at 1.05 metres height, concealed hinges, a discreet latch plate. The
glass is clear at the top two thirds and transitions to acid-etched frost across
the lower third.

Composition: straight-on elevation, camera centred on the door at 1.5 metres
height, lens 50mm, subject filling roughly 70 percent of the frame height with
even margin left and right. The room visible through the glass is darker than the
foreground, so the door reads as a bright graphic rectangle against depth. Floor
is dark micro-cement. One soft pool of key light lands on the frame's left edge,
tracing its full height as a thin bright line.

Aspect ratio 3:2, landscape.
```

---

### 4.4 `cat-03-shower.png` - душевое ограждение

```
SUBJECT:
A walk-in shower enclosure in a dark contemporary bathroom. A single fixed panel
of clear tempered glass 8mm thick with a protective coating, held by a slim
brushed stainless support profile at the floor and a matching stabiliser bar
running from the glass to the wall at ceiling height. Wall surfaces are large
format charcoal porcelain tile with tight grey grout lines. The floor is a
darker shade of the same tile with a linear stainless drain.

Composition: three-quarter view from 1.4 metres height, camera slightly to the
left, so the glass panel presents at an angle and its polished vertical edge
catches the rim light as a single clean cyan-green line down the full height.
Water is absent, everything is dry and immaculate. No fittings beyond a single
brushed stainless rain head, partially cropped at the top of the frame.

Aspect ratio 3:2, landscape.
```

---

### 4.5 `cat-04-swing.png` - маятниковые двери

```
SUBJECT:
A pair of double-acting swing doors in a commercial interior, glass leaves 12mm
thick, frameless, hung on visible brushed stainless top and bottom patch fittings
with a floor-mounted concealed closer plate flush in the dark floor. Full-height
brushed stainless push bars run horizontally across both leaves at 1.05 metres.
The doors sit in a wide opening in a dark plastered wall.

Composition: frontal view slightly off-axis from 1.5 metres, so one leaf is
caught mid-swing at a shallow 12 degree angle and the other is closed. That single
angled leaf is the whole point of the image: it communicates double-action without
any label. Beyond the doors, a brighter corridor recedes, giving the frame a
luminous centre against dark surroundings. Absolutely still, no motion blur.

Aspect ratio 3:2, landscape.
```

---

### 4.6 `cat-05-sliding.png` - раздвижные двери и перегородки

```
SUBJECT:
A sliding glass partition system in a dark interior. An exposed brushed stainless
top track runs the full width of the frame at ceiling height, carrying two visible
roller carriages. Suspended from it, a single large clear tempered glass leaf
10mm thick, partly overlapping a fixed glass panel behind it. A soft-close damper
unit is visible on the track as a small precise mechanical detail. Below, the
floor guide sits nearly flush in dark micro-cement.

Composition: wide horizontal view at 1.5 metres height, camera square to the
partition. The track and its hardware occupy the top fifth of the frame and are
rendered with real mechanical detail: this hardware is the product. The
overlapping glass creates a visible density shift where the two panes cross,
which reads as a darker vertical band. Behind the partition, a dimmer room.

Aspect ratio 3:2, landscape.
```

---

### 4.7 `cat-06-partition.png` - офисная перегородка с дверью в сборе

```
SUBJECT:
A glazed office partition forming a small meeting room inside a larger dark open
plan floor. Clear tempered glass panels held in slim matte black clamping
profiles at floor and ceiling, with thin vertical mullions every 1.2 metres. A
single glass door integrated into the run, with a matte black frame, brushed
stainless lever handle and a small round privacy lock with a red and white
occupancy indicator, rendered as a tiny mechanical detail with no lettering.

Composition: three-quarter view from 1.6 metres, camera outside the meeting room
looking in at a 30 degree angle so the partition run recedes toward the right and
the door sits at the near end. Inside the room, a plain dark table edge is just
visible, unfurnished otherwise. The glass shows both transparency and a faint
surface reflection of the darker room behind the camera.

Aspect ratio 3:2, landscape.
```

---

### 4.8 `warehouse-parts.png` - склад комплектующих

Что это: аргумент к части 1 пакета и к цифре 210 позиций.

```
SUBJECT:
A wall of open industrial shelving in a component warehouse, photographed square
on. Each shelf carries neatly aligned architectural hardware in raw material
finish: stainless steel hinges in stacked rows, cylindrical mortice locks, lever
handles laid parallel, coils of gasket, and short cut lengths of anodised
aluminium and stainless profile standing on end in a rack at the right edge. Grey
plastic parts bins in even rows across the middle shelves, all empty of labels.

Composition: frontal, camera at 1.5 metres, the shelving fills the frame corner to
corner with no floor and no ceiling visible, creating a dense grid. The repetition
across the grid is the subject. Depth comes from the shelf edges catching the key
light while the recesses fall into shadow. Everything is orderly, inventoried,
still, and clearly not moving: the stock reads as capital sitting idle.

Aspect ratio 16:9, landscape.
```

---

### 4.9 `glass-processing.png` - обработка стекла

Что это: раздел «Сайт в столе», показывает простаивающую мощность.

```
SUBJECT:
A glass processing line seen from the side. In the foreground, a large sheet of
clear float glass lies flat on a roller conveyor, its ground and polished edge
running toward the camera and catching the rim light as a continuous thin
cyan-green line. Behind it, a tempering furnace mouth stands closed and dark, and
a CNC edge-polishing machine sits idle with its head parked. Suction cup lifting
frames hang from an overhead rail at the left.

Composition: low camera at 1.1 metres, close to the glass surface, so the sheet
plane runs steeply away into the frame and exaggerates its length. The polished
edge is the sharpest thing in the image. Machinery is present but subordinate,
receding into cooler shadow. No operators, no motion, no glow from the furnace:
the line is powered but unused.

Aspect ratio 16:9, landscape.
```

---

### 4.10 `og-cover.png` - картинка для мессенджеров

Что это: превью, когда ссылку кидают в переписку. Сейчас превью пустое.

```
SUBJECT:
A tight architectural detail: the corner junction where a brushed stainless post
meets a clear tempered glass panel through a polished point fixing. Shot close, the
fixing occupies the centre of the frame and its machined chamfers are fully
resolved. The glass edge runs diagonally out of frame to the upper right, showing
genuine thickness and a cyan-green refraction. The background falls to near black
within 30 centimetres.

Composition: 85mm lens, camera at the same height as the fixing, subject placed
on the left third so the right half of the frame is deep empty shadow. That empty
half is intentional and must stay clean and unstructured.

Mood: precise, engineered, expensive. This single detail has to say "these people
know what a millimetre is" with no text at all.

Aspect ratio 1.91:1, landscape.
```

---

## 5. Приёмка картинок

Прежде чем отдавать мне, прогони каждую по чек-листу. Перегенерировать дешевле,
чем поставить слабую картинку в документ, по которому принимают решение.

- [ ] Ни одной буквы, цифры, надписи, логотипа, ценника в кадре
- [ ] Ни одного человека, лица, руки
- [ ] Нет лаймового и жёлто-зелёного, он живёт только в интерфейсе
- [ ] Стекло читается прозрачным, а не серым листом
- [ ] Толщина стекла видна на торце, торец даёт тонкую холодную линию
- [ ] Металл матовый, с направлением шлифовки, без пластикового блеска
- [ ] Чёрные зоны не выжжены в ноль, деталь в тенях сохранена
- [ ] Не выглядит как 3D-рендер: есть зерно, есть неидеальность
- [ ] Все шесть карточек каталога читаются как одна съёмка
- [ ] Свободные 8% по краям без смысловой нагрузки

Отдельно по `hero-bg`, с поправкой на вёрстку. Картинка ставится не на всю ширину:
она занимает правые 72% экрана, кроп по центру со смещением `60% 45%`, слева идёт
градиентная шторка. Значит левый край исходника частично срезается, и пустой должна
остаться **левая треть того, что останется после кропа**, а не левые 45% исходного
кадра. Практическое правило: мысленно отрежь левую четверть своего кадра, и вот в
оставшемся левая треть обязана быть тёмной и без деталей. Если модель забила эту
зону, перегенерируй, ретушировать дороже.

## 6. Чего в брифе намеренно нет

**Портретов Богдана, Романа и Андрея Владимировича.** В разделе «Кому выгодно»
три реальных человека. Генерировать их изображения нельзя: это будут выдуманные
лица реальных людей в документе, который они сами и будут читать. В вёрстке
стоят монограммы из инициалов, это честно и выглядит строго.

**Фотографий их настоящего склада и их сайта.** Всё, что генерируется, это
типовые изображения категории товара, а не съёмка конкретных объектов соседа.

Это требует явной оговорки на странице, и в первой редакции брифа тут была
ошибка: утверждалось, что подписи в вёрстке уже снимают вопрос. Они его не
снимали, видимых подписей у изображений не было вообще. Исправлено: под
`warehouse-parts` и `glass-processing` стоят видимые `figcaption` «Иллюстрация
категории, не фотография склада соседа» и «не фотография их линии», то же
продублировано в `alt`. У шести карточек каталога оговорка «пример изделия
категории» стоит в `alt`.

Это важно именно для этих двух кадров: они стоят в разделах, которые говорят про
ЕГО склад и ЕГО производство, и без подписи сгенерированное фото читается как
документальная съёмка чужого имущества.
