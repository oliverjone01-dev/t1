---
name: extract
description: Extract and consolidate reusable components, design tokens, and patterns into your design system. Identifies opportunities for systematic reuse.
user-invokable: true
args:
  - name: target
    description: The feature, component, or area to extract from (optional)
    required: false
---

Identify reusable patterns, components, and design tokens, then extract and consolidate them into the design system for systematic reuse.

## Discover

1. **Find the design system**: Locate component library, shared UI directory, design tokens. If none exists, ask before creating one.

2. **Identify patterns**:
   - Repeated components (buttons, cards, inputs)
   - Hard-coded values that should be tokens
   - Inconsistent variations of the same concept
   - Reusable layout and interaction patterns

3. **Assess value**: Used 3+ times? Would systematizing improve consistency? General pattern or context-specific?

## Extract & Enrich

- **Components**: Clear props API, sensible defaults, proper variants, accessibility built in, documentation
- **Design tokens**: Clear naming (primitive vs semantic), proper hierarchy, usage documentation
- **Patterns**: When to use, code examples, variations

## Migrate

- Find all instances of the patterns you extracted
- Replace systematically with shared versions
- Test for visual and functional parity
- Delete old implementations

**NEVER**:
- Extract one-off implementations without generalization
- Create components so generic they're useless
- Skip TypeScript types or prop documentation
- Create tokens for every single value (tokens need semantic meaning)
