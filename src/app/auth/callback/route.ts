import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles the email-confirmation / magic-link return: exchanges the code for a
// session cookie, then sends the user into the app. Needed when Supabase
// "Confirm email" is ON.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/app";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
