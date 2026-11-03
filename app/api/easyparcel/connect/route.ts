import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { easyParcelConfig } from "@/lib/easyparcel/oauth";

/** Superadmin: link MIVO's EasyParcel account (OAuth authorization code). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/admin/shipping", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  if (!isSuperadmin) return NextResponse.json({ error: "Only the MIVO superadmin can connect EasyParcel." }, { status: 403 });

  const config = easyParcelConfig();
  const state = randomBytes(16).toString("hex");
  const url = new URL(config.authBase + "/oauth/login");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);

  const response = NextResponse.redirect(url.toString());
  response.cookies.set("ep_oauth_state", state, { httpOnly: true, secure: true, sameSite: "lax", maxAge: 600, path: "/" });
  return response;
}
