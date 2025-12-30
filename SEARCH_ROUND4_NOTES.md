# SearchPage – Round 4

## What changed

### 1) Keyboard shortcuts
- `/` focuses the search input (when you aren’t already typing in another input/textarea).
- `Esc` closes the Filters dialog if it is open; otherwise it clears the current search query.

### 2) Quick filter pills (sticky header)
When you are in the **Titles** tab and you have **active title filters** (or an explicit sort override), a compact row of pills appears under the top chips. Each pill shows what’s active and lets you clear it:
- Sort (only when `sort` is explicitly set in the URL)
- Type / Year / Lang / Genres (only when set)
- Clear all (only when one or more filters are active)

Clicking a pill opens the Filters dialog for quick edits. Clicking the `x` clears just that single setting.

## Files touched
- `src/modules/search/SearchPage.tsx`
