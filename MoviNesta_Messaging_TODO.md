# MoviNesta Messaging – Full TODO Roadmap

## Notes for AI Coding Agent

These notes are for any AI coding agent (or developer) using this TODO file.  
They are meant to keep work stable and avoid crashes or overwhelming changes.

- Always work in **small chunks**, not the whole file at once. Pick only a few TODO items at a time (for example 1–3 bullets) and complete them before moving on. {}
- If a TODO item is big or vague, **break it into smaller substeps** in your own mind or notes, and implement them one by one. {}
- Prefer touching **as few files as possible** for each item. Avoid huge refactors that affect many parts of the app in a single run. {}
- Keep code changes **focused and incremental**. Do not rewrite large files from scratch unless absolutely necessary. {}
- When editing a large file, try to **only change the parts that are directly relevant** to the current TODO item. Leave unrelated code as-is. {}
- After finishing a logical chunk of work, **stop and update the corresponding `{}` in this file** with:
  - `Done:` or similar status.
  - A simple timestamp (e.g. `2025-11-25 14:32`).
  - A very short summary of what changed (1–2 sentences). {}
- If a TODO item depends on another one, **do the prerequisite one first**. For example: do “make conversations sort correctly” before “improve performance of the messages list”. {}
- Avoid introducing new libraries, tools, or major architecture changes unless the TODO item clearly calls for it. Prefer working with the existing stack. {}
- If you are unsure about a big design or UX choice, **implement the simplest, safest version** first, and leave a short note in comments for future refinement. {}

This document is the **full, ultimate TODO** for the messaging system and its UI/theme for MoviNesta, a social network.

It is written in simple language so anyone can understand the goals without needing to know internal function names or database details.

Priorities are rough guidelines:

- **P0 – Must-have for MVP launch** {}
- **P1 – MVP “feels good”** {}
- **P2 – High-impact improvements after MVP** {}
- **P3 – Social / brand & engagement features** {}
- **P4 – Reliability, growth & advanced work** {}

---

## 🔴 P0 – Must-have for MVP launch

### 1. Conversations always sorted by latest message

- Make sure each conversation in the messages list is always sorted by the **time of its latest message**, no matter who sent it. {Done: 2025-11-25 15:00 — Inbox conversations are now sorted by the time of their latest message (using lastMessageAt in useConversations).}
- Whenever a new message is created, the conversation’s “last updated” time should automatically be refreshed on the backend. {Done: 2025-11-25 15:00 — ConversationPage sendMessage mutation bumps conversations.updated_at so new messages always refresh the backend timestamp.}
- Remove any temporary tricks that try to fake this only on the frontend. {Done: 2025-11-25 15:00 — No temporary front-end sorting tricks; ordering now flows from backend timestamps plus a single client-side sort.}

---

### 2. Basic safety: let people block others

- Let users **block** other users from messaging them. {Done: 2025-11-25 17:10 — Added Supabase-backed blocking using the blocked_users table plus a React hook to manage block status in conversations.}
- If user A has blocked user B (or B has blocked A): {Done: 2025-11-25 17:10 — Block status is tracked in both directions so either user blocking the other is taken into account.}
  - Neither side should be able to send **new** messages to the other. {Done: 2025-11-25 17:10 — Conversation composer and submit handler both prevent sending new messages once a block exists.}
- In one-on-one chats: {Done: 2025-11-25 17:10 — Blocking UX is wired for direct (non-group) conversations using the participants list.}
  - Add a simple “Block user” action in the conversation header or menu. {Done: 2025-11-25 17:10 — Added a Block/Unblock button in the conversation header for one-on-one chats.}
  - When someone is blocked, hide the message box and show a small notice like: {Done: 2025-11-25 17:10 — The composer is replaced with a small explanatory notice whenever either side is blocked.}
    - “You’ve blocked this user.” {Done: 2025-11-25 17:10 — Notice text shows “You’ve blocked this user.” when the current user initiated the block.}
- Prepare for future: {Done: 2025-11-25 17:10 — Block logic is centralized in a reusable hook so future behaviors can easily plug into it.}
  - Make it easy to extend this later to also hide their messages or profile if needed. {Done: 2025-11-25 17:10 — UI reads block state from a single source, making it straightforward to also hide messages or profiles later.}

---

### 3. Shared helpers for message text

- Create a shared way to read and clean message text so every part of the app shows messages the same way. {Done: 2025-11-25 15:00 — Added shared messageText helpers so conversation view and inbox reuse the same message parsing & preview logic.}
- The shared logic should: {}
  - Safely handle plain text and any structured formats (like JSON) that might be stored. {Done: 2025-11-25 15:00 — parseMessageText now handles plain strings and JSON payloads (text, blocks, image, message).}
  - Always return a clean, displayable text version (no broken JSON). {Done: 2025-11-25 15:00 — Helper always falls back to a clean string so no broken JSON reaches the UI.}
- Also create a helper for **message previews**: {}
  - Shorten long messages. {Done: 2025-11-25 15:00 — Previews use a max length and append an ellipsis to keep rows compact.}
  - Remove line breaks. {Done: 2025-11-25 15:00 — Preview helper collapses line breaks and whitespace into a single line.}
  - Strip any formatting characters you don’t want in previews. {Done: 2025-11-25 15:00 — Lightly normalizes preview text so stray formatting characters are less noisy.}
- Use these helpers everywhere: {}
  - In the conversation view. {Done: 2025-11-25 15:00 — Conversation view uses parseMessageText when rendering message bubbles.}
  - In the messages list (inbox). {Done: 2025-11-25 15:00 — Inbox uses getMessagePreview from the shared helper for lastMessagePreview.}
  - Anywhere else message text appears. {Done: 2025-11-25 15:00 — messageText helpers are the single place for message text parsing & preview logic.}

---

### 4. Clear “Messages” screen hierarchy & spacing

- On the Messages (inbox) screen: {In progress: 2025-11-25 15:00 — Header hierarchy updated; empty/error states still to refine.}
  - Make the main title clearly larger and bolder than anything else. {Done: 2025-11-25 15:00 — MessagesPage title now uses a larger heading size so it stands out clearly.}
  - Add a short, softer subtitle line explaining what messages are for. {Done: 2025-11-25 15:00 — Subtitle under the main title explains what messaging is for in a softer tone.}
- Give the screen more breathing room: {In progress: 2025-11-25 15:00 — Added outer padding to the Messages screen; list spacing still tweakable later.}
  - Consistent padding around the edges. {Done: 2025-11-25 15:00 — Added consistent horizontal padding (px-3/4/6) so content no longer touches the edges.}
  - Consistent spacing between elements (title, search, list). {Done: 2025-11-25 15:00 — Spacing between title, search, and list adjusted via gap utilities for a clearer rhythm.}
- Make empty and error states easy to understand: {Done: 2025-05-28 13:10 (local) — Added a friendly empty state with iconography and a retry button with spinner for errors so users can reload conversations without refreshing the page.}
    - Empty: a friendly icon or illustration plus a short message (“No messages yet”). {Done: 2025-05-28 13:10 (local) — Added icon-backed empty copy inviting users to start a conversation.}
    - Error: a clear message and a visible “Try again” or “Reload” action. {Done: 2025-05-28 13:10 (local) — Inline retry button now refreshes the conversations query with loading feedback.}

---

### 5. Clean up conversation rows (card-like items)

- Treat each conversation in the list like a **small card**: {In progress: 2025-11-25 15:00 — Conversation rows now styled as small cards with rounded edges; background tweaks still possible.}
  - Slightly lighter/different background than the page. {Done: 2025-11-25 15:00 — Rows sit on a subtly elevated card background, distinct from the main page.}
  - Rounded corners that match the rest of the app. {Done: 2025-11-25 15:00 — Each row uses rounded-mn-card corners to match the rest of the app.}
  - Subtle shadow or border change on hover. {Done: 2025-11-25 15:00 — Added hover border + soft shadow so cards feel tappable without being loud.}
- Layout for each row: {Done: 2025-11-25 15:00 — Current layout already follows avatar / text / meta structure.}
  - Left: avatar (single avatar for one person; stacked avatars for groups). {Done: 2025-11-25 15:00 — Single vs stacked avatars implemented for DMs vs groups.}
  - Middle: {}
    - Top line: name (or group name). {Done: 2025-11-25 15:00 — Top line shows the conversation or participant name.}
    - Second line: last message preview in smaller, lighter text. {Done: 2025-11-25 15:00 — Second line shows the last message preview in smaller, lighter text.}
  - Right: {Done: 2025-11-25 15:00 — Right-hand side is reserved for timestamp + unread indicator.}
    - Time of the last message. {Done: 2025-11-25 15:00 — Last message time is shown as a compact label on the right.}
    - Unread badge or dot if there are unread messages. {Done: 2025-11-25 15:00 — Unread dot appears for any conversation with hasUnread = true.}
- For unread conversations: {Done: 2025-05-28 13:10 (local) — Unread threads now get a subtle elevated background plus the existing bold text and dot so they stand out in the list.}
  - Make the name bold. {Done: 2025-11-25 15:00 — Unread conversations render with a bolder title weight.}
  - Use a slightly brighter or different background. {Done: 2025-05-28 13:10 (local) — Applied a darker-elevated surface and border highlight on unread list rows.}
  - Show a clear unread dot or a tiny count badge. {Done: 2025-11-25 15:00 — Clear unread dot is shown; tiny count badge can be layered in later if needed.}

---

### 6. Make the chat screen look and feel like a real chat

- Use clear alignment: {Done: 2025-11-25 16:00 — Conversation bubbles are aligned like a modern chat with your messages on the right and others on the left.}
  - Messages from **you** on the right. {Done: 2025-11-25 16:00 — Messages sent by the signed-in user render in a right-aligned column using flex-row-reverse.}
  - Messages from **others** on the left. {Done: 2025-11-25 16:00 — Messages from other participants stay left-aligned with their avatar and name.}
- Bubble style: {Done: 2025-11-25 16:00 — Bubbles use rounded corners, padding, and distinct colors for your vs. others’ messages.}
  - Rounded “pill” corners. {Done: 2025-11-25 16:00 — Each bubble uses rounded-2xl corners to create a soft, pill-like shape.}
  - Enough padding inside for readable text. {Done: 2025-11-25 16:00 — Bubbles include horizontal and vertical padding so multi-line messages remain readable.}
  - Different colors for your messages vs other people’s messages. {Done: 2025-11-25 16:00 — Self messages use the primary color on a light text, while others use a neutral surface with subtle border.}
    - Your messages: use the primary brand color or a warm tint. {Done: 2025-11-25 16:00 — Self bubbles use bg-mn-primary with light text for strong emphasis.}
    - Others: neutral darker bubble that still contrasts with the background. {Done: 2025-11-25 16:00 — Other messages use a neutral bg-mn-bg/95 surface with border-mn-border-subtle.}
- Background: {Done: 2025-11-25 16:00 — The chat body sits on a calm elevated background card so bubbles stand out clearly.}
  - Dark, calm background that does not compete with the bubbles. {Done: 2025-11-25 16:00 — Messages render on a bg-mn-bg-elevated/80 card that keeps the focus on the bubbles.}
  - A very subtle gradient or texture is OK, but messages must remain the focus. {Done: 2025-11-25 16:00 — Background remains simple and slightly elevated; no heavy gradients competing with content.}
- Spacing: {Done: 2025-11-25 16:00 — Vertical spacing is adjusted so sequences of messages from the same sender cluster together with slightly larger gaps when the sender changes.}
  - Consistent vertical space between messages. {Done: 2025-11-25 16:00 — The stackSpacing helper ensures controlled top margins for each message row.}
  - Slightly larger gap between messages from different people. {Done: 2025-11-25 16:00 — When the sender changes, an increased top margin visually separates the new cluster of messages.}

---

### 7. Basic composer (message input) styling

- Place the message input on a **fixed bar at the bottom** of the chat: {Done: 2025-11-25 16:00 — Composer now lives on a bottom bar attached to the chat card so messages scroll above it.}
  - Slightly elevated background or subtle border to separate it. {Done: 2025-11-25 16:00 — The bar uses a subtle top border and semi-opaque background to clearly separate it from the message area.}
- Inside the bar: {Done: 2025-11-25 16:00 — The composer bar is structured as left icons, center input, and a right-aligned send button.}
  - Left: space for icons (like attachment or emoji), even if not wired yet. {Done: 2025-11-25 16:00 — Non-functional attachment and emoji icon buttons now sit on the left side of the composer.}
  - Center: rounded text input area. {Done: 2025-11-25 16:00 — The message textarea is rounded, with a pill-like input shape.}
  - Right: clear send button with brand color and a send icon. {Done: 2025-11-25 16:00 — The send button uses the primary brand color, rounded shape, and a Send icon.}
- Make sure the input area: {Done: 2025-11-25 16:00 — The input uses a compact but comfortable text size and height within the bar.}
  - Uses comfortable font size. {Done: 2025-11-25 16:00 — Text inside the composer uses a readable 13px size tuned for chat.}
  - Has enough padding so typing doesn’t feel cramped. {Done: 2025-11-25 16:00 — The input has horizontal and vertical padding so messages don’t feel cramped against the edges.}

---

### 8. Unread state basics

- In the conversation list: {Done: 2025-11-25 15:00 — Conversation list now emphasizes unread threads via bold titles and an unread dot.}
  - Show clearly which conversations have unread messages. {Done: 2025-11-25 15:00 — hasUnread drives both the dot and stronger title weight so unread threads stand out.}
  - Use: {}
    - Bold conversation names. {Done: 2025-11-25 15:00 — Unread titles render with font-semibold while read ones stay at font-medium.}
    - Unread dot or badge. {Done: 2025-11-25 15:00 — A small primary-colored dot is shown next to each unread conversation.}
- In the chat view: {Done: 2025-11-25 15:00 — Chat view updates message_read_receipts when opened.}
  - Make sure opening a conversation visually clears its unread state in the list. {Done: 2025-11-25 15:00 — Opening a conversation updates last_read_at and causes hasUnread to flip to false in the list.}

---

## 🟠 P1 – MVP “feels good” (product + social improvements)

### 9. Make it easy to start a chat from anywhere

- Users should be able to start a chat from any place they see a person: {}
  - On that person’s profile. {}
  - Next to their name on posts. {}
  - In people lists (followers, friends, search results, etc.). {}
- All of these should: {}
  - Use the same flow to either open an existing chat or create a new one. {}
- When a chat is started from a specific context (like a post or a profile): {}
  - Remember that origin. {}
  - At the top of the chat, show a tiny label such as “Chat started from this post” or “Chat started from their profile” that can link back. {}

---

### 10. Simple auto-refresh (polling) so chats feel alive

- For the open chat: {Done: 2025-11-29 04:55 — Conversation queries now poll in the background and refetch on focus/reconnect.}
  - Refresh the messages list automatically every few seconds. {Done: 2025-11-29 04:55 — Messages refetch every 6s while the chat is open.}
  - Also refresh when the user comes back to the app or tab. {Done: 2025-11-29 04:55 — Refetch on window focus keeps chats fresh when returning.}
- For the messages list: {Done: 2025-11-29 04:55 — Inbox polling keeps conversations updated without manual reloads.}
  - Refresh the list every few seconds as well. {Done: 2025-11-29 04:55 — Conversations refetch on an 8s interval.}
- Make sure this auto-refresh: {Done: 2025-11-29 04:55 — Polling is gated by user/login and open chat ids.}
  - Stops when the user logs out. {Done: 2025-11-29 04:55 — Refetch intervals disable when there’s no signed-in user.}
  - Doesn’t run unnecessarily (for example, when there’s no open chat). {Done: 2025-11-29 04:55 — Conversation polling only runs for active conversation IDs.}

---

### 11. Improved composer behavior (typing and sending)

- In the message input: {Done: 2025-11-29 04:55 — Sending respects Enter vs. Shift+Enter with the current textarea.}
  - Press **Enter** → send the message. {Done: 2025-11-29 04:55 — Enter triggers submit while preserving multi-line with Shift.}
  - Press **Shift + Enter** → insert a new line without sending. {Done: 2025-11-29 04:55 — Shift+Enter keeps focus and inserts a newline.}
- Let the text box grow automatically: {Done: 2025-11-29 04:55 — Textarea auto-resizes up to a capped height before scrolling.}
  - As users type more lines, the input box should expand up to a reasonable height. {Done: 2025-11-29 04:55 — JS-driven resizing grows the input smoothly.}
  - After a certain height, the content should scroll inside the box instead of growing forever. {Done: 2025-11-29 04:55 — Height caps at ~140px with overflow switching to scroll.}
- Show what happens when something goes wrong: {Done: 2025-11-29 04:55 — Composer surfaces send failures inline.}
  - If sending fails, display a small message like: {}
    - “Couldn’t send. Please try again.” {Done: 2025-11-29 04:55 — Inline alert shows the failure message.}
  - Give an easy way to try sending again. {Done: 2025-11-29 04:55 — Retry button resubmits the last failed draft.}

---

### 12. Better inbox previews (“You:”)

- In the messages list: {}
  - If **you** sent the last message: {}
    - Start the preview text with “You:”. {}
    - Example: “You: Are you free tomorrow?” {}
- If the other person sent the last message: {}
  - Just show their message preview. {}
- This helps users quickly see who spoke last. {}

---

### 13. Date separators inside chats

- In the chat: {}
  - Insert a small date divider when the date changes. {}
- Use labels like: {}
  - “Today” {}
  - “Yesterday” {}
  - Full date like “12 Nov 2025” {}
- Style them as: {}
  - Small centered text. {}
  - Rounded chip or line that breaks the messages visually. {}

---

### 14. Typing indicator (“Typing…”)

**Where to show:**

- In the chat: {}
  - Show a “Typing…” line just above the input when the other person is typing. {}
- In the messages list (optional but nice): {}
  - Show “Typing…” as the preview for the conversation where the other person is currently typing. {}

**How it should look:**

- Small, soft text like: {}
  - “Typing…” {}
  - or “Alice is typing…” in group chats. {}
- Add a tiny animated detail: {}
  - Three small bouncing or fading dots. {}
- Colors: {}
  - Light text color, dots in a soft version of the brand color. {}

**When to show/hide:**

- Show: {}
  - After the other person has been typing for a short moment (not instantly). {}
- Hide: {}
  - When they send the message. {}
  - When they stop typing for a few seconds. {}
  - When the chat is closed. {}
- In groups: {}
  - For one person: “Alice is typing…” {}
  - For two: “Alice and Bob are typing…” {}
  - For more: “Several people are typing…” {}

---

### 15. Seen / read receipts (“Seen”)

**In the chat:**

- Under the most recent message you sent, show small text like: {}
  - “Seen” {}
  - Or “Seen 2:05 PM”. {}
- Only show this for the **latest** message sent by you, not under every message. {}
- Keep the text subtle (small and slightly muted color). {}

**In the messages list:**

- If **you** sent the last message and it has been seen: {}
  - Show a small “Seen” text or a tiny icon on the right side near the time. {}
- If it has **not** been seen: {}
  - Show nothing special or a subtle “sent” icon. {}
- Combine this with the unread badge: {}
  - If the other person sent the last message and you haven’t read it: {}
    - Show the unread badge and bold their name. {}

**In group chats:**

- In the chat: {}
  - Under your latest message, use a small line such as: {}
    - “Seen by Alice and 3 others” {}
  - Or show a tiny stack of mini avatars of people who have seen it, plus “+X” if there are more. {}
- In the messages list: {}
  - Focus on whether **you** have unread messages, not on who has seen the group messages. {}

**Privacy note:**

- Plan for a future setting where users can turn read receipts on or off. {}

---

### 16. Hover, focus, and pressed states

- Every clickable item (buttons, icons, rows) should have: {}
  - Hover state: {}
    - Slight background change or glow. {}
  - Pressed/active state: {}
    - Slightly darker or “pressed in” look. {}
  - Focus state (for keyboard navigation): {}
    - Visible outline that looks intentional, not default/ugly. {}
- For conversation rows: {}
  - On hover: slightly change the background and maybe gently scale up the avatar. {}

---

### 17. Loading states and skeletons

- For the messages list and chat: {}
  - Use skeleton loading placeholders instead of only a spinner. {}
  - Skeletons mimic: {}
    - Avatar circles. {}
    - Text lines for names and previews. {}
- When sending a message: {}
  - Show some quick visual confirmation (like a momentary shimmer or temporary “sending” state) so users know the app is responding. {}

---

## 🟡 P2 – High-impact improvements after MVP

### 18. True realtime updates

- Use realtime capabilities from the backend so: {Done: 2025-11-25 — Messages table is wired to Supabase Realtime and the frontend subscribes via postgres_changes channels.}
  - New messages show up immediately in open chats. {Done: 2025-11-25 — ConversationPage subscribes to INSERT events on messages for the current conversation and merges new rows into the React Query cache without waiting for a refetch.}
  - The messages list updates automatically when a new message arrives. {Done: 2025-11-25 — MessagesPage listens to INSERT events on messages and invalidates the conversations query so previews, timestamps, ordering, and unread badges stay in sync.}
- Once this is reliable: {Done: 2025-11-25 — React Query polling and focus/reconnect refetches are disabled for messages and conversations, relying on realtime instead.}

---

---

### 19. Smart auto-scroll and “Jump to latest”

- Watch whether the user is currently near the bottom of the chat. {}
- When new messages arrive: {}
  - If user is at the bottom: {}
    - Automatically scroll to the newest message. {}
  - If user has scrolled up: {}
    - Do **not** move them. {}
    - Show a small “New messages · Jump to latest” button. {}
- When the user taps “Jump to latest”: {}
  - Smoothly scroll to the bottom and hide the button. {}

---

### 20. Group messages by sender and time

- In the chat: {}
  - Group consecutive messages from the same person that are close in time. {}
- For messages within a group: {}
  - Show avatar and name only for the first message in the group. {}
  - Reduce vertical spacing between grouped messages. {}
  - Optionally show the timestamp mainly on the last message of the group. {}
- This makes chats look cleaner and easier to scan. {}

---

### 21. Search inside a conversation

- Add a search icon or field in the chat header. {}
- Allow the user to search for text **within** that conversation. {}
- Highlight messages matching the search. {}
- Provide controls to jump between matches: {}
  - “Next” {}
  - “Previous” {}
- When jumping, scroll the chat to the matching message and briefly highlight it. {}

---

### 22. Improve performance of the messages list

- When building the messages list: {}
  - Avoid loading the full history of messages for every conversation just to show the last one. {}
  - Ask the backend only for the latest message per conversation if possible. {}
- Run separate data requests in parallel instead of one by one when it speeds things up. {}
- Keep: {}
  - Last message previews correct. {}
  - Unread counts accurate. {}
  - Participant names and avatars in sync. {}

---

### 23. Theme and color system refinement

- Decide a small, clear set of colors: {}
  - 1 main brand color (neon accent). {}
  - 1–2 supporting accent colors. {}
  - A small group of greys for text and backgrounds. {}
- Use them consistently: {}
  - Brand color for main buttons and key actions. {}
  - Accents for highlights and tags. {}
  - Neutrals for surfaces and backgrounds. {}
- Avoid using too many bright colors in a single view. {}

---

### 24. Typography scale and consistency

- Define a simple text scale: {}
  - Large: page titles. {}
  - Medium: section titles and names. {}
  - Small: previews, timestamps, helper text. {}
- Use consistent sizes and weights: {}
  - Same size for all conversation names. {}
  - Same size for all previews, etc. {}
- Ensure line height is generous enough for readability, especially in message bubbles. {}

---

### 25. Unified cards and surfaces across the app

- Use one consistent style for cards everywhere: {}
  - Same corner rounding. {}
  - Similar padding. {}
  - Same type of shadow or border (don’t mix too many). {}
- Apply this to: {}
  - Messages list rows. {}
  - Feed items. {}
  - Profile cards. {}
  - Diary entries. {}
- The app should feel like a single, unified design language. {}

---

### 26. Navigation and headers consistency

- Ensure the top navigation has: {}
  - Consistent height. {}
  - Aligned icons and logo. {}
  - Matching padding and spacing. {}
- Section headers (Home, Messages, Diary, etc.) should: {}
  - Align on the same grid. {}
  - Have consistent spacing between header and content. {}

---

### 27. Motion and transitions

- Add small, fast animations for polish: {}
  - Fade/slide messages in when they first appear. {}
  - Smooth scrolling when moving to the bottom of a chat. {}
  - Quick fade or slide when switching between main tabs (Home, Messages, etc.). {}
- Keep animation durations short (around 150–250ms) so the app remains snappy. {}

---

### 28. Dark theme refinements

- Avoid pure black for large areas; use deep greys or dark navy shades. {}
- Use subtle gradients in headers or highlight areas to bring in the brand color. {}
- Ensure text contrast is sufficient: {}
  - Main text: bright but not pure white. {}
  - Secondary text: softer but still clearly readable. {}
  - Muted text: darker, but not so dark that it becomes invisible. {}

---

### 29. Accessibility basics

- Treat the list of messages as an actual list for screen readers. {}
- Treat each message as a list item. {}
- Ensure new messages can be announced politely (without spamming screen readers). {}
- Make sure: {}
  - Icon-only buttons have clear labels. {}
  - Colors used for important states meet basic contrast guidelines. {}
  - Unread vs read is not shown by color alone (use bold text or icons too). {}

---

## 🟢 P3 – Social / brand & engagement features

### 30. Social context in the chat header

- In one-on-one chats: {}
  - Show small social info under the person’s name, such as: {}
    - Number of mutual friends. {}
    - Shared groups or communities. {}
- If the chat was started from something specific (a post, event, or profile): {}
  - Show a small label at the top of the chat like: {}
    - “From this post” {}
    - “From this event” {}
    - “From their profile” {}
  - Make it clickable to go back there. {}

---

### 31. Conversation starters and suggestions

- When two people have never chatted before: {}
  - Show a few suggestion buttons above the message box, such as: {}
    - “Say hi and introduce yourself” {}
    - “Ask about their latest post” {}
    - “Ask about their job at [company]” {}
- Tapping a suggestion: {}
  - Fills the message box with example text that the user can edit. {}

---

### 32. Organize the inbox (Main, Requests, Groups)

- Split the inbox into simple sections or tabs: {}
  - **Main** – people you know or follow. {}
  - **Requests** – new messages from people you don’t yet know. {}
  - **Groups** – group chats and community chats. {}
- For message requests: {}
  - Show a safe preview without fully accepting the conversation. {}
  - Offer “Accept” or “Delete” buttons. {}
  - When accepted, move the conversation into the Main section. {}

---

### 33. Group chat basics

- Support chats with more than two people. {}
- Groups should have: {}
  - Name. {}
  - Picture. {}
- Group settings: {}
  - Show a list of members. {}
  - Allow changing name and picture (at least for some members). {}
- Show system messages for group events: {}
  - “X created the group” {}
  - “X added Y” {}
  - “X left the group” {}
- Optionally: {}
  - Support admins who can manage members and settings. {}

---

### 34. Message reactions

- Allow users to react to messages with emojis. {}
- Under each message: {}
  - Show small reaction chips like “👍 3 😄 2”. {}
- Tapping a reaction: {}
  - Adds that reaction for the current user. {}
  - Tapping again removes it. {}

---

### 35. Attachments (start with images)

- Let users attach images to messages from the composer. {}
- In the chat: {}
  - Show image previews directly in bubbles. {}
  - Tapping an image opens a larger view. {}
- Prepare for future: {}
  - Other types of attachments (files, audio, etc.). {}

---

### 36. Link previews

- Detect links in message text. {}
- In the background: {}
  - Fetch basic info about the link (title, description, image, site name). {}
- Under linked messages: {}
  - Show a small preview card with this info. {}

---

### 37. Cinematic, brand-specific touches

- Add small, brand-colored details: {}
  - Thin neon line at the top of the chat panel. {}
  - Subtle gradient border on primary buttons like “New message”. {}
- For media-related content (if your app centers on movies/shows/music): {}
  - Add small icons or tags in relevant messages. {}
- For group chats: {}
  - Use stacked avatars with a soft brand-colored outline. {}

---

## 🔵 P4 – Reliability, growth & advanced work

### 38. Message status and offline queue

- Show clear states for outgoing messages: {}
  - “Sending” (faded bubble or spinner). {}
  - “Sent”. {}
  - “Failed” (error icon). {}
- Allow users to try sending a failed message again easily. {}
- If the device is offline: {}
  - Queue messages instead of losing them. {}
  - Show a “Waiting for connection…” notice. {}
  - Automatically send the queued messages when back online. {}

---

### 39. Long-chat handling (pagination and virtualization)

- For very long conversations: {}
  - Load only the most recent messages at first. {}
  - When the user scrolls up, load older messages. {}
  - Keep the scroll position stable when adding older messages. {}
- Use a virtualized list so only messages on screen are rendered at once, for better performance. {}
- Support “jump to message” behavior: {}
  - From search results or pinned messages, scroll directly to that message and briefly highlight it. {}

---

### 40. Notifications and per-chat settings

- Add notifications for new messages when the app isn’t in use: {}
  - Include sender name and a short preview. {}
- In each conversation: {}
  - Let users control notifications: {}
    - Notify for all messages. {}
    - Notify only on certain things (like mentions or replies). {}
    - Mute this chat. {}
- In the main navigation: {}
  - Show a messages badge that counts only unread, non-muted conversations. {}

---

### 41. Extra safety and filtering

- Let users define words or phrases they don’t want to see: {}
  - Messages containing those can be hidden, collapsed, or sent into Requests. {}
- Show gentle safety signals for new messages from strangers: {}
  - For example: {}
    - “New account” {}
    - “No mutual friends” {}
- Add a basic “Report message” feature: {}
  - With reasons like: {}
    - Spam. {}
    - Harassment. {}
    - Inappropriate content. {}
  - Store reports for review by moderators or automated tools. {}

---

### 42. Analytics and insights (for the product team)

- Track high-level metrics (not shown to users), such as: {}
  - How many users send or receive messages each day or month. {}
  - What percentage of follows or profile views lead to a new chat. {}
  - How often messages get replies vs. being ignored. {}
  - Whether users who use messaging stay active longer than those who don’t. {}
- Track which entry points start the most chats: {}
  - From profiles. {}
  - From posts. {}
  - From search results. {}
- Use this data later to prioritize which messaging features to improve next. {}

---

### 43. Internationalization and right-to-left support

- Make sure message text displays correctly for both left-to-right and right-to-left languages. {}
- Allow text containers to choose direction automatically based on content where possible. {}
- Check that: {}
  - Bubbles and alignment still make sense when the interface is mirrored. {}
  - Emojis and punctuation don’t break layout. {}
- For previews and very long texts: {}
  - Limit the number of lines. {}
  - Use ellipsis (`…`) where needed. {}
  - Allow horizontal scrolling only when absolutely necessary (like for code blocks). {}

---

This roadmap can be used as a long-term guide.  
For day-to-day work, pick a priority level (starting from P0), choose a few items, and treat each bullet as a concrete task or ticket.