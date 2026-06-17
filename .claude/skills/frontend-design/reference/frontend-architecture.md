# Frontend Architecture Patterns

General-purpose frontend architecture patterns for modern React, Vue, Svelte, and Tauri applications.

## Multi-Window Applications (Tauri/Electron)

When building desktop apps with web technologies, use these patterns:

| Pattern | Mechanism | Example |
|---------|-----------|---------|
| Window toggle | Rust/Node `invoke()` | `toggleSidebar()` via native bridge |
| Cross-window nav | Native events | `sidebar:navigate`, `sidebar:context-update` |
| State sync | localStorage `storage` events | Watch Zustand persist key across windows |
| Shared state | BroadcastChannel | Sync messages across windows |
| Browser fallback | Inline render | `{!isNative && <InlineComponent />}` |

## State Management (Zustand)

Convention: `use[Name]Store` with `persist` middleware. Persist key: `[app]-[name]`.

```typescript
export const useAppStore = create<AppState>()(persist(
  (set) => ({ /* state + actions */ }),
  { name: 'app-state', partialize: (state) => ({ /* persisted fields */ }) }
));
```

## API Layer (TanStack Query)

Organize queries by domain in `src/api/queries/[domain]/`. Use stale time categories:

| Category | Duration | Use Case |
|----------|----------|----------|
| Static | 1 hour | Rarely changing data |
| Reference | 10 min | Config, lists |
| Dynamic | 2 min | User content |
| Realtime | 30 sec | Live data |

## Component Patterns

- **Styling**: `cn()` utility (clsx + tailwind-merge)
- **Animation**: Framer Motion (`motion.div`, `AnimatePresence`)
- **Props**: JSDoc comments on interface fields, `className?: string` passthrough
- **Icons**: Barrel export from icon library (Lucide-based + custom SVGs)
- **Design tokens**: CSS variables -- `var(--color-surface-base)`, `var(--color-primary)`, etc.

## Route Composition

Keep route wiring composed and centralized:
- `App.tsx`: Startup, setup, onboarding, error boundary
- `AppRoutes.tsx`: Route tree, lazy page registry, standalone windows
- `AppShell.tsx`: Shell coordinator (header, nav, content area)

## Key Principles

| Rule | Reason |
|------|--------|
| UI -> API -> Service -> Repository -> Data | Layer isolation; no skipping |
| Dependencies via constructor injection | Testability; no hidden singletons |
| External services wrapped in adapters | Swappable implementations |
| Container queries for component responsiveness | Component-level adaptation |
| Progressive disclosure in complex UIs | Reduce cognitive load |
