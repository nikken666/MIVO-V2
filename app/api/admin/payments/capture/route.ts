import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureIfLastParcel } from "@/lib/stripe/captureIfLast";

/** Admin: charge a held card payment, called just before an order ships. */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { data: isAdmin } = await supabase.rpc("is_admin");

    const { orderNumber, parcelId } = (await request.json()) as { orderNumber?: string; parcelId?: string | null };
    if (!orderNumber) return NextResponse.json({ error: "Missing order number." }, { status: 400 });

    const admin = createAdminClient();
    const { data: order } = await admin
      .from("orders")
      .select("id")
      .eq("order_number", orderNumber)
      .maybeSingle();
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

    // Sellers may charge only orders that contain one of their shop parcels.
    if (!isAdmin) {
      const { data: mine } = await admin
        .from("seller_orders")
        .select("id, sellers!inner(owner_id)")
        .eq("order_id", order.id)
        .eq("sellers.owner_id", user.id)
        .limit(1);
      if (!mine?.length) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    return NextResponse.json(await captureIfLastParcel(order.id, parcelId));
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Unable to charge the card." },
      { status: 502 }
    );
  }
}
