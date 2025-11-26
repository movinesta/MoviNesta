# MoviNesta UI/UX Modernization Proposal

## Section 1: High-level UI/UX audit
- **Current shell strengths**: Clean dark theme, clear bottom navigation, semantic routing ready for expansion, and consistent brand tagline in header. The existing gradient background and iconography establish a cinematic feel.
- **Gaps**: Limited hierarchy across placeholder screens, minimal form semantics, no documented spacing scale, and few interactive affordances for hover/focus/pressed states. Messaging and swipe flows have no guidance for media density or safe areas. Accessibility support is basic (focus ring) but lacks text contrast checks, skip links, and ARIA patterns for live updates.
- **Opportunities**: Lean into cinematic layering (glassmorphism with clarity), create reusable cards and chips, add adaptive layouts for conversation vs. feed, and codify microcopy tone inside components. Establish design tokens that map to Tailwind for consistency across future features.

## Section 2: Detailed improvement recommendations
1. **Navigation clarity**
   - Add a top-level **skip-to-content** link and visibly focusable bottom tabs. Preserve page title context in the header and add breadcrumbs for nested routes (e.g., `Messages / Conversation`).
   - Provide safe-area padding for iOS/Android insets and a compact “floating” tab bar on larger screens.
2. **Cards and lists**
   - Use a **cinema card** pattern with poster ratio, gradient overlay, and quick actions (watchlist, rate, share). Ensure keyboard support for primary CTA first, then secondary actions.
   - For lists (messages, diary), add **sticky section headers** and unread indicators with color + badge count.
3. **Forms and inputs**
   - Standardize input styles (label, helper, error) and add inline validation. Include password visibility toggle, clear buttons for search, and described-by helper IDs for accessibility.
4. **Feedback and system states**
   - Introduce **toast/snackbar** for quick feedback and a **status bar** for connectivity/offline state. Provide optimistic UI for likes/watchlist and show progress indicators when syncing.
5. **Microcopy & guidance**
   - Add contextual empty states (e.g., “Your nest is quiet — add a title you love”). Use concise CTA copy like “Save to Nest” instead of generic “Save.”
6. **Motion & micro-interactions**
   - Use **springy scale** on tab selection, gentle opacity/blur for modal entrances, and shimmer placeholders for posters. Keep durations between 120–200ms with `ease-out` for exits and `ease-in` for entrances.
7. **Performance & responsiveness**
   - Prefer **responsive grid** for search results (2–5 columns depending on width). Lazy-load poster images, add aspect-ratio utility, and preload hover states for cards.
8. **Settings & profile**
   - Group settings into clear cards with toggles, use **destructive styling** for sign out, and offer theme toggle (system/default/bright). Add profile completeness meter and quick links to privacy controls.

## Section 3: Updated design system (tokens and components)
- **Color tokens** (map to Tailwind): `mn-bg`, `mn-bg-elevated`, `mn-primary`, `mn-primary-soft`, `mn-accent-teal`, `mn-accent-violet`, `mn-text-primary`, `mn-text-secondary`, `mn-text-muted`, `mn-border-subtle`, `mn-border-strong`, `mn-success`, `mn-warning`, `mn-error`.
- **Extended tokens** (new): `--mn-surface-1: rgba(5, 8, 26, 0.9)`, `--mn-surface-2: rgba(15, 23, 42, 0.8)`, `--mn-glow: rgba(249, 115, 22, 0.28)`, spacing scale `4/8/12/16/20/24/32`, radii `12/16/24`, blur `16/24` for frosted cards.
- **Typography**: Heading (Space Grotesk) for H1–H3 with tight tracking; UI/body (Inter) for paragraphs, chips, and controls. Suggested scale: H1 32/40 semi-bold, H2 24/32 semi-bold, H3 20/28 medium, Body 16/24 regular, Caption 13/18 medium.
- **Components**: Primary button (solid + glow shadow), ghost button, icon button, pill chips, input fields with helper/error text, card with overlay actions, toast/snackbar, modal, tabs.

## Section 4: Wireframe-style layout descriptions
- **Home/Feed**: Hero strip with tagline + CTA, followed by horizontal “Continue watching” carousel and a masonry grid of recommended titles. Each card shows poster, title, genre chips, rating, and a `Save to Nest` button.
- **Swipe**: Edge-to-edge poster with top-safe padding, gradient overlay for text legibility, and bottom stacked buttons (Nope/Maybe/Nest). Include progress dots for deck position and an undo action.
- **Messages**: Two-column on desktop (conversation list + thread). Mobile keeps list with a sticky search/filter bar; entering a conversation hides bottom nav and shows a top back button + participant info.
- **Search**: Sticky search bar with filters (Genre, Year, Rating). Results as responsive grid with facet chips. Empty state encourages trending searches.
- **Diary**: Timeline layout with month separators, entry cards showing date, mood tag, rating, and note preview. Quick-add FAB on mobile; inline add on desktop.
- **Settings**: Sectioned cards (Account, Notifications, App). Toggles and selectors align to a 16 px grid; destructive actions at bottom with warning color.

## Section 5: Front-end code examples implementing improvements
See `src/components/design-system/DesignShowcase.tsx` for live React/Tailwind snippets covering buttons, cards, chips, tabs, and a hero banner with accessibility-first markup.

## Section 6: Step-by-step UI modernization plan
1. **Lay the foundation**: Add skip link, safe-area utility classes, and contrast checks. Implement shared spacing + radius tokens in Tailwind and CSS variables.
2. **Build primitives**: Create Button, InputField, Chip, Card, Toast components using the tokens. Add interaction states (hover/focus/active/disabled) with accessible labels.
3. **Upgrade navigation**: Enhance AppShell with breadcrumbs, animated active tab states, and theme toggle. Ensure responsive bottom nav spacing.
4. **Refine key flows**: Implement cinematic cards for Home/Search, deck layout for Swipe, two-column Messages on desktop, and timeline Diary.
5. **Polish and test**: Add micro-interactions, skeleton loading, offline banners, and a11y audits (keyboard traps, aria-live, prefers-reduced-motion). Ship with performance checks (Lighthouse) and bundle splitting.
