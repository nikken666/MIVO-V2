import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { captureOrderPayment } from "@/lib/stripe/holds";

// Daily (vercel.json): charge card holds that would expire within a day.
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
  return NextResponse.json({ captured: results.filter((r) => r.ok).length, results });
}
