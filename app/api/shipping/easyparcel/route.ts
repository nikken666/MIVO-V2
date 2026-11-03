import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { EasyParcelError } from "@/lib/easyparcel/api";
import { arrangeWithEasyParcel, completePendingBooking, previewArrangement } from "@/lib/easyparcel/shipping";

/**
 * Seller Centre / MIVO admin: arrange a shop parcel with EasyParcel.
 * body: { action: "preview" | "arrange" | "refresh", sellerOrderId, method?: "pickup" | "dropoff", weight?, length?, width?, height? }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const body = (await request.json()) as {
      action?: string;
      sellerOrderId?: string;
      method?: string;
      weight?: number;
      length?: number;
      width?: number;
      height?: number;
    };
    if (!body.sellerOrderId) return NextResponse.json({ error: "Missing parcel." }, { status: 400 });

    // MIVO admins, or the owner of the parcel's shop.
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) {
      const { data: mine } = await createAdminClient()
        .from("seller_orders")
        .select("id, sellers!inner(owner_id)")
        .eq("id", body.sellerOrderId)
        .eq("sellers.owner_id", user.id)
        .maybeSingle();
      if (!mine) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const method = body.method === "dropoff" ? "dropoff" : "pickup";
    const overrides = {
      weight: Number(body.weight) > 0 ? Number(body.weight) : undefined,
      length: Number(body.length) > 0 ? Number(body.length) : undefined,
      width: Number(body.width) > 0 ? Number(body.width) : undefined,
      height: Number(body.height) > 0 ? Number(body.height) : undefined,
    };

    if (body.action === "label") {
      const { data: shipment } = await createAdminClient()
        .from("shipments")
        .select("awb_url, label_urls, tracking_number, courier_name, ep_shipment_number")
        .eq("seller_order_id", body.sellerOrderId)
        .maybeSingle();
      return NextResponse.json({ shipment });
    }
    if (body.action === "preview") return NextResponse.json(await previewArrangement(body.sellerOrderId, method, overrides));
    if (body.action === "refresh") return NextResponse.json(await completePendingBooking(body.sellerOrderId));
    if (body.action === "arrange") return NextResponse.json(await arrangeWithEasyParcel(body.sellerOrderId, method, overrides));
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (caught) {
    const status = caught instanceof EasyParcelError ? caught.status : 500;
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "EasyParcel request failed." },
      { status: status >= 400 && status < 600 ? status : 500 }
    );
  }
}
