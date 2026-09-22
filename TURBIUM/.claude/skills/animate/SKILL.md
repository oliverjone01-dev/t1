---
name: animate
description: Review a feature and enhance it with purposeful animations, micro-interactions, and motion effects that improve usability and delight.
user-invokable: true
args:
  - name: target
    description: The feature or component to animate (optional)
    required: false
---

Analyze a feature and strategically add animations and micro-interactions that enhance understanding, provide feedback, and create delight.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first. Additionally gather: performance constraints.

---

## Assess Animation Opportunities

Analyze where motion would improve the experience:

1. **Identify static areas**:
   - **Missing feedback**: Actions without visual acknowledgment
   - **Jarring transitions**: Instant state changes that feel abrupt
   - **Unclear relationships**: Spatial or hierarchical relationships that aren't obvious
   - **Lack of delight**: Functional but joyless interactions
   - **Missed guidance**: Opportunities to direct attention or explain behavior

2. **Understand the context**:
   - What's the personality? (Playful vs serious, energetic vs calm)
   - What's the performance budget? (Mobile-first? Complex page?)
   - Who's the audience? (Motion-sensitive users? Power users who want speed?)
   - What matters most? (One hero animation vs many micro-interactions?)

**CRITICAL**: Respect `prefers-reduced-motion`. Always provide non-animated alternatives.

## Plan Animation Strategy

- **Hero moment**: What's the ONE signature animation?
- **Feedback layer**: Which interactions need acknowledgment?
- **Transition layer**: Which state changes need smoothing?
- **Delight layer**: Where can we surprise and delight?

**IMPORTANT**: One well-orchestrated experience beats scattered animations everywhere.

## Implement Animations

### Entrance Animations
- **Page load choreography**: Stagger element reveals (100-150ms delays), fade + slide combinations
- **Hero section**: Dramatic entrance for primary content
- **Content reveals**: Scroll-triggered animations using intersection observer
- **Modal/drawer entry**: Smooth slide + fade, backdrop fade, focus management

### Micro-interactions
- **Button feedback**: Hover scale (1.02-1.05), click scale down then up, ripple effect
- **Form interactions**: Input focus border transition, validation shake/check
- **Toggle switches**: Smooth slide + color transition (200-300ms)
- **Like/favorite**: Scale + rotation, particle effects, color transition

### State Transitions
- **Show/hide**: Fade + slide (not instant), 200-300ms
- **Expand/collapse**: Height transition with overflow handling, icon rotation
- **Loading states**: Skeleton screen fades, spinner animations, progress bars
- **Success/error**: Color transitions, icon animations, gentle scale pulse

### Navigation & Flow
- **Page transitions**: Crossfade between routes, shared element transitions
- **Tab switching**: Slide indicator, content fade/slide
- **Scroll effects**: Parallax layers, sticky headers with state changes

## Technical Implementation

### Timing & Easing

**Durations by purpose:**
- **100-150ms**: Instant feedback (button press, toggle)
- **200-300ms**: State changes (hover, menu open)
- **300-500ms**: Layout changes (accordion, modal)
- **500-800ms**: Entrance animations (page load)

**Easing curves (use these, not CSS defaults):**
```css
--ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);    /* Smooth, refined */
--ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);   /* Slightly snappier */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);     /* Confident, decisive */

/* AVOID - feel dated and tacky */
/* bounce: cubic-bezier(0.34, 1.56, 0.64, 1); */
/* elastic: cubic-bezier(0.68, -0.6, 0.32, 1.6); */
```

**Exit animations are faster than entrances.** Use ~75% of enter duration.

### Performance
- **GPU acceleration**: Use `transform` and `opacity`, avoid layout properties
- **will-change**: Add sparingly for known expensive animations
- **Monitor FPS**: Ensure 60fps on target devices

### Accessibility
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**NEVER**:
- Use bounce or elastic easing curves -- they feel dated
- Animate layout properties (width, height, top, left) -- use transform instead
- Use durations over 500ms for feedback -- it feels laggy
- Animate without purpose -- every animation needs a reason
- Ignore `prefers-reduced-motion` -- this is an accessibility violation
- Animate everything -- animation fatigue makes interfaces feel exhausting
