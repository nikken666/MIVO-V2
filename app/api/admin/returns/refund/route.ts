import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { payReturnRefund, RefundError } from "@/lib/returns/payRefund";

/**
 * Pay out an approved return (status "refunding") through Stripe.
 * MIVO admins can refund any request; a seller can refund a request for one
 * of their own shops (after confirming the returned item is fine).
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const { id } = (await request.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Missing request id." }, { status: 400 });

    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      const admin = createAdminClient();
      const { data: ret } = await admin
        .from("return_requests")
        .select("seller_id, sellers!inner(owner_id)")
        .eq("id", id)
        .eq("sellers.owner_id", user.id)
        .maybeSingle();
      if (!ret) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const result = await payReturnRefund(id);
    return NextResponse.json(result);
  } catch (caught) {
    const status = caught instanceof RefundError ? caught.status : 502;
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Refund failed." },
      { status }
    );
  }
}
