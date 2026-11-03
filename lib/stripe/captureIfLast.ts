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
    const { data: parcels } = await admin.from("seller_orders").select("id, status").eq("order_id", orderId);
    const waiting = (parcels || []).filter(
      (p) => p.id !== parcelId && !["shipped", "delivered", "completed", "cancelled", "refunded"].includes(p.status)
    );
    if (waiting.length) return { result: "waiting" as const, waiting: waiting.length };
  }
  return { result: await captureOrderPayment(orderId) };
}
