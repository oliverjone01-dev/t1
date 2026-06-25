# Slide Types

The template ships nine slide types. Each is a `<section class="slide s-TYPE">`.
Read this to pick the right type per slot and to see the HTML each expects.
Delete the types you do not use.

## Quick chooser

| You want to...                          | Use         |
|-----------------------------------------|-------------|
| Open with a scroll-stopping hook        | `s-cover`   |
| State one idea / name one problem big   | `s-statement` |
| Land one number hard, or a 2x2 of stats | `s-stat`    |
| Give 3-5 short points                   | `s-list`    |
| Show a sequence of steps                | `s-process` |
| Contrast wrong vs right / A vs B        | `s-compare` |
| A do-this checklist                     | `s-check`   |
| Social proof / a punchy line            | `s-quote`   |
| A photo with a caption over it          | `s-image`   |
| Drive the action                        | `s-cta`     |

## The default 7-slide arc (КЛИЕНТ-FIRST)

Always lead from the client's pain, never from the catalog.

1. `s-cover` - hook. The promise or the provocative number.
2. `s-statement` - the problem, from the client's world.
3. `s-stat` or `s-list` - the core fact / the spec that matters.
4. `s-list` or `s-process` - what to do about it.
5. `s-compare` - cheap-but-wrong vs done-right.
6. `s-quote` or `s-stat` - proof (client line, project count).
7. `s-cta` - the next step. One action, low friction.

Shrink to 5 for a simple tip, grow to 10 for a deep guide. Carousels of 7-10
slides earn the most saves; never pad with filler.

## HTML per type

### s-cover
```html
<section class="slide s-cover">
  <div class="eyebrow">SECTION LABEL</div>
  <h1 class="h-hero">Hook with one <span class="hl">accent</span> word</h1>
  <p class="lead">One line that earns the swipe.</p>
  <div class="arrow">Листай →</div>
  <div class="brandbar">
    <div class="mark"><b>GEN</b>GLASS</div>
    <div class="right"><span class="handle">@genglass</span></div>
  </div>
</section>
```

### s-statement
```html
<section class="slide s-statement">
  <div class="badge">01</div>            <!-- optional; .badge.solid for filled -->
  <h2 class="h-lg">One idea, <span class="hl">big</span></h2>
  <p class="sub">2-3 sentences. A real number belongs here.</p>
  <div class="brandbar">...dots + pageno...</div>
</section>
```

### s-stat (single hero number)
```html
<section class="slide s-stat">
  <div class="kicker">CONTEXT LABEL</div>
  <div class="big">8&nbsp;мм</div>
  <p class="cap">What it means, in 4-6 words</p>
  <p class="note">One sentence of substance.</p>
  <div class="brandbar">...</div>
</section>
```
For a 2x2 grid of numbers, replace `.big/.cap/.note` with:
```html
<div class="statgrid">
  <div class="item"><div class="v">320+</div><div class="l">дилеров</div></div>
  <div class="item"><div class="v">16 000</div><div class="l">м² цех</div></div>
  <!-- up to 4 -->
</div>
```

### s-list
```html
<section class="slide s-list">
  <h2 class="h-md">Headline</h2>
  <ul class="lst">
    <li><span class="n">1</span><span class="tx"><b>Point</b><span>optional detail line</span></span></li>
  </ul>
  <div class="brandbar">...</div>
</section>
```

### s-process
```html
<section class="slide s-process">
  <h2 class="h-md">How it works</h2>
  <div class="proc">
    <div class="step"><div class="num">1</div><div class="body"><div class="t">Step</div><div class="d">detail</div></div></div>
  </div>
  <div class="brandbar">...</div>
</section>
```

### s-compare
```html
<section class="slide s-compare">
  <h2 class="h-md">Wrong vs <span class="hl">right</span></h2>
  <div class="cols">
    <div class="col bad"><div class="ch">Cheap</div><ul><li>...</li></ul></div>
    <div class="col good"><div class="ch">Right</div><ul><li>...</li></ul></div>
  </div>
  <div class="brandbar">...</div>
</section>
```

### s-check
```html
<section class="slide s-check">
  <h2 class="h-md">Before you order</h2>
  <ul class="chk"><li><span class="box">✓</span>Item</li></ul>
  <div class="brandbar">...</div>
</section>
```

### s-quote
```html
<section class="slide s-quote">
  <p class="q">A real, specific line - not a generic testimonial.</p>
  <p class="by">Name<span>context</span></p>
  <div class="brandbar">...</div>
</section>
```

### s-image (photo + caption)
```html
<section class="slide s-image">
  <div class="photo" style="background-image:url('data:image/jpeg;base64,...')"></div>
  <div class="scrim"></div>
  <div class="cap">
    <h2 class="h-lg">Caption headline</h2>
    <p class="sub">supporting line</p>
    <div class="brandbar">...</div>
  </div>
</section>
```

### s-cta
```html
<section class="slide s-cta">
  <div class="eyebrow">Бесплатно</div>
  <h2 class="h-lg">The offer / next step</h2>
  <p class="sub">What they get, no fluff.</p>
  <div class="button">Написать в Direct →</div>
  <p class="swipe">Сохрани, чтобы не потерять</p>
  <div class="brandbar"><div class="mark">...</div><div class="right"><span class="handle">@...</span></div></div>
</section>
```
