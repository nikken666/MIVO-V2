import { createAdminClient } from "@/lib/supabase/admin";
import { captureIfLastParcel } from "@/lib/stripe/captureIfLast";
import * as ep from "@/lib/easyparcel/api";

// Arranges a shop parcel with EasyParcel: quote → book & pay from MIVO's
// wallet → AWB label + tracking → parcel marked shipped. Callers check that
// the user may manage the parcel first.

type ParcelContext = {
  sellerOrderId: string;
  orderId: string;
  orderNumber: string;
  sender: ep.Address;
  receiver: ep.Address;
  parcel: ep.Parcel;
};

type Overrides = { weight?: number; length?: number; width?: number; height?: number };

const DEFAULT_DIMS = { length: 30, width: 20, height: 15 };

async function loadParcel(sellerOrderId: string, overrides: Overrides = {}): Promise<ParcelContext> {
  const admin = createAdminClient();
  const { data: so } = await admin
    .from("seller_orders")
    .select("id, order_id, seller_id, status")
    .eq("id", sellerOrderId)
    .maybeSingle();
  if (!so) throw new ep.EasyParcelError("Shop parcel not found.", 404);

  const [{ data: order }, { data: shop }, { data: items }, { data: existing }] = await Promise.all([
    admin.from("orders").select("id, order_number, status, payment_status, shipping_address, user_id").eq("id", so.order_id).maybeSingle(),
    admin.from("sellers").select("shop_name, pickup_address").eq("id", so.seller_id).maybeSingle(),
    admin.from("order_items").select("variant_id, product_name, quantity, line_subtotal").eq("seller_order_id", so.id),
    admin.from("shipments").select("id, ep_shipment_number, tracking_number").eq("seller_order_id", so.id).limit(1),
  ]);
  if (!order) throw new ep.EasyParcelError("Order not found.", 404);
  if (order.payment_status !== "paid") throw new ep.EasyParcelError("This order isn't paid yet.", 409);
  if (["shipped", "delivered", "completed", "cancelled", "refunded"].includes(so.status)) {
    throw new ep.EasyParcelError("This parcel is already " + so.status + ".", 409);
  }
  if (existing?.[0]?.ep_shipment_number) {
    throw new ep.EasyParcelError("Already booked with EasyParcel (" + existing[0].ep_shipment_number + "). Use Refresh to get the label.", 409);
  }

  const pickup = (shop?.pickup_address || {}) as Record<string, string>;
  if (!pickup.line || !pickup.postcode || !pickup.phone) {
    throw new ep.EasyParcelError("Add this shop's pickup address in Shop settings first.", 409);
  }
  const address = (order.shipping_address || {}) as Record<string, string>;

  const variantIds = (items || []).map((i) => i.variant_id).filter(Boolean);
  const { data: variants } = variantIds.length
    ? await admin.from("product_variants").select("id, weight_kg, length_cm, width_cm, height_cm").in("id", variantIds)
    : { data: [] };
  const byId = new Map((variants || []).map((v) => [v.id, v]));
  let weight = 0;
  let length = 0;
  let width = 0;
  let height = 0;
  for (const item of items || []) {
    const v = byId.get(item.variant_id) as Record<string, number | null> | undefined;
    weight += Number(v?.weight_kg || 0.5) * Number(item.quantity || 1);
    length = Math.max(length, Number(v?.length_cm || 0));
    width = Math.max(width, Number(v?.width_cm || 0));
    height += Number(v?.height_cm || 0) * Number(item.quantity || 1);
  }

  return {
    sellerOrderId: so.id,
    orderId: order.id,
    orderNumber: order.order_number,
    sender: {
      name: pickup.name || shop?.shop_name || "MIVO shop",
      phone: pickup.phone,
      line1: pickup.line,
      line2: pickup.line2 || null,
      postcode: pickup.postcode,
      city: pickup.city,
      state: pickup.state,
    },
    receiver: {
      name: address.full_name || "Customer",
      phone: address.phone || "",
      line1: address.address_line_1 || "",
      line2: address.address_line_2 || null,
      postcode: address.postcode || "",
      city: address.city || "",
      state: address.state || "",
    },
    parcel: {
      weight: Math.max(0.1, Math.round((overrides.weight ?? weight) * 100) / 100),
      length: overrides.length ?? (length || DEFAULT_DIMS.length),
      width: overrides.width ?? (width || DEFAULT_DIMS.width),
      height: overrides.height ?? (Math.min(height, 100) || DEFAULT_DIMS.height),
      value: Math.round((items || []).reduce((s, i) => s + Number(i.line_subtotal || 0), 0) * 100) / 100,
      content: (items || []).map((i) => i.product_name).join(", ") || "Car parts",
    },
  };
}

/** Today in Malaysia, or tomorrow after 3pm (courier cut-off). */
function collectionDate() {
  const now = new Date(Date.now() + 8 * 3600 * 1000);
  if (now.getUTCHours() >= 15) now.setUTCDate(now.getUTCDate() + 1);
  return now.toISOString().slice(0, 10);
}

export async function previewArrangement(sellerOrderId: string, method: "pickup" | "dropoff", overrides?: Overrides) {
  const ctx = await loadParcel(sellerOrderId, overrides);
  const quotes = await ep.quote(ctx.sender, ctx.receiver, ctx.parcel);
  return { parcel: ctx.parcel, choice: ep.pickService(quotes, method), options: quotes.slice(0, 8) };
}

async function markShipped(sellerOrderId: string, courier: string, awb: string, trackingUrl: string | null) {
  const admin = createAdminClient();
  const { error } = await admin.rpc("mivo_system_ship_parcel", {
    p_seller_order_id: sellerOrderId,
    p_courier: courier,
    p_tracking: awb,
    p_tracking_url: trackingUrl,
  });
  if (error) throw new ep.EasyParcelError("Booked, but the parcel couldn't be marked shipped: " + error.message, 500);
}

async function saveBooking(sellerOrderId: string, booking: ep.Booking, extra: Record<string, unknown>) {
  const admin = createAdminClient();
  const fields = {
    provider: "easyparcel",
    ep_shipment_number: booking.shipmentNumber,
    ep_order_number: booking.orderNumber,
    ep_paid_amount: booking.paid,
    awb_url: booking.awbUrl,
    label_urls: booking.labelUrls,
    ...extra,
  };
  const { data: existing } = await admin.from("shipments").select("id").eq("seller_order_id", sellerOrderId).limit(1);
  const { error } = existing?.[0]
    ? await admin.from("shipments").update(fields).eq("id", existing[0].id)
    : await admin.from("shipments").insert({
        seller_order_id: sellerOrderId,
        courier_name: booking.courier || null,
        status: "booked",
        ...fields,
      });
  if (error) {
    // Already paid at EasyParcel: say exactly which booking so it can be recovered.
    console.error("EasyParcel booking not saved", booking.shipmentNumber, error.message);
    throw new ep.EasyParcelError(
      "Booked with EasyParcel (" + booking.shipmentNumber + ", AWB " + (booking.awbNumber || "pending") +
        ") but MIVO couldn't save it: " + error.message + ". Don't book again — contact MIVO.",
      500
    );
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Book the cheapest pickup/drop-off service and ship the parcel. */
export async function arrangeWithEasyParcel(sellerOrderId: string, method: "pickup" | "dropoff", overrides?: Overrides) {
  const ctx = await loadParcel(sellerOrderId, overrides);
  const quotes = await ep.quote(ctx.sender, ctx.receiver, ctx.parcel);
  const service = ep.pickService(quotes, method);
  if (!service) {
    throw new ep.EasyParcelError(
      "No " + (method === "pickup" ? "pickup" : "drop-off") + " service for this route. Try the other option.",
      400
    );
  }

  // Charge the held card first (only when this is the order's last parcel),
  // so MIVO never pays for a label on an order whose card fails.
  await captureIfLastParcel(ctx.orderId, ctx.sellerOrderId);

  let booking = await ep.submit({
    reference: ctx.orderNumber + "-" + ctx.sellerOrderId.slice(0, 8),
    serviceId: service.serviceId,
    collectionDate: collectionDate(),
    sender: ctx.sender,
    receiver: ctx.receiver,
    parcel: ctx.parcel,
  });

  // The AWB can arrive a few seconds later.
  for (const delay of [2000, 4000]) {
    if (booking.awbNumber) break;
    await wait(delay);
    const d = await ep.details(booking.shipmentNumber).catch(() => null);
    if (d?.awbNumber) booking = { ...booking, awbNumber: d.awbNumber, awbUrl: d.awbUrl || booking.awbUrl, trackingUrl: d.trackingUrl || booking.trackingUrl };
  }

  const courier = booking.courier || service.courierName;
  await saveBooking(ctx.sellerOrderId, booking, {
    ep_service_id: service.serviceId,
    ep_service_name: service.serviceName,
    collection_method: method,
    pickup_date: collectionDate(),
  });

  if (booking.awbNumber) {
    await markShipped(ctx.sellerOrderId, courier, booking.awbNumber, booking.trackingUrl);
    await saveBooking(ctx.sellerOrderId, booking, {});
  }

  return {
    courier,
    service: service.serviceName,
    price: booking.paid ?? service.price,
    awbNumber: booking.awbNumber,
    labelUrl: booking.awbUrl,
    shipmentNumber: booking.shipmentNumber,
    pending: !booking.awbNumber,
  };
}

/** Booked but no AWB yet: fetch it and finish shipping. */
export async function completePendingBooking(sellerOrderId: string) {
  const admin = createAdminClient();
  const { data: shipment } = await admin
    .from("shipments")
    .select("id, ep_shipment_number, courier_name, tracking_number")
    .eq("seller_order_id", sellerOrderId)
    .not("ep_shipment_number", "is", null)
    .maybeSingle();
  if (!shipment?.ep_shipment_number) throw new ep.EasyParcelError("Not booked with EasyParcel.", 404);
  const d = await ep.details(shipment.ep_shipment_number);
  if (!d.awbNumber) return { pending: true };
  if (!shipment.tracking_number) {
    await markShipped(sellerOrderId, d.courier || shipment.courier_name || "Courier", d.awbNumber, d.trackingUrl);
  }
  await admin
    .from("shipments")
    .update({ awb_url: d.awbUrl, tracking_status_code: d.statusCode, tracking_status: d.status })
    .eq("id", shipment.id);
  return { pending: false, awbNumber: d.awbNumber, labelUrl: d.awbUrl };
}

/** Pull the latest courier scans for these shipments (at most every 20 minutes each). */
export async function refreshTracking(shipmentIds: string[], force = false) {
  if (!shipmentIds.length) return;
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("shipments")
    .select("id, tracking_number, tracking_checked_at, provider, status")
    .in("id", shipmentIds);
  const due = (rows || []).filter(
    (row) =>
      row.provider === "easyparcel" &&
      row.tracking_number &&
      row.status !== "delivered" &&
      (force || !row.tracking_checked_at || Date.now() - new Date(row.tracking_checked_at).getTime() > 20 * 60 * 1000)
  );
  if (!due.length) return;
  const results = await ep.tracking(due.map((row) => row.tracking_number as string));
  const now = new Date().toISOString();
  for (const row of due) {
    const result = results.find((r) => r.awbNumber === row.tracking_number);
    await admin
      .from("shipments")
      .update({
        tracking_checked_at: now,
        ...(result ? { tracking_status_code: result.statusCode, tracking_status: result.status } : {}),
        ...(result?.statusCode === 5 ? { status: "delivered", delivered_at: now } : {}),
      })
      .eq("id", row.id);
    if (result?.events.length) {
      await admin.from("shipment_tracking_events").upsert(
        result.events.map((e) => ({
          shipment_id: row.id,
          status_code: e.code,
          description: e.description,
          location: e.location,
          event_time: e.time,
        })),
        { onConflict: "shipment_id,event_time,description", ignoreDuplicates: true }
      );
    }
  }
}
