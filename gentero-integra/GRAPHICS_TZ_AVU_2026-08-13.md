# ТЗ на изображения для лендинга АВЮ

**Дата:** 13 августа 2026
**Куда:** `gentero-integra/public/img/`
**Зачем:** 86% высоты страницы шло без единого визуального объекта. Тринадцать секций подряд без изображения, при этом более дорогая просьба (партнёрство пополам) лежит именно в этой части.

Существующая графика переиспользуется там, где рендер иллюстрирует категорию или возможность. Новые кадры заказываются только туда, где на изображении держится утверждение о факте.

---

## Правило, по которому кадры разделены

Рендер работает, когда показывает **тип изделия или возможность производства**. Владелец стекольного производства смотрит на такой кадр как на каталожную иллюстрацию и не спорит с ним.

Рендер вредит, когда под ним стоит **утверждение о факте** («бренд работает с 2016 года», «станок недозагружен»). Тут кадр обязан выглядеть как съёмка существующего объекта, а не как студийная выкладка. Поэтому в новых ТЗ везде заданы: рабочая среда вместо чёрного лимба, следы эксплуатации, естественный свет, оптические признаки репортажной съёмки.

**Отдельное требование по мемориальным изделиям.** Ни на одном кадре не должно быть читаемого имени, даты и портрета конкретного человека. Причина не в дизайне: выдуманная надгробная надпись на коммерческой странице это фабрикация памяти несуществующего человека, и если кадр когда-нибудь совпадёт с реальным именем, объясняться будет нечем. Гравировка показывается техникой и фактурой: орнамент, растровое травление, пейзаж, кромка. Именная табличка либо вне кадра, либо под острым углом, либо в зоне размытия. В промтах это записано в negative.

---

## Что переиспользуется без изменений

| Файл | Секция | Что подтверждает |
|---|---|---|
| `cat-01..06-*.webp` | `#gt-cat` | Шесть категорий изделий. Каталожная иллюстрация, спора не вызывает |
| `warehouse-parts.webp` | `#gt-need` | Ассортимент комплектующих на складе. Буквально предмет первой просьбы |
| `glass-processing.webp` | `#gt-what` | Линия обработки стекла. Иллюстрация возможности |
| `gm-metal-fence.webp` | `#gm-deal` | Металл своего производства в строке «что вносим мы» |

---

## Новые кадры

Общие требования ко всем четырём. Фотореализм, не иллюстрация и не 3D-визуализация с идеальными поверхностями. Палитра документа: глубокий нейтральный тёмный фон, холодный зелёный рефлекс от кромки стекла, тёплый акцент только от источника света в кадре. Никакого лаймового подкраса: лайм живёт в интерфейсе, а не в фотографии. Соотношение 16:9, длинная сторона не менее 2400px, отдавать webp качества 82. Композиция с запасом пустого поля с одной стороны под наложение текста, сторона указана в каждом ТЗ. Ни одной надписи, логотипа, водяного знака и цифры в кадре.

---

### 1. `gm-memorial-engraved.webp`

**Секция:** `#gm`, первый экран части про памятники. Подпись рядом: «Бренд работает с 2016 года».
**Задача кадра:** показать законченное изделие в среде, где оно живёт, а не на подиуме.

```
Photorealistic documentary photograph of a modern memorial monument made of thick
laminated glass with a brushed stainless steel base, installed outdoors on a granite
plinth in a quiet cemetery plot in autumn. The glass panel carries a deep raster
laser engraving of a birch forest landscape across its lower third, the engraving
frosted white against the transparent green-edged glass. Low overcast daylight,
soft directional light from camera left, wet granite reflecting the sky. Shallow
depth of field, 85mm lens at f/2.2, focus on the engraved texture, background of
bare trees and neighbouring plots falling into soft blur. Slight moisture on the
glass surface, a few fallen leaves at the base, faint weathering on the granite.
Cool desaturated palette, deep neutral shadows, natural colour grading, no
oversaturation. Composition places the monument in the right third of the frame,
leaving open blurred background on the left for text overlay.
Editorial documentary style, Kodak Portra colour response, 16:9.

Negative: readable text, names, dates, numerals, portraits of people, faces,
religious crosses, studio backdrop, black limbo background, plastic-looking
surfaces, HDR glow, lens flare, watermark, logo, tilted horizon, people in frame.
```

---

### 2. `gm-engraving-detail.webp`

**Секция:** `#gm-scale`, рядом с разговором о том, что нишу никто не измерял.
**Задача кадра:** макро, которое доказывает уровень обработки. Это единственный кадр, где видно, за что вообще платят.

```
Extreme close-up photograph of laser raster engraving on a 19mm thick low-iron
glass panel, shot at a shallow angle so the frosted engraved relief catches
raking light from the side. Visible micro-texture of the etched surface, the
characteristic depth gradient of photo-quality raster engraving rendering a
tree-branch motif, the polished green-tinted glass edge running through the
lower part of the frame. Backlit workshop environment slightly out of focus
behind the glass. 100mm macro lens at f/4, razor-thin focal plane on the etched
texture. Dust particles visible in the light beam. Cool neutral grade, deep
blacks, one warm highlight from a workshop lamp.
Composition keeps the engraved texture in the left two thirds, right third is
clean dark bokeh for text overlay. 16:9.

Negative: readable text, names, dates, numerals, human faces or portraits,
studio product-shot lighting, black limbo, perfect flawless surfaces, CGI
smoothness, HDR, watermark, logo.
```

---

### 3. `gm-set-installed.webp`

**Секция:** `#gm-deal`, «кто что вносит», вторая колонка про комплект.
**Задача кадра:** показать, что продаётся комплект, а не позиция. Именно на комплекте держится тезис про рост чека.

```
Photorealistic documentary photograph of a complete memorial set installed on a
cemetery plot: a glass memorial panel on a steel base, a low black powder-coated
metal fence with a geometric cut-out ornament enclosing the plot, a matching
metal flower bed with dark soil, and a narrow bench, all in the same black metal
family. Shot from a low three-quarter angle in soft overcast morning light,
early spring, thin frost on the metal, gravel path in the foreground. Wide
environmental view showing the whole plot in context with neighbouring plots
blurred behind. 35mm lens at f/5.6, natural perspective, slight vignette.
Muted cool palette, restrained contrast, documentary colour grading.
Composition places the set in the lower right, open sky and blurred trees in the
upper left for text overlay. 16:9.

Negative: readable text, names, dates, numerals, portraits, faces, people,
flowers in bloom, bright saturated colour, studio lighting, black limbo,
CGI perfection, HDR glow, watermark, logo, tilted horizon.
```

---

### 4. `gm-press-loaded.webp`

**Секция:** `#gm-grow`, к строке «станок керамопечати недозагружен».
**Задача кадра:** превратить утверждение о свободной мощности в актив, который видно. Это самый важный из четырёх: тезис про рост без новых станков держится именно на нём.

```
Photorealistic documentary photograph inside a working glass production shop:
a large flatbed ceramic printing machine with a glass sheet loaded on its bed,
the print head carriage mid-travel above the sheet, ceramic ink deposit visible
as a matte pattern on the glass surface. Industrial environment with real wear:
scuffed concrete floor, cable trays, a rack of glass sheets on edge in the
background, a tempering furnace door further back out of focus. Mixed lighting,
cold overhead fluorescents plus a warm inspection lamp at the machine. Fine
glass dust in the air catching the light. 24mm lens at f/4, slightly elevated
angle looking down the length of the machine bed, honest wide-angle perspective.
Neutral industrial palette, greys and steel, one warm light source, natural
colour grading, no beautification.
Composition keeps the machine along the right and lower part of the frame,
open darker shop space upper left for text overlay. 16:9.

Negative: readable text, brand names, numerals, control panel screens with
legible interface, human faces, spotless showroom floor, studio lighting,
black limbo, CGI perfection, HDR glow, lens flare, watermark, logo.
```

---

## Куда какой файл встаёт

| Файл | Секция | Тип вставки |
|---|---|---|
| `gm-memorial-engraved.webp` | `#gm` | Широкая полоса под первым экраном части GM |
| `gm-engraving-detail.webp` | `#gm-scale` | Половина ширины, рядом с текстом про неизмеренную нишу |
| `gm-set-installed.webp` | `#gm-deal` | Широкая полоса под таблицей вкладов |
| `gm-press-loaded.webp` | `#gm-grow` | Половина ширины, у карточки про свободную мощность |
| `warehouse-parts.webp` | `#gt-need` | Широкая полоса под четырьмя просьбами |
| `glass-processing.webp` | `#gt-what` | Половина ширины, у трёх шагов |
| `gm-metal-fence.webp` | `#gm-deal` | Половина ширины, к строке про металл |

Разметка уже стоит на странице и рассчитана на эти имена файлов. **Пока заказанного кадра нет, на его месте показывается запасной из существующих:**

| Заказан | Пока показывается |
|---|---|
| `gm-memorial-engraved.webp` | `gm-hero.webp` |
| `gm-engraving-detail.webp` | `gm-ritual.webp` |
| `gm-set-installed.webp` | `gm-complex.webp` |
| `gm-press-loaded.webp` | `gm-suz.webp` |

Запасные это студийные рендеры без гравировки и без производственного контекста. Они держат вёрстку и не оставляют половину документа пустой, но фактические утверждения секций не подтверждают: на них нет ни надписи, ни портрета, ни следов эксплуатации. Поэтому замена нужна.

Класть готовые файлы в `public/img/` можно по одному, пересборка страницы не требуется: как только файл появится, страница возьмёт его вместо запасного.

## Куда изображения не ставятся ни при каких условиях

`#gt-calc` и `#gm-calc`, `#gm-form`, `#end`, титул. Картинка рядом с деньгами читается как компенсация слабости чисел, а фон под цифрой отнимает читаемость у 15-пиксельных меток достоверности, на которых держится весь механизм доверия документа.

## Что проверить у готовых файлов

1. Ни одного читаемого имени, даты, цифры и портрета.
2. Длинная сторона не менее 2400px, вес после webp не более 400 КБ.
3. Открыть на чёрном фоне рядом с существующими `cat-*.webp`: если новый кадр выглядит светлее и теплее, увести грейд в холод.
4. Проверить на телефоне при ширине 390px: композиционный акцент не должен оказаться в обрезанной части.
