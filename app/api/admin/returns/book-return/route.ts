import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import * as ep from "@/lib/easyparcel/api";

export const maxDuration = 60;

const DEFAULT_DIMS = { length: 30, width: 20, height: 15 };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Today in Malaysia, or tomorrow after 3pm (courier cut-off). */
function collectionDate() {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  if (now.getUTCHours() >= 15) now.setUTCDate(now.getUTCDate() + 1);
  return now.toISOString().slice(0, 10);
}

/**
 * MIVO: book the return parcel (customer → shop) with EasyParcel, paid from
 * MIVO's wallet, for a return accepted as MIVO's fault. The customer gets
 * the AWB / label and drops the parcel off at a courier point.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

    const { id } = (await request.json().catch(() => ({}))) as { id?: string };
    if (!id) return NextResponse.json({ error: "Missing return id." }, { status: 400 });

    const admin = createAdminClient();
    const { data: row } = await admin.from("return_requests").select("*").eq("id", id).maybeSingle();
    const r = row as Record<string, unknown> | null;
    if (!r) return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    if (r.return_ep_shipment) {
      // Booked already: fetch the AWB if it wasn't ready at booking time.
      if (!r.return_tracking) {
        const d = await ep.details(String(r.return_ep_shipment)).catch(() => null);
        if (d?.awbNumber) {
          await admin
            .from("return_requests")
            .update({ return_tracking: d.awbNumber, return_awb_url: d.awbUrl, return_courier: d.courier || r.return_courier, updated_at: new Date().toISOString() })
            .eq("id", id);
          return NextResponse.json({ already: true, courier: d.courier || r.return_courier, awbNumber: d.awbNumber, labelUrl: d.awbUrl });
        }
        return NextResponse.json({ already: true, pending: true, courier: r.return_courier });
      }
      return NextResponse.json({ already: true, courier: r.return_courier, awbNumber: r.return_tracking, labelUrl: r.return_awb_url });
    }
    if (r.status !== "approved_return") {
      return NextResponse.json({ error: "Accept the return first (status is " + r.status + ")." }, { status: 409 });
    }
    if (r.free_return === false) {
      return NextResponse.json({ error: "This return was requested more than 7 days after delivery, so it isn't a free return — the customer posts it back." }, { status: 409 });
    }
    if (!r.seller_fault) {
      return NextResponse.json({ error: "Only returns accepted as our fault get a free return parcel." }, { status: 409 });
    }

    const items = (r.items as Array<{ order_item_id: string; quantity: number }>) || [];
    const [{ data: order }, { data: shop }, { data: orderItems }] = await Promise.all([
      admin.from("orders").select("order_number, shipping_address").eq("id", r.order_id as string).maybeSingle(),
      admin.from("sellers").select("shop_name, pickup_address").eq("id", r.seller_id as string).maybeSingle(),
      admin.from("order_items").select("id, variant_id, product_name, unit_price").in("id", items.map((i) => i.order_item_id)),
    ]);
    if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
    const pickup = (shop?.pickup_address || {}) as Record<string, string>;
    if (!pickup.line || !pickup.postcode || !pickup.phone) {
      return NextResponse.json({ error: "Add this shop's pickup address in Shop settings first (the return goes there)." }, { status: 409 });
    }
    const address = (order.shipping_address || {}) as Record<string, string>;
    if (!address.address_line_1 || !address.postcode || !address.phone) {
      return NextResponse.json({ error: "The order's delivery address is incomplete, so the return can't be booked." }, { status: 409 });
    }

    const variantIds = (orderItems || []).map((i) => i.variant_id).filter(Boolean);
    const { data: variants } = variantIds.length
      ? await admin.from("product_variants").select("id, weight_kg, length_cm, width_cm, height_cm").in("id", variantIds)
      : { data: [] };
    const byId = new Map((variants || []).map((v) => [v.id, v as Record<string, number | null>]));
    const qtyOf = new Map(items.map((i) => [i.order_item_id, Number(i.quantity || 1)]));
    let weight = 0, length = 0, width = 0, height = 0, value = 0;
    for (const item of orderItems || []) {
      const v = byId.get(item.variant_id);
      const qty = qtyOf.get(item.id) || 1;
      weight += Number(v?.weight_kg || 0.5) * qty;
      length = Math.max(length, Number(v?.length_cm || 0));
      width = Math.max(width, Number(v?.width_cm || 0));
      height += Number(v?.height_cm || 0) * qty;
      value += Number(item.unit_price || 0) * qty;
    }
    const sender: ep.Address = {
      name: address.full_name || "Customer",
      phone: address.phone,
      line1: address.address_line_1,
      line2: address.address_line_2 || null,
      postcode: address.postcode,
      city: address.city || "",
      state: address.state || "",
    };
    const receiver: ep.Address = {
      name: pickup.name || shop?.shop_name || "MIVO shop",
      phone: pickup.phone,
      line1: pickup.line,
      line2: pickup.line2 || null,
      postcode: pickup.postcode,
      city: pickup.city,
      state: pickup.state,
    };
    const parcel: ep.Parcel = {
      weight: Math.max(0.1, Math.round(weight * 100) / 100),
      length: length || DEFAULT_DIMS.length,
      width: width || DEFAULT_DIMS.width,
      height: Math.min(height, 100) || DEFAULT_DIMS.height,
      value: Math.round(value * 100) / 100,
      content: "Return " + String(r.request_number) + ": " + ((orderItems || []).map((i) => i.product_name).join(", ") || "Car parts"),
    };

    const quotes = await ep.quote(sender, receiver, parcel);
    const service = ep.pickService(quotes, "dropoff");
    if (!service) return NextResponse.json({ error: "No drop-off courier service for this route." }, { status: 400 });

    let booking = await ep.submit({
      reference: String(r.request_number),
      serviceId: service.serviceId,
      collectionDate: collectionDate(),
      sender,
      receiver,
      parcel,
    });
    for (const delay of [2000, 4000]) {
      if (booking.awbNumber) break;
      await wait(delay);
      const d = await ep.details(booking.shipmentNumber).catch(() => null);
      if (d?.awbNumber) booking = { ...booking, awbNumber: d.awbNumber, awbUrl: d.awbUrl || booking.awbUrl, trackingUrl: d.trackingUrl || booking.trackingUrl };
    }
    const courier = booking.courier || service.courierName;
    const { error: saveError } = await admin
      .from("return_requests")
      .update({
        return_courier: courier,
        return_tracking: booking.awbNumber,
        return_awb_url: booking.awbUrl,
        return_ep_shipment: booking.shipmentNumber,
        return_label_cost: booking.paid ?? service.price,
        return_booked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
    if (saveError) {
      return NextResponse.json(
        { error: "Booked with EasyParcel (" + booking.shipmentNumber + ") but MIVO couldn't save it: " + saveError.message + ". Don't book again." },
        { status: 500 }
      );
    }
    await admin
      .from("return_request_events")
      .insert({ request_id: id, actor: "mivo", action: "return_booked", note: courier + " " + (booking.awbNumber || booking.shipmentNumber), amount: booking.paid ?? service.price })
      .then(() => undefined, () => undefined);

    return NextResponse.json({
      courier,
      awbNumber: booking.awbNumber,
      labelUrl: booking.awbUrl,
      price: booking.paid ?? service.price,
      pending: !booking.awbNumber,
    });
  } catch (caught) {
    const e = caught as { message?: string; status?: number };
    return NextResponse.json({ error: e?.message || "Couldn't book the return." }, { status: e?.status && e.status >= 400 ? e.status : 500 });
  }
}
