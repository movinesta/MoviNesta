# Edge Functions dependency strategy

This project uses Supabase Edge Functions (Deno). The goals here are:

- **Reliable deployments** (no flaky CDN resolution)
- **Per-function isolation** (changing one function's deps doesn't break another)
- **Reproducible local dev** without generating bulky `node_modules`

## Rules

### 1) One `deno.json` per function (deployment)
Each function directory contains a `deno.json`.
Supabase recommends per-function configuration for proper isolation when deploying.

### 2) Use npm + JSR instead of remote CDNs
- npm modules are imported via `deno.json` `imports` aliases:
  - `supabase` -> `npm:@supabase/supabase-js@2.90.1`
  - `zod` -> `npm:zod@3.23.8`
- Deno Standard Library comes from JSR, for example:
  - `jsr:@std/http@0.224.0`

### 3) Lockfile policy
We set `"lock": false` in each function's `deno.json`.

Why:
- Deno lockfiles improve reproducibility, but **Supabase Edge Functions currently only support lockfile version 4**.
- Deno 2.3+ introduced lockfile v5, which can cause deploy issues until the platform supports it.

If you want lockfiles:
- Generate a v4 lockfile with a compatible Deno version (for example Deno 2.2.x), and then set:
  - `"lock": { "path": "../deno.lock", "frozen": true }`
  - Commit `supabase/functions/deno.lock`

### 4) Avoid `node_modules` in functions
We set `"nodeModulesDir": "none"` so Deno uses its cache instead of creating a local `node_modules` folder.

## Maintenance

Run this to keep function configs consistent:

```bash
node scripts/ensure-edge-deno-config.mjs --write
```

## Typechecking

Run a full type-check of all Edge Functions (requires Deno installed):

```bash
npm run edge:check
```

In CI, this runs via GitHub Actions using `denoland/setup-deno`.
