---
name: optimize
description: Improve interface performance across loading speed, rendering, animations, images, and bundle size. Makes experiences faster and smoother.
user-invokable: true
args:
  - name: target
    description: The feature or area to optimize (optional)
    required: false
---

Identify and fix performance issues to create faster, smoother user experiences.

## Optimization Strategy

### Loading Performance
- **Images**: WebP/AVIF, proper sizing, lazy loading, responsive srcset, CDN
- **JavaScript Bundle**: Code splitting, tree shaking, dynamic imports, remove unused deps
- **CSS**: Remove unused CSS, critical CSS inline, containment
- **Fonts**: `font-display: swap`, subset, preload critical fonts, limit weights
- **Loading Strategy**: Critical resources first, preload/prefetch, service workers

### Rendering Performance
- Avoid layout thrashing (batch reads, then writes)
- CSS `contain` for independent regions
- Minimize DOM depth and size
- `content-visibility: auto` for long lists
- Virtual scrolling for very long lists

### Animation Performance
- GPU-accelerated: Use `transform` and `opacity` only
- Target 16ms per frame (60fps)
- `requestAnimationFrame` for JS animations
- Intersection Observer for viewport-based triggers

### React/Framework Optimization
- `memo()` for expensive components
- `useMemo()` / `useCallback()` for expensive computations
- Virtualize long lists
- Code split routes
- Debounce expensive operations

### Core Web Vitals
- **LCP < 2.5s**: Optimize hero images, inline critical CSS, preload, CDN
- **INP < 200ms**: Break long tasks, defer non-critical JS, web workers
- **CLS < 0.1**: Set dimensions on images/videos, `aspect-ratio` CSS, no content injection above fold

### Network Optimization
- Combine small files, SVG sprites for icons
- Pagination, GraphQL for needed fields only
- Response compression (gzip, brotli)
- Adaptive loading based on connection

**NEVER**:
- Optimize without measuring (premature optimization)
- Sacrifice accessibility for performance
- Use `will-change` everywhere
- Lazy load above-fold content
- Forget mobile performance
