import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureOrderPayment } from "@/lib/stripe/holds";
import { payReturnRefund } from "@/lib/returns/payRefund";

// Daily (vercel.json): charge card holds that would expire within a day,
// and run return-request housekeeping.
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

  // Commission: apply scheduled changes, revert finished temporary ones.
  const commission = await admin.rpc("mivo_apply_commission_changes").then(
    (r) => r.data ?? r.error?.message,
    () => null
  );

  return NextResponse.json({ captured: results.filter((r) => r.ok).length, results, returns, refunds, commission });
}
