---
name: onboard
description: Design or improve onboarding flows, empty states, and first-time user experiences. Helps users get started successfully and understand value quickly.
user-invokable: true
args:
  - name: target
    description: The feature or area needing onboarding (optional)
    required: false
---

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

## Onboarding Principles

### Show, Don't Tell
- Demonstrate with working examples, not descriptions
- Real functionality in onboarding, not separate tutorial mode
- Progressive disclosure -- teach one thing at a time

### Make It Optional
- Let experienced users skip
- Don't block access to product
- Provide "Skip" or "I'll explore on my own" options

### Time to Value
- Get users to their "aha moment" ASAP
- Front-load most important concepts
- Teach 20% that delivers 80% of value

### Context Over Ceremony
- Teach features when users need them, not upfront
- Empty states are onboarding opportunities
- Tooltips and hints at point of use

## Design Onboarding Experiences

### Initial Product Onboarding
- **Welcome Screen**: Clear value proposition, time estimate, option to skip
- **Account Setup**: Minimal required information, smart defaults
- **Core Concepts**: 1-3 concepts max, interactive when possible
- **First Success**: Guide to accomplishing something real

### Feature Discovery
- **Empty States**: What will appear, why it's valuable, clear CTA, template option
- **Contextual Tooltips**: At relevant moment, pointing at UI element, dismissable
- **Progressive Onboarding**: Teach features as users encounter them

### Guided Tours
- Spotlight specific UI elements (dim rest)
- 3-7 steps max per tour
- Interactive > passive
- Focus on workflow, not features

### Empty State Design
Every empty state needs:
1. What will be here
2. Why it matters
3. How to get started (CTA)
4. Visual interest (illustration/icon)
5. Contextual help link

**NEVER**:
- Force users through long onboarding before they can use the product
- Patronize users with obvious explanations
- Show same tooltip repeatedly
- Block all UI during tour
- Create separate tutorial mode disconnected from real product
- Overwhelm with information upfront
