# Code Audit (Initial)

## Strengths
- Comprehensive automated test suite covering UI components, messaging flows, diary stats, and Supabase edge functions.
- Established design system with shared UI components (shadcn-style + Tailwind) and React Query data layer.
- Supabase Edge Functions organized with shared helpers for HTTP handling, preferences, TMDB/Supabase utilities.
- Build pipeline already configured with Vite, ESLint, Vitest, and coverage reporting.

## Key Issues
- ESLint fails with unused variables and accessibility violations in `src/modules/swipe/SwipePage.tsx` and unused types in `useDiaryLibrary`.
- Multiple Vitest failures: UI component tests report invalid component imports; several Supabase function tests fail due to missing exports/handlers and incorrect response shapes.
- `tmdb-proxy` handler not exported as expected by tests, leading to runtime errors.
- Swipe-related Edge Function tests (`swipe-trending`, `swipe-more-like-this`, `swipe-event`) return incomplete data (missing `title_id`) or incompatible module loading under Node.
- Catalog search function test fails because expected title fields are missing in mocked response.
- Build succeeds, but lint/test failures block CI and indicate underlying code quality issues.

## Prioritized Roadmap
### High Priority
- Resolve ESLint violations and unused state in `SwipePage`; add required keyboard handlers for overlay click targets.
- Fix component exports/imports used in UI tests to restore valid render trees.
- Correct Supabase Edge Function handlers (`tmdb-proxy`, `swipe-*`, `catalog-search`) to match expected contracts and pass tests.

### Medium Priority
- Audit large files like `SwipePage` for modularization into hooks/presentational components to improve maintainability.
- Strengthen typing for Supabase/TMDB responses and React Query hooks to reduce runtime issues.
- Add additional accessibility checks for interactive overlays and modals.

### Low Priority
- Review unused or legacy state (e.g., share preset flags) for removal or feature flagging.
- Optimize build outputs (large assets) and consider lazy-loading strategies for heavy routes.

