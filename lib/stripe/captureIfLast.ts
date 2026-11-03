import { createAdminClient } from "@/lib/supabase/admin";
import { captureOrderPayment } from "@/lib/stripe/holds";

/**
 * Held card payments are charged once, when the order's last shop parcel
 * ships. Pass the parcel about to ship; other parcels still waiting keep the
 * hold (the daily cron charges it before it expires).
 */
export async function captureIfLastParcel(orderId: string, parcelId?: string | null) {
  if (parcelId) {
    const admin = createAdminClient();
    const { data: parcels } = await admin.from("seller_orders").select("*").eq("order_id", orderId);
    const rows = (parcels || []) as Array<{ id: string; status: string; shipping_group?: string | null }>;
    // Parcels in the same shipping group ship together with this one.
    const group = rows.find((p) => p.id === parcelId)?.shipping_group || null;
    const waiting = rows.filter(
      (p) =>
        p.id !== parcelId &&
        !(group && p.shipping_group === group) &&
        !["shipped", "delivered", "completed", "cancelled", "refunded"].includes(String(p.status))
    );
    if (waiting.length) return { result: "waiting" as const, waiting: waiting.length };
  }
  return { result: await captureOrderPayment(orderId) };
}
