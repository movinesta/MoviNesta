// supabase/functions/load-env.test.ts
import { expect, it } from "vitest";

it("loads environment variables", () => {
  expect(import.meta.env.VITE_SUPABASE_URL).toBeDefined();
  expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBeDefined();
});
