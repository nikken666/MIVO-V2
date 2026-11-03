import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { refreshTracking } from "@/lib/easyparcel/shipping";

/** Buyer, shop or MIVO: courier scans for the shipped parcels of an order. ?order=MV... */
export async function GET(request: NextRequest) {
  const orderNumber = request.nextUrl.searchParams.get("order") || "";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("id, user_id").eq("order_number", orderNumber).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  if (order.user_id !== user.id) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    const { data: shopRows } = await admin
      .from("seller_orders")
      .select("id, sellers!inner(owner_id)")
      .eq("order_id", order.id)
      .eq("sellers.owner_id", user.id)
      .limit(1);
    if (!isAdmin && !shopRows?.length) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  }

  const { data: parcels } = await admin.from("seller_orders").select("id, seller_id").eq("order_id", order.id);
  const parcelIds = (parcels || []).map((p) => p.id);
  const { data: shipments } = parcelIds.length
    ? await admin
        .from("shipments")
        .select("id, seller_order_id, courier_name, tracking_number, tracking_url, status, shipped_at, created_at, provider, collection_method")
        .in("seller_order_id", parcelIds)
    : { data: [] };

  await refreshTracking((shipments || []).map((s) => s.id)).catch(() => undefined);

  const ids = (shipments || []).map((s) => s.id);
  const [{ data: fresh }, { data: events }] = await Promise.all([
    ids.length
      ? admin.from("shipments").select("id, tracking_status_code, tracking_status, status").in("id", ids)
      : Promise.resolve({ data: [] as Array<{ id: string; tracking_status_code: number | null; tracking_status: string | null; status: string }> }),
    ids.length
      ? admin
          .from("shipment_tracking_events")
          .select("shipment_id, status_code, description, location, event_time")
          .in("shipment_id", ids)
          .order("event_time", { ascending: false })
      : Promise.resolve({ data: [] as Array<{ shipment_id: string; status_code: number | null; description: string; location: string | null; event_time: string }> }),
  ]);

  return NextResponse.json({
    parcels: (shipments || []).map((s) => {
      const latest = (fresh || []).find((f) => f.id === s.id);
      return {
        sellerOrderId: s.seller_order_id,
        courier: s.courier_name,
        trackingNumber: s.tracking_number,
        trackingUrl: s.tracking_url,
        method: s.collection_method,
        status: latest?.status || s.status,
        statusCode: latest?.tracking_status_code ?? null,
        statusText: latest?.tracking_status ?? null,
        shippedAt: s.shipped_at || s.created_at,
        events: (events || [])
          .filter((e) => e.shipment_id === s.id)
          .map((e) => ({ code: e.status_code, description: e.description, location: e.location, time: e.event_time })),
      };
    }),
  });
}
