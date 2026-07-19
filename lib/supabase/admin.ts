import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Server-only client for API route writes. Uses the service-role key when
// available (bypasses RLS); falls back to the anon key, which still works
// because v1 RLS is permissive (see supabase/migrations/0001_init.sql).
// NEVER import this into a client component — it must never reach the browser.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createSupabaseClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
