---
name: arrange
description: Improve layout, spacing, and visual rhythm. Fixes monotonous grids, inconsistent spacing, and weak visual hierarchy to create intentional compositions.
user-invokable: true
args:
  - name: target
    description: The feature or component to improve layout for (optional)
    required: false
---

Assess and improve layout and spacing that feels monotonous, crowded, or structurally weak -- turning generic arrangements into intentional, rhythmic compositions.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

## Assess Current Layout

1. **Spacing**: Consistent or arbitrary? All the same (no rhythm)? Related elements grouped tightly?
2. **Visual hierarchy**: Apply the squint test -- can you identify the most important element?
3. **Grid & structure**: Clear underlying structure, or random? Identical card grids everywhere?
4. **Rhythm & variety**: Visual rhythm? Alternating tight/generous spacing? Monotonous repetition?
5. **Density**: Too cramped? Too sparse? Matches content type?

## Improve Layout Systematically

### Establish a Spacing System
- Use a consistent spacing scale (Tailwind, rem-based tokens, or custom)
- Name tokens semantically: `--space-xs` through `--space-xl`
- Use `gap` for sibling spacing instead of margins
- Apply `clamp()` for fluid spacing

### Create Visual Rhythm
- **Tight grouping** for related elements (8-12px)
- **Generous separation** between distinct sections (48-96px)
- **Varied spacing** within sections
- **Asymmetric compositions** when they make sense

### Choose the Right Layout Tool
- **Flexbox for 1D layouts**: Nav bars, button groups, card contents
- **Grid for 2D layouts**: Page structure, dashboards, data-dense interfaces
- Use `repeat(auto-fit, minmax(280px, 1fr))` for responsive grids without breakpoints
- Use named grid areas for complex page layouts

### Break Card Grid Monotony
- Don't default to card grids for everything
- Use cards only when content is truly distinct and actionable
- Vary card sizes, span columns, or mix cards with non-card content

### Strengthen Visual Hierarchy
- Use the fewest dimensions needed for clear hierarchy
- Space alone can be enough -- generous whitespace draws the eye
- Create clear content groupings through proximity and separation

### Manage Depth & Elevation
- Create a semantic z-index scale (dropdown -> sticky -> modal-backdrop -> modal -> toast -> tooltip)
- Build a consistent shadow scale (sm -> md -> lg -> xl)

**NEVER**:
- Use arbitrary spacing values outside your scale
- Make all spacing equal -- variety creates hierarchy
- Wrap everything in cards -- not everything needs a container
- Nest cards inside cards
- Use identical card grids everywhere
- Center everything -- left-aligned with asymmetry feels more designed
- Use arbitrary z-index values (999, 9999) -- build a semantic scale
