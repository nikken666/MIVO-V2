import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureOrderPayment } from "@/lib/stripe/holds";
import { payReturnRefund } from "@/lib/returns/payRefund";
import { completePendingBooking, refreshTracking } from "@/lib/easyparcel/shipping";

// Daily (vercel.json): charge card holds that would expire within a day,
// run return-request housekeeping and cancel orders never paid.
// Stripe keeps an online card hold about 7 days; holds are due after 6.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("orders")
    .select("id, order_number")
    .eq("payment_capture_status", "authorized")
    .not("status", "in", "(cancelled,refunded)")
    .lt("payment_authorized_until", new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString())
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Array<{ order: string; ok: boolean; error?: string }> = [];
  for (const order of data || []) {
    try {
      await captureOrderPayment(order.id);
      results.push({ order: order.order_number, ok: true });
    } catch (caught) {
      results.push({ order: order.order_number, ok: false, error: caught instanceof Error ? caught.message : String(caught) });
    }
  }
  // Returns: auto-accept requests the seller ignored, close ones never sent back.
  const returns = await admin.rpc("return_requests_auto").then(
    (r) => r.data ?? r.error?.message,
    () => null
  );

  // Returns: refund requests that are approved (including those whose 3-day
  // seller inspection ended without a dispute).
  const refunds: Array<{ id: string; ok: boolean; error?: string }> = [];
  const { data: toRefund } = await admin
    .from("return_requests")
    .select("id")
    .eq("status", "refunding")
    .is("stripe_refund_id", null)
    .limit(100);
  for (const row of (toRefund as Array<{ id: string }> | null) || []) {
    try {
      await payReturnRefund(row.id);
      refunds.push({ id: row.id, ok: true });
    } catch (caught) {
      refunds.push({ id: row.id, ok: false, error: caught instanceof Error ? caught.message : String(caught) });
    }
  }

  // EasyParcel: finish bookings still waiting for an AWB, refresh tracking.
  let easyparcel: unknown = null;
  try {
    const { data: pending } = await admin
      .from("shipments")
      .select("id, seller_order_id, tracking_number")
      .eq("provider", "easyparcel")
      .neq("status", "delivered")
      .limit(200);
    for (const row of (pending as Array<{ id: string; seller_order_id: string; tracking_number: string | null }> | null) || []) {
      if (!row.tracking_number) await completePendingBooking(row.seller_order_id).catch(() => undefined);
    }
    await refreshTracking(((pending as Array<{ id: string }> | null) || []).map((row) => row.id), true);
    easyparcel = { checked: pending?.length || 0 };
  } catch (caught) {
    easyparcel = caught instanceof Error ? caught.message : String(caught);
  }

  // Unpaid orders: cancelled once their 24-hour payment window has passed
  // (plus an hour, so a shopper still on the card page isn't cut off). The
  // order rules in the database put their reserved stock back on sale, the
  // same as when a shopper cancels an unpaid order.
  let expired: unknown = null;
  try {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const dayAgo = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    const { data: stale, error: staleError } = await admin
      .from("orders")
      .select("id, order_number, expires_at, created_at")
      .eq("status", "pending_payment")
      .neq("payment_status", "paid")
      .lt("created_at", dayAgo)
      .limit(200);
    if (staleError) throw staleError;
    let cancelled = 0;
    for (const order of (stale as Array<{ id: string; expires_at: string | null }> | null) || []) {
      if (order.expires_at && order.expires_at > cutoff) continue;
      const { data: done } = await admin
        .from("orders")
        .update({
          status: "cancelled",
          payment_status: "cancelled",
          cancellation_reason: "Payment not received within 24 hours",
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id)
        .eq("status", "pending_payment")
        .neq("payment_status", "paid")
        .select("id");
      if (!done?.length) continue;
      await admin.from("seller_orders").update({ status: "cancelled" }).eq("order_id", order.id);
      await admin
        .from("order_status_history")
        .insert({ order_id: order.id, old_status: "pending_payment", new_status: "cancelled", note: "Payment not received within 24 hours" })
        .then(() => undefined, () => undefined);
      cancelled++;
    }
    expired = { cancelled };
  } catch (caught) {
    expired = caught instanceof Error ? caught.message : String(caught);
  }

  // Commission: apply scheduled changes, revert finished temporary ones.
  const commission = await admin.rpc("mivo_apply_commission_changes").then(
    (r) => r.data ?? r.error?.message,
    () => null
  );

  return NextResponse.json({ captured: results.filter((r) => r.ok).length, results, returns, refunds, easyparcel, commission, expired });
}
