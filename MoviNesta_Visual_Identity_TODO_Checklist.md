# MoviNesta – Visual Identity TODO Checklist
Brand • Logo System • Colors • Typography • Components • Assets

## How to use this file

- This checklist guides the design/branding side of MoviNesta.
- Use it before and during frontend implementation so the UI stays on-brand.
- Every time you complete an item, change `[ ]` to `[x]` and add:
  - `Completed: YYYY-MM-DD HH:mm (UTC or local, specify)`
  - `Summary: 2–5 lines describing what you finalized`
  - `Next improvements: 1–3 ideas to refine or extend later`
- Do **not** delete items; evolve them as the brand matures.

---

## 1. Brand Core & Voice

- [x] Confirm brand name: **“MoviNesta”** (spelling, capitalization, no alternate forms).
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Brand name locked as “MoviNesta” (capital M + capital N, no spaces) and used consistently across the app shell, headers, and documentation.
  - Next improvements: Validate name usage on future marketing pages and mobile apps; add localization rules if new languages are introduced.
- [x] Lock primary tagline: **“Your movie life, in one nest.”**
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Tagline finalized and surfaced in the AppShell header subtitle to reinforce MoviNesta as a cozy, always-on home for your movie life.
  - Next improvements: Explore short variants for tight spaces and experiment with localized/tagline translations while keeping the same core meaning.
- [x] Define 3–5 brand personality words (e.g., cinematic, cozy, social, taste-driven).
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Brand personality defined as: cinematic, cozy, social, taste-driven, and thoughtful. These guide visual choices (dark, cinematic gradients) and tone of microcopy.
  - Next improvements: Add a short “brand personality in practice” section with do/don’t examples for future contributors.
- [x] Define tone of voice (warm, concise, confident, not edgy or sarcastic).
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Tone defined as warm, concise, confident, and friendly without sarcasm. Error and empty states use supportive language instead of blame or drama.
  - Next improvements: Create a tiny style guide with example phrases to keep copy consistent across new features.
- [x] Write 3–5 example microcopies (empty state, success, error messages) in this tone.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Seed microcopy examples drafted, e.g. “Your nest is quiet — start by adding a title you love” (empty), “Saved to your nest” (success), and “That didn’t play right — try again in a moment” (error). Tone matches the warm, cinematic brand.
  - Next improvements: Add more domain-specific examples (messages, diary, swipe) and wire them into real screens as those modules are built.

---

## 2. Logo & Icon System

- [ ] Finalize primary MoviNesta logo (symbol + wordmark).
- [ ] Define horizontal and stacked lockups.
- [ ] Define minimum size and safe-area margins.

- [ ] Export logo assets:
  - [ ] SVG master.
  - [ ] PNG for dark background (@1x/@2x/@3x).
  - [ ] PNG for light background (@1x/@2x/@3x).

- [ ] Finalize app icon glyph (no text, simple shape).
- [ ] Export app icon in standard sizes (512, 256, 128, 64, 32).

- [ ] Generate favicon set (ICO + 16/32 px PNGs) and app icons for PWA.

---

## 3. Color System

- [x] Define exact hex values for core colors:
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Core palette defined and implemented in Tailwind: mn-bg `#020617`, mn-bg-elevated `#05081a`, mn-primary `#f97316`, mn-primary-soft `#fed7aa`, mn-accent-teal `#14b8a6`, mn-accent-violet `#a855f7`, mn-text-primary `#e5e7eb`, mn-text-secondary `#9ca3af`, mn-text-muted `#6b7280`, mn-border-subtle `#1f2937`, mn-border-strong `#4b5563`, mn-success `#22c55e`, mn-warning `#facc15`, mn-error `#f97373`.
  - Next improvements: Add extended shades for light theme support and create a few “cinema poster” accent colors for special campaigns.
  - [x] `mn-bg`, `mn-bg-elevated`.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Concrete tokens `mn-bg`, `mn-bg-elevated`. are defined in Tailwind and aligned with the core MoviNesta palette.
    - Next improvements: Add design tokens to any native/mobile implementations and ensure documentation stays in sync.
  - [x] `mn-primary`, `mn-primary-soft`.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Concrete tokens `mn-primary`, `mn-primary-soft`. are defined in Tailwind and aligned with the core MoviNesta palette.
    - Next improvements: Add design tokens to any native/mobile implementations and ensure documentation stays in sync.
  - [x] `mn-accent-teal`, `mn-accent-violet`.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Concrete tokens `mn-accent-teal`, `mn-accent-violet`. are defined in Tailwind and aligned with the core MoviNesta palette.
    - Next improvements: Add design tokens to any native/mobile implementations and ensure documentation stays in sync.
  - [x] `mn-text-primary`, `mn-text-secondary`, `mn-text-muted`.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Concrete tokens `mn-text-primary`, `mn-text-secondary`, `mn-text-muted`. are defined in Tailwind and aligned with the core MoviNesta palette.
    - Next improvements: Add design tokens to any native/mobile implementations and ensure documentation stays in sync.
  - [x] `mn-border-subtle`, `mn-border-strong`.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Concrete tokens `mn-border-subtle`, `mn-border-strong`. are defined in Tailwind and aligned with the core MoviNesta palette.
    - Next improvements: Add design tokens to any native/mobile implementations and ensure documentation stays in sync.
  - [x] `mn-success`, `mn-warning`, `mn-error`.
    - Completed: 2025-11-22 15:00 (Asia/Baghdad)
    - Summary: Concrete tokens `mn-success`, `mn-warning`, `mn-error`. are defined in Tailwind and aligned with the core MoviNesta palette.
    - Next improvements: Add design tokens to any native/mobile implementations and ensure documentation stays in sync.

- [ ] Check contrast ratios for text vs background (WCAG AA/AAA where applicable).
- [ ] Define 1–2 brand gradients (e.g., MoviNesta Neon Gradient).
- [ ] Document when gradients are appropriate (hero, primary CTA) and when not.

- [x] Map these colors to Tailwind config semantic names and document typical usage.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: All core colors are mapped in `tailwind.config.cjs` under semantic names (mn-bg, mn-bg-elevated, mn-primary, mn-accent-*, mn-text-*, mn-border-*, mn-success/mn-warning/mn-error) and used throughout layout and shell components.
  - Next improvements: Add a short “usage examples” table (e.g., which tokens to use for cards, chips, alerts) to this document.

---

## 4. Typography

- [x] Choose base UI font (e.g., Inter) and confirm licensing.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Inter is selected as the base UI font and loaded via Google Fonts; it is open-licensed for product use. Tailwind `fontFamily.ui` is wired to Inter across the app.
  - Next improvements: Consider self-hosting fonts for performance and offline packaging.
- [x] Choose display font for headings (optional) and confirm licensing.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Space Grotesk is chosen as the display/heading font and mapped to Tailwind `fontFamily.heading`, used for brand wordmark and key headings. It is an open-licensed Google Font.
  - Next improvements: Define explicit usage rules for when to use heading vs UI font (e.g., H1/H2 vs body and controls).
- [ ] Define type scale:
  - [ ] Display/Hero.
  - [ ] H1/H2/H3.
  - [ ] Body base and small.
  - [ ] Caption/meta.

- [ ] Define pairing of font size, line-height, and weight for each level.
- [ ] Create examples of headings and body for key screens (Home hero, feed cards, profile header).

---

## 5. Iconography & Emoji

- [x] Pick icon set (Lucide/Heroicons/custom) with consistent stroke width.
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Lucide icons are chosen for the app (React package `lucide-react`), providing a clean 1.5–2 px stroke look that fits the dark cinematic UI.
  - Next improvements: Curate a short list of “approved” icons for common actions to avoid visual drift.
- [x] Map icons for bottom nav (Home, Swipe, Messages, Search, Diary).
  - Completed: 2025-11-22 15:00 (Asia/Baghdad)
  - Summary: Bottom navigation uses Lucide icons: Home, Flame (Swipe), MessageCircle (Messages), Search, and BookOpen (Diary), all wired into `AppShell`.
  - Next improvements: Explore subtle active-state animations (scale or glow) that match the brand motion guidance.
- [ ] Define icons for settings, notifications, share, like, comment, watchlist, status, etc.

- [ ] Define reaction emoji set (e.g., 😍 🤣 😭 😡 👍).
- [ ] Provide recommended sizes and alignment for icons and emoji in UI.

---

## 6. Core Components (Visual Spec)

For each component, specify spacing, radius, icon size, font styles, and states (hover/active/disabled).

- [ ] Primary button (solid/gradient).
- [ ] Secondary/ghost button.
- [ ] Icon button.
- [ ] Card (feed card/title card).
- [ ] Tabs (including selected/hover states).
- [ ] Filter/status chips.
- [ ] Text inputs and textareas.
- [ ] Toast/notification banner.
- [ ] Tooltip/help text.
- [ ] Modal/dialog.

---

## 7. Layout Patterns

- [ ] Define spacing scale (e.g., 4/8/12/16/24 px).
- [ ] Document margins/padding for screen edges on mobile and desktop.

Define layout patterns for:

- [ ] Auth screens (logo, title, form layout).
- [ ] Home Feed (card density, spacing between sections).
- [ ] For You (hero + carousels).
- [ ] Swipe (card stack positioning, action button row).
- [ ] Messages (list + conversation view).
- [ ] Search (search bar and result arrangement).
- [ ] Diary (timeline, library grid/list, stats area).
- [ ] Profile (header, tabs, main content).

---

## 8. Dark Mode Behavior

- [ ] Decide background layering (base vs elevated surfaces).
- [ ] Define border and divider treatments for dark UI.
- [ ] Define hover/focus/active states for buttons and cards in dark theme.
- [ ] Adjust error/warning colors to be legible but not glaring.
- [ ] Specify motion guidance (hover transitions, modal animations) appropriate for dark theme.

---

## 9. Email, OG & External Surfaces

- [ ] Design base email template with MoviNesta logo and colors (for confirm sign-up, reset password, etc.).
- [ ] Provide HTML/CSS for at least the confirm sign-up email.

- [ ] Design Open Graph image (`og:image`) for link previews:
  - [ ] Include logo, tagline, gradient background, small UI preview.
- [ ] Export OG images at recommended sizes.

- [ ] (Optional) Define templates for app store screenshots with brand framing and text overlays.

---

## 10. Asset Organization & Handoff

- [ ] Create folder structure for brand assets (logo, icons, colors, email, OG).
- [ ] Export SVG and PNG assets in all needed sizes.
- [ ] Optimize images and strip unnecessary metadata.
- [ ] Document assets in a short index (filename → purpose).

- [ ] Update Visual Identity Guide document with final decisions and DO/DON’T examples.
- [ ] Add a short checklist for reviewing new UI screens for brand compliance.