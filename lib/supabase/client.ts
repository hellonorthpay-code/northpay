import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Single browser-side Supabase client.
 * Import this anywhere in client components — it's a singleton so
 * the same auth session is shared across the whole app.
 */
export const supabase = createClient(url, key, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
  },
});
