---
name: normalize
description: Normalize design to match your design system and ensure consistency across all components and pages.
user-invokable: true
args:
  - name: feature
    description: The page, route, or feature to normalize (optional)
    required: false
---

Analyze and redesign the feature to perfectly match your design system standards, aesthetics, and established patterns.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

## Plan

1. **Discover the design system**: Search for design system documentation, UI guidelines, component libraries, style guides. Understand core principles, component patterns, design tokens.

2. **Analyze the current feature**: Where does it deviate? Which inconsistencies are cosmetic vs functional? Root cause -- missing tokens, one-off implementations, or conceptual misalignment?

3. **Create a normalization plan**: Which components can be replaced with design system equivalents? Which styles need tokens? How can UX patterns match established flows?

## Execute

Systematically address inconsistencies across:
- **Typography**: Design system fonts, sizes, weights, line heights
- **Color & Theme**: Design system color tokens, remove one-off colors
- **Spacing & Layout**: Spacing tokens, grid systems, layout patterns
- **Components**: Replace custom implementations with design system components
- **Motion & Interaction**: Match animation timing and easing patterns
- **Responsive Behavior**: Align breakpoints and responsive patterns
- **Accessibility**: Contrast ratios, focus states, ARIA labels

## Clean Up

- Consolidate reusable components into design system
- Remove orphaned code made obsolete by normalization
- Lint, type-check, test for regressions
- Eliminate duplication

**NEVER**:
- Create new one-off components when design system equivalents exist
- Hard-code values that should use design tokens
- Introduce new patterns that diverge from the design system
- Compromise accessibility for visual consistency
