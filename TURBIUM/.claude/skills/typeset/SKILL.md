---
name: typeset
description: Improve typography by fixing font choices, hierarchy, sizing, weight consistency, and readability. Makes text feel intentional and polished.
user-invokable: true
args:
  - name: target
    description: The feature or component to improve typography for (optional)
    required: false
---

Assess and improve typography that feels generic, inconsistent, or poorly structured -- turning default-looking text into intentional, well-crafted type.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

## Assess Current Typography

1. **Font choices**: Invisible defaults? (Inter, Roboto, Arial, Open Sans) Matches brand personality? Too many families?
2. **Hierarchy**: Can you tell headings from body from captions at a glance? Sizes too close together?
3. **Sizing & scale**: Consistent type scale or arbitrary? Body text >= 16px? Fixed rem for apps, fluid clamp() for marketing?
4. **Readability**: Line lengths 45-75 characters? Line-height appropriate? Sufficient contrast?
5. **Consistency**: Same elements styled the same way? Weights used consistently?

## Improve Typography Systematically

### Font Selection
- Choose fonts that reflect brand personality
- Pair with genuine contrast (serif + sans, geometric + humanist)
- Ensure web font loading doesn't cause layout shift (`font-display: swap`)

### Establish Hierarchy
- **5 sizes cover most needs**: caption, secondary, body, subheading, heading
- **Consistent ratio** between levels (1.25, 1.333, or 1.5)
- **Combine dimensions**: Size + weight + color + space for strong hierarchy
- **App UIs**: Fixed `rem`-based type scale
- **Marketing pages**: Fluid sizing via `clamp()` for headings

### Fix Readability
- `max-width` on text containers using `ch` units (`max-width: 65ch`)
- Tighter line-height for headings (1.1-1.2), looser for body (1.5-1.7)
- Increase line-height slightly for light-on-dark text
- Body text at least 16px / 1rem

### Refine Details
- `tabular-nums` for data tables and aligned numbers
- Proper `letter-spacing`: open for small caps/uppercase, tight for large display
- Semantic token names (`--text-body`, `--text-heading`), not value names
- `font-kerning: normal` and OpenType features where appropriate

### Weight Consistency
- Clear roles for each weight
- No more than 3-4 weights
- Load only weights you use

**NEVER**:
- Use more than 2-3 font families
- Pick sizes arbitrarily -- commit to a scale
- Set body text below 16px
- Use decorative/display fonts for body text
- Disable browser zoom
- Use `px` for font sizes -- use `rem`
- Default to Inter/Roboto/Open Sans when personality matters
