/// <reference lib="deno.ns" />
/// <reference lib="dom" />

// This file exists to support `/// <reference path="../_shared/deno.d.ts" />`
// directives used by Supabase Edge Functions in this repository.
//
// Supabase Edge Functions run on Deno. Referencing `deno.ns` enables correct
// typing for the global `Deno` namespace during typechecking.
