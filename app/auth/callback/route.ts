import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Only paths on this site, never another domain ("//evil.com", "https://..."). */
function safeNext(value: string | null, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

// Email confirmation links and Google / Apple sign-in both come back here.
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeNext(requestUrl.searchParams.get("next"), "/account");
  const failed = () => {
    const back = new URL("/login", requestUrl.origin);
    back.searchParams.set("error", "oauth");
    if (next !== "/account") back.searchParams.set("next", next);
    return NextResponse.redirect(back);
  };

  if (requestUrl.searchParams.get("error")) return failed();

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failed();
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
