---
name: quieter
description: Tone down overly bold or visually aggressive designs. Reduces intensity while maintaining design quality and impact.
user-invokable: true
args:
  - name: target
    description: The feature or component to make quieter (optional)
    required: false
---

Reduce visual intensity in designs that are too bold, aggressive, or overstimulating, creating a more refined and approachable aesthetic.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

**CRITICAL**: "Quieter" doesn't mean boring or generic. It means refined, sophisticated, and easier on the eyes. Think luxury, not laziness.

## Refine the Design

### Color Refinement
- Reduce saturation to 70-85%
- Soften palette to muted, sophisticated tones
- Fewer colors, more thoughtfully used
- Neutral dominance: color as accent (10% rule)
- Tinted grays instead of pure gray
- Never gray on color -- use darker shade of that color instead

### Visual Weight Reduction
- Reduce font weights (900 -> 600, 700 -> 500)
- Hierarchy through subtlety: weight, size, space instead of color
- Increase breathing room, reduce density
- Reduce border thickness and opacity

### Simplification
- Remove decorative gradients, shadows, patterns that don't serve purpose
- Reduce border radius extremes
- Flatten visual hierarchy where possible
- Clean up blur effects, glows, multiple shadows

### Motion Reduction
- Shorter distances (10-20px instead of 40px), gentler easing
- Remove decorative animations, keep functional motion
- Subtle micro-interactions instead of dramatic effects
- Use ease-out-quart for understated motion
- Remove animations entirely if they serve no clear purpose

### Composition Refinement
- Smaller contrast between sizes for calmer feeling
- Bring rogue elements back into systematic alignment
- Replace extreme spacing variations with consistent rhythm

**NEVER**:
- Make everything the same size/weight (hierarchy still matters)
- Remove all color (quiet != grayscale)
- Eliminate all personality
- Sacrifice usability for aesthetics
