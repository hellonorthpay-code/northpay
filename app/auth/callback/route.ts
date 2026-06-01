import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Handles the OAuth redirect after Google sign-in.
 * Supabase appends a `code` query param; we exchange it for a session
 * then redirect the user into the app.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // If something went wrong, land on the profile/login page with an error flag.
  return NextResponse.redirect(`${origin}/dashboard/profile?error=auth_callback`);
}
