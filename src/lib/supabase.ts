import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.WANDER_SUPABASE_URL;
// Set in next.config.ts from NEXT_PUBLIC_SUPABASE_* or SUPABASE_* (publishable / anon key).
const key = process.env.WANDER_SUPABASE_KEY;

export const supabaseConfigured = Boolean(url && key);

let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured) return null;
  if (!client) client = createBrowserClient(url!, key!);
  return client;
}
