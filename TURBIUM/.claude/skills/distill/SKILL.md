---
name: distill
description: Strip designs to their essence by removing unnecessary complexity. Great design is simple, powerful, and clean.
user-invokable: true
args:
  - name: target
    description: The feature or component to distill (optional)
    required: false
---

Remove unnecessary complexity from designs, revealing the essential elements and creating clarity through ruthless simplification.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

## Simplify the Design

### Information Architecture
- Remove secondary actions, optional features, redundant information
- Progressive disclosure: Hide complexity behind clear entry points
- ONE primary action, few secondary, everything else tertiary or hidden
- Remove redundancy: If it's said elsewhere, don't repeat it

### Visual Simplification
- Reduce color palette: 1-2 colors plus neutrals
- Limit typography: One font family, 3-4 sizes, 2-3 weights
- Remove decorations that don't serve hierarchy or function
- Remove unnecessary cards -- use spacing and alignment instead
- Never nest cards inside cards

### Layout Simplification
- Linear flow: Replace complex grids with simple vertical flow where possible
- Full-width: Use available space generously
- Generous white space: Let content breathe

### Interaction Simplification
- Reduce choices: Fewer buttons, clearer path forward
- Smart defaults: Make common choices automatic
- Inline actions: Replace modal flows with inline editing
- ONE obvious next step, not five competing actions

### Content Simplification
- Shorter copy: Cut every sentence in half, then do it again
- Active voice: "Save changes" not "Changes will be saved"
- Remove jargon, marketing fluff, legalese
- Remove redundant copy: No headers restating intros

**NEVER**:
- Remove necessary functionality
- Sacrifice accessibility for simplicity
- Make things so simple they're unclear
- Oversimplify complex domains

> "Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away." -- Antoine de Saint-Exupery
