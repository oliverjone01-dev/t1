# Design System

Read this when setting the theme/format and when adjusting layout. The
template `assets/carousel-template.html` already encodes everything here as CSS
variables and classes - this file is the human-readable spec behind it.

## Output formats

Set the format with a body class. The exporter reads each slide's real CSS
size, so output PNGs match exactly.

| Body class            | Output PNG  | Ratio | Use for |
|-----------------------|-------------|-------|---------|
| `format-ig-portrait`  | 1080 x 1350 | 4:5   | Instagram feed carousel (DEFAULT - max feed real estate) |
| `format-ig-square`    | 1080 x 1080 | 1:1   | Instagram square, mixed grids |
| `format-pinterest`    | 1000 x 1500 | 2:3   | Pinterest pins (VALONTI B2D priority) |
| `format-story`        | 1080 x 1920 | 9:16  | Stories / Reels cover |

Default to `format-ig-portrait` unless the user names a platform.

## Brand themes

One body class per brand. VALONTI is LIGHT; the other four are DARK. Do not
invert this - it is brand law.

| Body class           | BG       | Accent   | Ink      | Character |
|----------------------|----------|----------|----------|-----------|
| `theme-genglass`     | #0F0E0C  | #C8A951  | #F5F1E8  | Dark, warm. Confident craftsman |
| `theme-valonti`      | #F5F0EB  | #B8943D  | #1A1814  | LIGHT, marble. Quiet luxury |
| `theme-gentero`      | #0E1318  | #C8A951  | #F2F4F6  | Dark blue-graphite. B2B partner |
| `theme-metalgm`      | #121110  | #E8712B  | #F0EEEA  | Dark, raw. Safety-orange accent |
| `theme-glassmemory`  | #0C1620  | #C8A951  | #EAEFF3  | Dark memorial blue. Dignified |

Full token sets live in the template's `:root` theme blocks. Each theme defines:
`--bg --surface --surface-2 --accent --accent-soft --ink --muted --line`
plus `--brand-name --handle`.

### Gold is punctuation, not paint
Accent color appears on: the hook word, big stat numbers, the badge ring, the
CTA button, progress dots, brand mark. Never as a full background fill. One or
two accent moments per slide, no more.

## Typography

Display + body: **Montserrat** (loaded via Google Fonts in the template head).
Quote/serif accent: **Georgia**. Both must be loaded before export - the
exporter waits for `document.fonts.ready` plus a delay.

Type scale (already in template classes, full 1080px canvas):

| Class      | Size  | Weight | Role |
|------------|-------|--------|------|
| `.h-hero`  | 104px | 900    | Cover headline |
| `.h-lg`    | 72px  | 800    | Statement / CTA headline |
| `.h-md`    | 56px  | 800    | List / process / compare headline |
| `.big`     | 200px | 900    | Single hero stat |
| `.lead`    | 34px  | 400    | Cover supporting line |
| `.sub`     | 30px  | 400    | Body paragraph (muted) |
| `.eyebrow` | 24px  | 600    | Section label (accent, uppercase) |

Headline line-height stays tight (~1.0). Body line-height 1.4-1.5. Letter
spacing on headlines is slightly negative (-0.02em), on eyebrows wide (.22em).

## Layout rules

- Padding inside each slide: 96px top, 90px sides, 86px bottom. Generous on
  purpose - carousels are read on a phone, cramped slides die.
- Every slide carries the `.brandbar` footer: wordmark left, then either the
  `@handle` (cover and CTA) or progress dots + page number (interior slides).
- Update `.dots i.on` to the current slide index, and `.pageno` to `NN / total`.
- Asymmetric, left-aligned compositions. Avoid centering everything (anti-slop),
  except `.s-stat`, `.s-statement`, and `.s-quote` which center vertically.
- Safe zone: keep critical text within ~60px of edges. The bottom-right corner
  is where Instagram overlays its own UI on the first slide - keep it light there.

## Photos

When a slide uses a photo (`.s-image`), embed it as a base64 data URI directly
in the `background-image`. NEVER use a relative path (`foto.jpg`) - it renders
in the working folder but breaks everywhere else. See the note in
`scripts/export_carousel.py`. To base64-encode:

```bash
python3 -c "import base64,sys;print('data:image/jpeg;base64,'+base64.b64encode(open(sys.argv[1],'rb').read()).decode())" photo.jpg
```

Keep photos brand-appropriate (real product / factory / installation), never
generic stock. For VALONTI and GLASS-MEMORY, photo quality is non-negotiable.
