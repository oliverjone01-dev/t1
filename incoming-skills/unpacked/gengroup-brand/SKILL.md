---
name: gengroup-brand
version: 1.1.0
description: "GENGROUP brand identity and design standards for all 5 brands: GENGLASS, VALONTI, GENTERO, Metal-GM, GLASS-MEMORY. Use this skill whenever creating ANY visual deliverable, HTML artifact, presentation, document, landing page, social media content, or marketing material for GENGROUP. Also triggers on: brand colors, typography, tone of voice, design system, anti-slop content, visual identity, brand guidelines, style guide, corporate identity. ALWAYS apply this skill for any content production task — it ensures premium quality and brand consistency across all outputs."
---

# GENGROUP Brand Identity & Design System

## When to Use

Apply this skill to EVERY deliverable that will be seen by humans: HTML artifacts, presentations (PPTX), documents (DOCX), landing pages, social media posts, email templates, commercial proposals (КП), calculator UIs, dashboards, reports.

**Auto-trigger keywords:** design, brand, visual, colors, landing, presentation, КП, калькулятор, лендинг, контент, пост, email, HTML, artifact, дизайн, стиль, оформление.

---

## Master Design System

### Color Palette

**Primary (all brands):**
- Background Dark: `#0A0A0A` — primary dark surfaces
- Background Alt: `#111111` — cards, panels, secondary surfaces
- Gold Accent: `#C8A951` — CTAs, highlights, premium accents
- White: `#FFFFFF` — primary text on dark
- Gray Text: `#999999` — secondary text, captions
- Border: `#222222` — subtle dividers

**Brand-specific accents (load from references/brand-colors.md when needed):**
- GENGLASS: Gold `#C8A951` + Industrial `#333333`
- VALONTI: Deep Gold `#B8943D` + Marble White `#F5F0EB`
- GENTERO: Corporate Blue `#2A4D6E` + Steel `#4A4A4A`
- Metal-GM: Raw Steel `#555555` + Safety Orange `#E8712B`
- GLASS-MEMORY: Memorial Blue `#1A3A5C` + Crystal `#E8E8E8`

### Typography

**Headlines:** SB Sans Display (fallback: Montserrat, Arial)
**Body:** Montserrat (fallback: Helvetica Neue, Arial)
**Accent/Quotes:** Georgia (fallback: Times New Roman)

**Hierarchy:**
- H1: 48-64px, weight 700, letter-spacing -0.02em
- H2: 32-40px, weight 600
- H3: 24-28px, weight 600
- Body: 16-18px, weight 400, line-height 1.6
- Caption: 14px, weight 400, color #999999

### Layout Principles

- **Dark-first:** Default background #0A0A0A, not white
- **Generous spacing:** min 48px between sections, 24px between elements
- **Asymmetric grids:** avoid centered-everything layouts (anti-AI-slop)
- **Full-bleed imagery:** photos and renders edge-to-edge when possible
- **Gold as punctuation:** use #C8A951 sparingly — CTAs, key numbers, section dividers. Never as background fill.

### UI Components (HTML/React Artifacts)

```css
/* Standard CSS variables for all GENGROUP artifacts */
:root {
  --bg-primary: #0A0A0A;
  --bg-secondary: #111111;
  --bg-card: #1A1A1A;
  --accent-gold: #C8A951;
  --accent-gold-hover: #D4B85E;
  --text-primary: #FFFFFF;
  --text-secondary: #999999;
  --text-muted: #666666;
  --border: #222222;
  --border-hover: #333333;
  --success: #4CAF50;
  --error: #E53935;
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
  --transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**Buttons:**
- Primary: background #C8A951, text #0A0A0A, border-radius 8px, padding 14px 28px
- Secondary: background transparent, border 1px solid #C8A951, text #C8A951
- Hover: scale(1.02), brightness(1.1)

**Cards:**
- Background: #1A1A1A or #111111
- Border: 1px solid #222222
- Border-radius: 12px
- Hover: border-color #C8A951 with 0.3s transition

**Inputs:**
- Background: #111111, border 1px solid #333333
- Focus: border-color #C8A951, box-shadow 0 0 0 2px rgba(200,169,81,0.2)

---

## Anti-Slop Content Protocol

MANDATORY for all text content produced by any agent:

1. **Authenticity:** Use REAL GENGROUP data — 16 000 m² production, 13 500+ orders, 160+ projects, 320+ dealers. Zero hypotheticals.
2. **Boldness:** If default ChatGPT can generate identical text → REJECT. Must be provocative, non-obvious.
3. **Specificity:** Exact numbers, ₽, %, m², dates. "Мы производим 200+ перегородок в месяц" not "мы производим много".
4. **Experience:** Human perspective — factory floor stories, client feedback, installation edge cases.
5. **Extractability:** Every paragraph = self-contained unit. Can be cut and pasted independently.
6. **Anti-Median Test:** If a generic LLM produces the same output without GENGROUP context → REJECT.

### Forbidden Patterns (AI Slop)
- "В мире современного дизайна..." — generic opener
- "Мы гордимся тем, что..." — corporate cliché
- "Инновационные решения" без конкретики
- "Широкий ассортимент" без цифр
- Purple/blue gradients, centered everything, Inter font
- Stock-photo aesthetics, rounded-corner everything

### Required Patterns
- Open with a FACT or PROVOCATION, not a platitude
- Include at least ONE specific number per paragraph
- Reference production reality (materials, processes, timelines)
- End with ACTION, not inspiration

---

## Tone of Voice by Brand

**GENGLASS:** Confident craftsman. Direct, technical when needed, warm but not fluffy. "Мы делаем. Вы получаете." Speaks from factory floor authority.

**VALONTI:** Quiet luxury. Restrained elegance. Short sentences. Let materials speak. "Камень. Металл. Стекло. Точка."

**GENTERO:** Professional partner. Solutions language. "1 объект = 6 зон. 1 подрядчик = 0 проблем." Business-to-business directness.

**Metal-GM:** Industrial pragmatism. Specs-first. Lead times. Capabilities. "Гибка, сварка, покраска — от чертежа до отгрузки за 10 дней."

**GLASS-MEMORY:** Respectful, dignified. Never salesy. Focus on craft and permanence. "Керамическая печать. Crystalvision. Память, которая не выцветает."

---

## Reference Files

For detailed brand-specific guidelines, load:
- `references/brand-colors.md` — Full color systems per brand with HEX, RGB, usage rules
- `references/competitors.md` — Positioning vs key competitors per brand
- `references/product-facts.md` — Key statistics, production data, capabilities for Anti-Slop content

---

## Quick Checklist Before Delivery

- [ ] Dark background (#0A0A0A or #111111) — NOT white
- [ ] Gold accent (#C8A951) used as punctuation, not flood
- [ ] SB Sans Display / Montserrat typography
- [ ] No centered-everything layout
- [ ] Anti-Slop: every paragraph has a specific number
- [ ] Brand tone matches the specific brand (GENGLASS ≠ VALONTI)
- [ ] No generic AI patterns ("В мире современного...")
- [ ] CTAs are action-oriented with urgency
