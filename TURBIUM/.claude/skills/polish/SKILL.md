---
name: polish
description: Final quality pass before shipping. Fixes alignment, spacing, consistency, and detail issues that separate good from great.
user-invokable: true
args:
  - name: target
    description: The feature or area to polish (optional)
    required: false
---

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

Perform a meticulous final pass to catch all the small details that separate good work from great work.

## Polish Systematically

### Visual Alignment & Spacing
- Pixel-perfect alignment to grid
- Consistent spacing from design tokens
- Optical alignment for visual weight
- Responsive consistency across breakpoints

### Typography Refinement
- Hierarchy consistency throughout
- Line length 45-75 characters
- No widows or orphans
- Font loading without FOUT/FOIT flashes

### Color & Contrast
- All text meets WCAG contrast ratios
- Consistent design token usage
- Theme consistency across variants
- Tinted neutrals (no pure gray/black), never gray on color

### Interaction States (every interactive element)
- Default, hover, focus, active, disabled, loading, error, success

### Micro-interactions & Transitions
- All state changes animated (150-300ms)
- Consistent easing (ease-out-quart/quint/expo, never bounce/elastic)
- 60fps, only animate transform and opacity
- Respects `prefers-reduced-motion`

### Content & Copy
- Consistent terminology and capitalization
- No typos, appropriate length
- Consistent punctuation

### Icons & Images
- Consistent style and sizing
- Alt text on all images
- No layout shift, proper aspect ratios
- Retina support (2x assets)

### Forms & Inputs
- All inputs labeled, required indicators clear
- Error messages helpful and consistent
- Logical tab order

## Polish Checklist

- [ ] Visual alignment perfect at all breakpoints
- [ ] Spacing uses design tokens consistently
- [ ] All interactive states implemented
- [ ] All transitions smooth (60fps)
- [ ] Copy is consistent and polished
- [ ] Touch targets 44x44px minimum
- [ ] Contrast ratios meet WCAG AA
- [ ] Keyboard navigation works
- [ ] No console errors or warnings
- [ ] No layout shift on load
- [ ] Respects reduced motion preference
- [ ] Code is clean (no TODOs, console.logs)

**NEVER**:
- Polish before it's functionally complete
- Introduce bugs while polishing
- Perfect one thing while leaving others rough
