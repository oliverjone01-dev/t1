---
name: overdrive
description: Push interfaces past conventional limits with technically ambitious implementations. Shaders, 60fps virtual tables, spring physics, scroll-driven reveals -- make users ask "how did they do that?"
user-invokable: true
args:
  - name: target
    description: The feature or area to push into overdrive (optional)
    required: false
---

Push an interface past conventional limits. This isn't just about visual effects -- it's about using the full power of the browser to make any part of an interface feel extraordinary.

## MANDATORY PREPARATION

Use the frontend-design skill -- it contains design principles, anti-patterns, and the **Context Gathering Protocol**. Follow the protocol before proceeding -- if no design context exists yet, you MUST run teach-impeccable first.

**EXTRA IMPORTANT**: Context determines what "extraordinary" means. A particle system on a creative portfolio is impressive. The same particle system on a settings page is embarrassing.

### Propose Before Building

1. Think through 2-3 different directions with trade-offs
2. Present to user and get confirmation before implementing
3. Only proceed with confirmed direction

---

## What "Extraordinary" Means by Context

- **Visual/marketing surfaces**: Scroll-driven reveals, shader backgrounds, cinematic transitions
- **Functional UI**: Dialog morphing via View Transitions, 100k-row virtual scrolling, streaming validation
- **Performance-critical UI**: Search that filters 50k items without flicker, complex forms that never block main thread
- **Data-heavy interfaces**: GPU-accelerated Canvas/WebGL charts, animated data transitions, force-directed graphs

## The Toolkit

### Cinematic Transitions
- **View Transitions API**: Shared element morphing between states
- **`@starting-style`**: Animate from `display: none` with CSS only
- **Spring physics**: Natural motion with mass, tension, damping (motion, GSAP)

### Scroll-Driven Animation
- `animation-timeline: scroll()` -- CSS-only parallax, progress bars, reveal sequences
- Always provide static fallback for unsupported browsers

### Beyond CSS Rendering
- **WebGL**: Shader effects, particles (Three.js, OGL, regl)
- **Canvas 2D / OffscreenCanvas**: Custom rendering off main thread
- **SVG filter chains**: Displacement maps, turbulence, morphology

### Complex Property Animation
- **`@property`**: Register custom CSS properties for gradient/color animation
- **Web Animations API**: JavaScript-driven with CSS performance

### Performance Boundaries
- **Web Workers**: Move computation off main thread
- **OffscreenCanvas**: Render in Worker thread
- **WASM**: Near-native performance for computation-heavy features

## Implementation Rules

### Progressive enhancement is non-negotiable
```css
@supports (animation-timeline: scroll()) {
  .hero { animation-timeline: scroll(); }
}
```

### Performance rules
- Target 60fps. Below 50, simplify.
- Respect `prefers-reduced-motion` -- always
- Lazy-initialize heavy resources only when near viewport
- Pause off-screen rendering
- Test on real mid-range devices

**NEVER**:
- Ignore `prefers-reduced-motion`
- Ship effects that cause jank on mid-range devices
- Use bleeding-edge APIs without functional fallback
- Add sound without explicit user opt-in
- Layer multiple competing extraordinary moments
