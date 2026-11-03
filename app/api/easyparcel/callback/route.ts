import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { connectWithCode } from "@/lib/easyparcel/oauth";

/** OAuth redirect from EasyParcel: store the tokens, back to Shipping settings. */
export async function GET(request: NextRequest) {
  const back = (result: string) => {
    const response = NextResponse.redirect(new URL("/admin/shipping?easyparcel=" + encodeURIComponent(result), request.url));
    response.cookies.delete("ep_oauth_state");
    return response;
  };
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (!code) return back("cancelled");
  if (!state || state !== request.cookies.get("ep_oauth_state")?.value) return back("state-mismatch");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: isSuperadmin } = await supabase.rpc("is_superadmin");
  if (!user || !isSuperadmin) return back("not-allowed");

  try {
    await connectWithCode(code, user.id);
    return back("connected");
  } catch (caught) {
    return back(caught instanceof Error ? caught.message.slice(0, 120) : "failed");
  }
}
