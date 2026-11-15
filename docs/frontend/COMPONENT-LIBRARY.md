# Reusable Component Library Contract

Start with a small shared set. Promote a component to shared after repeated use or clear design-system value, not after one appearance.

## Suggested hierarchy

1. **Primitives:** Button, Input, Textarea, Select, Checkbox, Badge, Skeleton, Spinner, Icon.
2. **Compositions:** FormField, Dialog, Alert, Toast, Tabs, SearchField, DataTable, Pagination, EmptyState.
3. **App patterns:** AppShell, Navbar, Sidebar, PageHeader, FilterBar, ConfirmAction, PermissionGate (presentation only).
4. **Features:** `[feature]/components/*` until cross-feature reuse is justified.

## Component specification template

### [ComponentName]

- Purpose / when not to use:
- Public props (typed, defaults):
- Controlled vs uncontrolled behavior:
- Visual variants and size scale:
- Semantic element and keyboard behavior:
- Loading / disabled / error / empty cases:
- Focus management / accessible name:
- Responsive behavior:
- Test ID(s) / stories or examples:

## Rules

- Use composition over oversized boolean-prop APIs.
- UI components do not directly import Supabase clients unless explicitly designed as data-aware feature components.
- Keep domain logic in hooks/services, not primitive UI components.
- Add a usage example and unit/accessibility tests for shared components.
- Breaking shared API changes must document call sites and migration.
