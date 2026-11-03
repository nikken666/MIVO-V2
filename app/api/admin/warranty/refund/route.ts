import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeRequest } from "@/lib/stripe/server";
import { captureOrderPayment } from "@/lib/stripe/holds";

type Refund = { id: string; status: string };

/** MIVO: refund an approved warranty claim through Stripe (supabase/warranty-resolution.sql). */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (!isAdmin) return NextResponse.json({ error: "Not allowed." }, { status: 403 });

    const { id } = (await request.json()) as { id?: string };
    if (!id) return NextResponse.json({ error: "Missing claim id." }, { status: 400 });

    const admin = createAdminClient();
    const { data: claim } = await admin
      .from("warranty_claims")
      .select("id, claim_number, order_number, resolution_stage, refund_amount, stripe_refund_id")
      .eq("id", id)
      .maybeSingle();
    if (!claim) return NextResponse.json({ error: "Claim not found." }, { status: 404 });
    if (claim.stripe_refund_id) return NextResponse.json({ refundId: claim.stripe_refund_id, already: true });
    if (claim.resolution_stage !== "refund_pending") {
      return NextResponse.json({ error: "This claim is not ready to refund (" + claim.resolution_stage + ")." }, { status: 409 });
    }
    const amount = Number(claim.refund_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Refund amount is invalid." }, { status: 409 });
    }

    const { data: order } = await admin
      .from("orders")
      .select("id, order_number, total_amount, stripe_payment_intent_id")
      .eq("order_number", claim.order_number)
      .maybeSingle();
    if (!order?.stripe_payment_intent_id) {
      return NextResponse.json({ error: "This order was not paid through Stripe; refund it manually." }, { status: 409 });
    }

    await captureOrderPayment(order.id).catch(() => undefined);

    const params = new URLSearchParams();
    params.set("payment_intent", order.stripe_payment_intent_id);
    params.set("amount", String(Math.round(amount * 100)));
    params.set("metadata[order_number]", order.order_number);
    params.set("metadata[warranty_claim]", claim.claim_number);
    const refund = await stripeRequest<Refund>("/refunds", {
      method: "POST",
      body: params,
      idempotencyKey: "mivo-warranty-" + claim.id,
    });

    const now = new Date().toISOString();
    await admin
      .from("warranty_claims")
      .update({
        resolution_stage: "refunded",
        status: "completed",
        stripe_refund_id: refund.id,
        refunded_at: now,
        updated_at: now,
      })
      .eq("id", claim.id);
    await admin.from("warranty_claim_events").insert({
      claim_id: claim.id,
      actor: "mivo",
      action: "refunded",
      note: "RM " + amount.toFixed(2) + " · Stripe " + refund.id,
    });
    await admin
      .from("orders")
      .update({ payment_status: "partially_refunded", refund_status: "partially_refunded", updated_at: now })
      .eq("id", order.id)
      .not("payment_status", "eq", "refunded");

    return NextResponse.json({ refundId: refund.id, amount });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Refund failed." },
      { status: 502 }
    );
  }
}
