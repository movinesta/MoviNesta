# MoviNesta – Vite + React + TS + Tailwind (Linked Skeleton)

This is a **navigation-ready skeleton**:

- Vite + React + TypeScript + Tailwind configured.
- React Router wired with all main routes:
  - `/auth/signin`
  - `/auth/signup`
  - `/`
  - `/swipe`
  - `/messages`
  - `/messages/:conversationId`
  - `/search`
  - `/diary`
  - `/title/:titleId`
  - `/u/:username`
  - `/settings/profile`
  - `/settings/account`
  - `/settings/notifications`
  - `/settings/app`
- Bottom tab bar links: **Home**, **Swipe**, **Messages**, **Search**, **Diary**.

All pages exist as simple placeholder components.  
When you are ready to implement a screen, just **replace the corresponding
`*.tsx` file** in `src/modules/...` with your real implementation.

## Quick start

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (default: http://localhost:5173).

You should see the app shell with bottom navigation and basic routing working.
