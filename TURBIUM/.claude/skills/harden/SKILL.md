---
name: harden
description: Improve interface resilience through better error handling, i18n support, text overflow handling, and edge case management. Makes interfaces robust and production-ready.
user-invokable: true
args:
  - name: target
    description: The feature or area to harden (optional)
    required: false
---

Strengthen interfaces against edge cases, errors, internationalization issues, and real-world usage scenarios that break idealized designs.

## Hardening Dimensions

### Text Overflow & Wrapping
```css
/* Single line with ellipsis */
.truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Multi-line clamp */
.line-clamp { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }

/* Prevent flex/grid items from overflowing */
.flex-item { min-width: 0; overflow: hidden; }
```

### Internationalization (i18n)
- Add 30-40% space budget for translations (German is 30% longer than English)
- Use CSS logical properties (`margin-inline-start`, not `margin-left`) for RTL support
- Use `Intl` API for date/time/number formatting
- Test with CJK characters and emoji

### Error Handling
- Network errors: Clear messages, retry button, offline mode
- Form validation: Inline errors near fields, preserve user input
- API errors: Handle each status code (400, 401, 403, 404, 429, 500)
- Graceful degradation: Core functionality works without JavaScript

### Edge Cases
- Empty states with clear next action
- Large datasets: Pagination or virtual scrolling
- Concurrent operations: Prevent double-submission
- Permission states: Clear explanation of why

### Accessibility Resilience
- All functionality keyboard accessible
- Proper ARIA labels and live regions
- `prefers-reduced-motion` support
- High contrast mode support

### Performance Resilience
- Progressive image loading, skeleton screens
- Clean up event listeners and cancel subscriptions on unmount
- Debounce/throttle expensive operations

**NEVER**:
- Assume perfect input
- Leave error messages generic
- Trust client-side validation alone
- Use fixed widths for text containers
- Block entire interface when one component errors
