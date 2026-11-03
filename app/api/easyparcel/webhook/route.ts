import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { completePendingBooking, refreshTracking } from "@/lib/easyparcel/shipping";

/**
 * EasyParcel webhooks (AWB update, status update, tracking update).
 * Register https://<site>/api/easyparcel/webhook?key=<EASYPARCEL_WEBHOOK_KEY>
 * in the EasyParcel Developer Hub. EasyParcel doesn't sign webhooks, so the
 * payload is only a hint: everything is re-fetched from the API.
 */
export async function POST(request: NextRequest) {
  const expected = process.env.EASYPARCEL_WEBHOOK_KEY || "";
  const given = request.nextUrl.searchParams.get("key") || "";
  if (!expected || given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as { shipment_number?: string; topic?: string };
  if (!payload.shipment_number) return NextResponse.json({ received: true });

  const admin = createAdminClient();
  const { data: shipment } = await admin
    .from("shipments")
    .select("id, seller_order_id, tracking_number")
    .eq("ep_shipment_number", payload.shipment_number)
    .maybeSingle();
  if (!shipment) return NextResponse.json({ received: true, unknown: true });

  try {
    if (!shipment.tracking_number) await completePendingBooking(shipment.seller_order_id);
    await refreshTracking([shipment.id], true);
  } catch {
    // Acknowledge anyway; the daily job retries.
  }
  return NextResponse.json({ received: true });
}
