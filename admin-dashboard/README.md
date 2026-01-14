# MoviNesta Admin Dashboard

A lightweight admin dashboard for MoviNesta, built with **Vite + React** and powered by **Supabase Edge Functions**.

## Requirements
- Node.js 18+
- pnpm (recommended)

## Setup

1) Create a local env file:

```bash
cp .env.example .env.local
```

Fill:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (or `VITE_SUPABASE_PUBLISHABLE_OR_ANON_KEY`)

2) Install dependencies and run:

```bash
pnpm install
pnpm dev
```

## Authentication & Admin Access

The dashboard uses **Supabase Auth** in the browser. Admin privileges are enforced **server-side** by Edge Functions:
- Requests require `Authorization: Bearer <user_jwt>`
- Edge Functions check membership in `public.app_admins` using the **service role** client.

To grant admin access, insert your user id into `public.app_admins` (example):

```sql
insert into public.app_admins (user_id, role) values ('<auth.users.id>', 'admin');
```

## CORS (important for hosted dashboards)

Admin Edge Functions enforce a CORS allowlist.
If you host the dashboard on a custom domain, add it to the allowlist in:

`supabase/functions/_shared/admin.ts`

## Troubleshooting

- **Missing env vars**: ensure `.env.local` contains `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Not an admin**: ensure your user id exists in `public.app_admins`.
