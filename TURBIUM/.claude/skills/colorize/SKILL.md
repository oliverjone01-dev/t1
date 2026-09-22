---
name: colorize
description: Add strategic color to features that are too monochromatic or lack visual interest. Makes interfaces more engaging and expressive.
user-invokable: true
args:
  - name: target
    description: The feature or component to colorize (optional)
    required: false
---

Strategically introduce color to designs that are too monochromatic, gray, or lacking in visual warmth and personality.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

## Introduce Color Strategically

### Semantic Color
- Success: Green tones (emerald, forest, mint)
- Error: Red/pink tones (rose, crimson, coral)
- Warning: Orange/amber tones
- Info: Blue tones (sky, ocean, indigo)
- Status badges with colored backgrounds or borders

### Accent Color Application
- Primary actions: Color the most important buttons/CTAs
- Links: Add color to clickable text (maintain accessibility)
- Icons: Colorize key icons for recognition
- Headers: Add color to section headers

### Background & Surfaces
- Tinted backgrounds: Replace pure gray with warm neutrals (`oklch(97% 0.01 60)`) or cool tints
- Colored sections: Subtle background colors to separate areas
- Cards & surfaces: Tint slightly for warmth

**Use OKLCH for color**: Perceptually uniform, great for generating harmonious scales.

### Balance & Refinement
- **Dominant color** (60%): Primary brand color
- **Secondary color** (30%): Supporting color for variety
- **Accent color** (10%): High contrast for key moments
- Ensure WCAG compliance (4.5:1 for text, 3:1 for UI components)
- Test for color blindness

**NEVER**:
- Use every color in the rainbow (choose 2-4 beyond neutrals)
- Put gray text on colored backgrounds -- use a shade of the background color instead
- Use pure gray for neutrals -- add subtle color tint
- Use pure black (#000) or pure white (#fff) for large areas
- Use color as the only indicator
- Default to purple-blue gradients (AI slop aesthetic)
