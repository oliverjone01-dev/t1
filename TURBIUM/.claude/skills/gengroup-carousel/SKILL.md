---
name: gengroup-carousel
metadata:
  version: 1.0.0
description: >
  Generate branded, production-ready social media carousels (Instagram, Pinterest,
  Stories) for any GENGROUP brand - GENGLASS, VALONTI, GENTERO, Metal-GM,
  GLASS-MEMORY. Produces real HTML/CSS slides themed to brand tokens, then exports
  each slide to an exact-size PNG via Playwright (1080x1350 IG portrait by default).
  Use this skill WHENEVER the user wants a carousel, slides for Instagram or
  Pinterest, a multi-slide post, swipe post, content carousel, инфографика-карусель,
  or asks to turn an article, tip, or topic into shareable slides for any GENGROUP
  brand - even if they do not say the word "carousel". Triggers: карусель, carousel,
  слайды, посты для инстаграм, pinterest пины, контент-карусель, свайп-пост,
  сделай карусель, слайды для соцсетей, инфографика. This is the carousel factory:
  HTML to PNG, no Figma, no Canva, reuses GENGROUP brand tokens.
---

# GENGROUP Carousel Factory

Turn a topic, tip, or article into a branded carousel: real HTML/CSS slides,
exported to exact-size PNGs. The method is HTML to PNG via a headless browser -
code is perfectly reproducible, so brand colors, type, and grid stay identical
across every slide. No Figma. Data and diagrams stay CSS/SVG (zero drift); real
photos go in image slots with a per-carousel style-lock so generated frames stay
consistent - see `references/images.md`.

## Files in this skill

- `assets/carousel-template.html` - master template. All slide types + 5 brand
  themes as CSS variables. You edit a copy of this, you do not write CSS from scratch.
- `scripts/export_carousel.py` - renders each `.slide` to a PNG. Deterministic.
- `scripts/generate_images.py` - fills image slots via Gemini/Nano Banana from each
  slot's brief (or `--dry-run` prints the prompts). Needs `GEMINI_API_KEY`.
- `references/design-system.md` - formats, brand tokens, typography. Read when theming.
- `references/slide-types.md` - the 9 slide types + HTML each expects. Read when building.
- `references/content-rules.md` - КЛИЕНТ-FIRST, hooks, anti-slop, brand tone,
  ФЕНИКС audit. Read before writing copy. This is what makes it not generic.
- `references/images.md` - image slots, art-direction briefs, Nano Banana 2 /
  own-upload sources, per-carousel style-lock, and "graphics stay CSS/SVG". Read
  when a slide needs a photo or texture.

## Workflow

### 1. Gather inputs (ask only what you cannot infer)
- **Brand** - which of the five. Required. If the topic clearly belongs to one
  (shower partitions -> GENGLASS, ритуальное стекло -> GLASS-MEMORY) infer it and
  say so. Respect brand architecture in `content-rules.md`.
- **Topic / content** - the subject, or raw notes, or an article. If the user
  gives a URL or a file, read it and pull the angle, the numbers, the proof.
- **Format** - default `format-ig-portrait` (1080x1350). Switch only if the user
  names a platform (Pinterest, Stories, square).
- **Reference** - if the user drops a screenshot of a carousel style they like,
  study it for layout cues. Do not copy competitor branding.

If the user just says "сделай карусель про X" with no brand, ask which brand
before generating. Otherwise proceed - do not over-ask. ("Делай, не спрашивай".)

### 2. Plan the arc
Read `references/slide-types.md`. Plan a 7-slide КЛИЕНТ-FIRST arc by default
(cover hook -> problem -> core fact -> what to do -> compare -> proof -> CTA).
Shrink to 5 for a simple tip, grow to 10 for a deep guide. Decide the slide type
for each slot before writing.

### 3. Write the copy
Read `references/content-rules.md` FIRST. Then write every slide:
- Lead from the client's pain, not the product.
- The hook slide is the one that matters - number or stake, one accent word.
- One concrete number per slide minimum. Real GENGROUP facts only, never invented.
- Match the brand's tone of voice.
- MANDATORY «Скользкая горка»: every slide except the CTA ends on an open loop (a
  `→` hook) that pulls to the next slide. See `content-rules.md`.
- HARD RULE: no em dash "—" and no en dash "–". Hyphen "-" only.

### 4. Build the HTML
- Copy `assets/carousel-template.html` to the working directory (e.g.
  `./carousel.html`). Do not edit the skill's copy in place.
- Set the body class: `<body class="theme-BRAND format-FORMAT">`.
- Fill each `<section class="slide s-TYPE">` with your copy using the HTML in
  `slide-types.md`. Delete unused slide types.
- Set the `.brandbar` wordmark and `@handle` for the brand. Update `.dots i.on`
  to the current slide index and `.pageno` to `NN / total` on each interior slide.
- Photos and textures: use image slots (`references/images.md`). Each slot renders
  a branded placeholder + art-direction brief until a file exists, so drafts export
  immediately and the brief doubles as the Nano Banana 2 prompt. Drop your own OR a
  generated file into `images/NN.jpg`, or embed a base64 data URI for a
  self-contained final. Apply ONE style-lock across the carousel so frames do not
  drift. Data and diagrams stay CSS/SVG, never raster.

### 4b. Fill image slots (optional)
If slides use image slots, either drop files into `images/` yourself, or generate:
```bash
export GEMINI_API_KEY=...    # Nano Banana 2: also set GEMINI_IMAGE_MODEL=<id>
python scripts/generate_images.py ./carousel.html --style-lock "<one lock for the whole set>"
```
Without a key or with `--dry-run` it prints the per-slot prompts to paste into Nano
Banana 2 by hand. Empty slots export as branded brief-placeholders, so this step is
optional and the carousel still ships as a draft.

### 5. Export to PNG
Make sure deps exist, then run the exporter:
```bash
pip install playwright pillow --break-system-packages 2>/dev/null; python -m playwright install chromium 2>/dev/null
python scripts/export_carousel.py ./carousel.html ./slides --prefix BRAND
```
Output: `./slides/BRAND-01.png ...` at exact format size. Add `--retina` to keep
the 2x render. The script waits for webfonts before shooting - do not remove that.

### 6. ФЕНИКС self-audit (before delivery)
Assemble the PNGs into a contact sheet and review it visually. Run the checklist
in `content-rules.md`. External carousels target 9.9/10 - score honestly, do not
inflate. If anything fails (weak hook, slop phrase, a stray dash, wrong theme,
clipped text, miscounted dots), fix the HTML and re-export. If it lands below
9.9, say what is weak instead of shipping quietly.

### 7. Deliver
- Present the `./slides/` PNGs (use `present_files` if available).
- Provide a caption (repeats the hook, expands one point, ends with CTA + @handle)
  and 8-15 hashtags, in brand voice, no dashes. See `content-rules.md`.
- State the carousel's hook angle and how many slides, so the user can decide fast.

## Worked example (what good looks like)

Input: "сделай карусель про выбор стеклянной перегородки"
- Brand inferred: GENGLASS (shower/partition = GENGLASS). Format: IG portrait.
- Arc: cover ("3 ошибки в стеклянной перегородке") -> problem (тонкое стекло ради
  цены) -> stat (8 мм минимум) -> list (что проверить) -> compare (дёшево vs
  правильно) -> quote (клиент) -> CTA (расчёт за 24 часа).
- Every slide has a number. Hook has a stake (переделка). Gold on one word.
- Export -> 7 PNGs at 1080x1350 -> audit -> deliver with caption + hashtags.

This exact carousel ships in `assets/carousel-template.html` as the default
sample - open it to see the pattern before building a new one.
