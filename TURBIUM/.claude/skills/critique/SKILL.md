---
name: critique
description: Evaluate design effectiveness from a UX perspective. Assesses visual hierarchy, information architecture, emotional resonance, and overall design quality with actionable feedback.
user-invokable: true
args:
  - name: area
    description: The feature or area to critique (optional)
    required: false
---

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

---

Conduct a holistic design critique, evaluating whether the interface actually works -- not just technically, but as a designed experience. Think like a design director giving feedback.

## Design Critique

### 1. AI Slop Detection (CRITICAL)
Does this look like every other AI-generated interface? Check for the AI color palette, gradient text, dark mode with glowing accents, glassmorphism, hero metric layouts, identical card grids, generic fonts.

### 2. Visual Hierarchy
- Does the eye flow to the most important element first?
- Is there a clear primary action? Can you spot it in 2 seconds?

### 3. Information Architecture
- Is the structure intuitive?
- Are there too many choices at once?

### 4. Emotional Resonance
- What emotion does this interface evoke? Is that intentional?
- Does it match the brand personality?

### 5. Discoverability & Affordance
- Are interactive elements obviously interactive?
- Would a user know what to do without instructions?

### 6. Composition & Balance
- Does the layout feel balanced?
- Is whitespace used intentionally?

### 7. Typography as Communication
- Does the type hierarchy signal what to read first?
- Is body text comfortable to read?

### 8. Color with Purpose
- Is color used to communicate, not just decorate?
- Does it work for colorblind users?

### 9. States & Edge Cases
- Empty states: Do they guide users toward action?
- Loading states: Do they reduce perceived wait time?
- Error states: Are they helpful and non-blaming?

### 10. Microcopy & Voice
- Is the writing clear and concise?
- Are labels and buttons unambiguous?

## Generate Critique Report

### Anti-Patterns Verdict
Pass/fail: Does this look AI-generated? Be brutally honest.

### Overall Impression
Brief gut reaction -- what works, what doesn't, single biggest opportunity.

### What's Working
2-3 things done well with specific reasons.

### Priority Issues
3-5 most impactful design problems with: What, Why it matters, Fix, Suggested command.

### Questions to Consider
Provocative questions that might unlock better solutions.

**Remember**: Be direct, be specific, prioritize ruthlessly.
