import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Address = Record<string, unknown> | null;

export type LabelData = {
  parcelId: string;
  orderNumber: string;
  orderDate: string;
  parcelNo: number;
  parcelCount: number;
  status: string;
  courier: string | null;
  tracking: string | null;
  note: string | null;
  weightKg: number;
  from: { name: string; phone: string; lines: string[] };
  to: { name: string; phone: string; lines: string[] };
  items: Array<{ name: string; variant: string | null; sku: string; qty: number }>;
};

const text = (value: unknown) => String(value ?? "").trim();

function addressLines(a: Address) {
  if (!a) return [];
  return [
    text(a.address_line_1 ?? a.line ?? a.address),
    text(a.address_line_2 ?? a.line2),
    [text(a.postcode), text(a.city)].filter(Boolean).join(" "),
    text(a.state),
  ].filter(Boolean);
}

/**
 * Data for printable shipping labels (packing slips): sender, receiver and
 * the parts in each parcel. MIVO admins get any parcel; a shop owner only
 * their own shop's parcels.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { parcels?: string[]; orders?: string[] };
    const parcelIds = (body.parcels || []).filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 200);
    const orderNumbers = (body.orders || []).map(text).filter(Boolean).slice(0, 200);
    if (!parcelIds.length && !orderNumbers.length) return NextResponse.json({ error: "Choose parcels to print." }, { status: 400 });

    const admin = createAdminClient();
    const { data: isAdmin } = await supabase.rpc("is_admin");

    // Parcels asked for (directly, or all parcels of the orders asked for).
    let orderIds: string[] = [];
    if (orderNumbers.length) {
      const { data } = await admin.from("orders").select("id").in("order_number", orderNumbers);
      orderIds = (data || []).map((o) => o.id as string);
    }
    const parcelQuery = admin.from("seller_orders").select("*");
    const { data: parcelRows, error: parcelError } = parcelIds.length && orderIds.length
      ? await parcelQuery.or(`id.in.(${parcelIds.join(",")}),order_id.in.(${orderIds.join(",")})`)
      : parcelIds.length
        ? await parcelQuery.in("id", parcelIds)
        : await parcelQuery.in("order_id", orderIds.length ? orderIds : ["00000000-0000-0000-0000-000000000000"]);
    if (parcelError) throw parcelError;
    let parcels = (parcelRows || []) as Array<Record<string, unknown>>;

    const sellerIds = [...new Set(parcels.map((p) => p.seller_id as string).filter(Boolean))];
    const { data: sellerRows } = sellerIds.length
      ? await admin.from("sellers").select("*").in("id", sellerIds)
      : { data: [] as Array<Record<string, unknown>> };
    const sellers = new Map((sellerRows || []).map((s) => [s.id as string, s as Record<string, unknown>]));

    if (!isAdmin) {
      parcels = parcels.filter((p) => sellers.get(p.seller_id as string)?.owner_id === user.id);
      if (!parcels.length) return NextResponse.json({ error: "You can only print your own shop's parcels." }, { status: 403 });
    }

    const ids = parcels.map((p) => p.id as string);
    const allOrderIds = [...new Set(parcels.map((p) => p.order_id as string))];
    const [{ data: orderRows }, { data: itemRows }, { data: shipmentRows }, { data: siblingRows }] = await Promise.all([
      admin.from("orders").select("id, order_number, created_at, shipping_address, customer_note").in("id", allOrderIds),
      admin.from("order_items").select("seller_order_id, product_name, variant_name, sku, quantity, variant_id").in("seller_order_id", ids),
      admin.from("shipments").select("seller_order_id, courier_name, tracking_number, created_at").in("seller_order_id", ids).order("created_at", { ascending: false }),
      admin.from("seller_orders").select("id, order_id, created_at").in("order_id", allOrderIds).order("created_at", { ascending: true }),
    ]);
    const orders = new Map((orderRows || []).map((o) => [o.id as string, o as Record<string, unknown>]));

    const variantIds = [...new Set((itemRows || []).map((i) => i.variant_id as string).filter(Boolean))];
    const { data: variantRows } = variantIds.length
      ? await admin.from("product_variants").select("id, weight_kg").in("id", variantIds)
      : { data: [] as Array<{ id: string; weight_kg: number }> };
    const weight = new Map((variantRows || []).map((v) => [v.id as string, Number(v.weight_kg) || 0]));

    const labels: LabelData[] = parcels
      .map((p) => {
        const order = orders.get(p.order_id as string) || {};
        const seller = sellers.get(p.seller_id as string) || {};
        const pickup = (seller.pickup_address as Address) || null;
        const to = ((p.shipping_address as Address) || (order.shipping_address as Address) || {}) as Record<string, unknown>;
        const items = (itemRows || []).filter((i) => i.seller_order_id === p.id);
        const shipment = (shipmentRows || []).find((s) => s.seller_order_id === p.id);
        const siblings = (siblingRows || []).filter((s) => s.order_id === p.order_id);
        return {
          parcelId: p.id as string,
          orderNumber: text(order.order_number || p.order_number),
          orderDate: text(order.created_at),
          parcelNo: Math.max(1, siblings.findIndex((s) => s.id === p.id) + 1),
          parcelCount: Math.max(1, siblings.length),
          status: text(p.status),
          courier: text(shipment?.courier_name || p.courier_name || p.buyer_courier_name) || null,
          tracking: text(shipment?.tracking_number) || null,
          note: text(p.customer_note || order.customer_note) || null,
          weightKg: Math.round(items.reduce((sum, i) => sum + (weight.get(i.variant_id as string) || 0) * Number(i.quantity || 1), 0) * 100) / 100,
          from: {
            name: text(seller.shop_name) || "MIVO",
            phone: text(pickup?.phone ?? seller.phone ?? seller.contact_phone),
            lines: addressLines(pickup),
          },
          to: {
            name: text(to.full_name ?? to.name) || "Customer",
            phone: text(to.phone),
            lines: addressLines(to),
          },
          items: items.map((i) => ({
            name: text(i.product_name),
            variant: text(i.variant_name) || null,
            sku: text(i.sku),
            qty: Number(i.quantity || 1),
          })),
        };
      })
      .sort((a, b) => a.orderNumber.localeCompare(b.orderNumber) || a.parcelNo - b.parcelNo);

    return NextResponse.json({ labels });
  } catch (caught) {
    const e = caught as { message?: string; code?: string };
    return NextResponse.json({ error: e?.message || "Couldn't load the labels." }, { status: 500 });
  }
}
