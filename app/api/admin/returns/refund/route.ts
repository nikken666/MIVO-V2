import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { stripeRequest } from "@/lib/stripe/server";
import { captureOrderPayment } from "@/lib/stripe/holds";

type Refund = { id: string; status: string };

/** Admin: pay out an approved return (status "refunding") through Stripe. */
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
    if (!id) return NextResponse.json({ error: "Missing request id." }, { status: 400 });

    const admin = createAdminClient();
    const { data: ret, error } = await admin
      .from("return_requests")
      .select("id, request_number, order_id, status, final_amount, requested_amount, stripe_refund_id")
      .eq("id", id)
      .maybeSingle();
    if (error || !ret) return NextResponse.json({ error: "Return request not found." }, { status: 404 });
    if (ret.stripe_refund_id) return NextResponse.json({ refundId: ret.stripe_refund_id, already: true });
    if (ret.status !== "refunding") {
      return NextResponse.json({ error: "Only approved requests can be refunded (now: " + ret.status + ")." }, { status: 409 });
    }

    const amount = Number(ret.final_amount ?? ret.requested_amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Refund amount is invalid." }, { status: 409 });
    }

    const { data: order } = await admin
      .from("orders")
      .select("id, order_number, total_amount, stripe_payment_intent_id, cancellation_refund_amount")
      .eq("id", ret.order_id)
      .maybeSingle();
    if (!order?.stripe_payment_intent_id) {
      return NextResponse.json({ error: "This order was not paid through Stripe; refund it manually." }, { status: 409 });
    }

    // A card still on hold must be charged before part of it can be refunded.
    await captureOrderPayment(order.id).catch(() => undefined);

    const params = new URLSearchParams();
    params.set("payment_intent", order.stripe_payment_intent_id);
    params.set("amount", String(Math.round(amount * 100)));
    params.set("metadata[order_number]", order.order_number);
    params.set("metadata[return_request]", ret.request_number);
    const refund = await stripeRequest<Refund>("/refunds", {
      method: "POST",
      body: params,
      idempotencyKey: "mivo-return-" + ret.id,
    });

    const now = new Date().toISOString();
    await admin
      .from("return_requests")
      .update({ status: "refunded", stripe_refund_id: refund.id, refunded_at: now, final_amount: amount, updated_at: now })
      .eq("id", ret.id);
    await admin.from("return_request_events").insert({
      request_id: ret.id,
      actor: "mivo",
      action: "refunded",
      note: "Stripe " + refund.id,
      amount,
    });

    // Order-level payment status.
    const { data: refunded } = await admin
      .from("return_requests")
      .select("final_amount")
      .eq("order_id", order.id)
      .eq("status", "refunded");
    const totalRefunded =
      ((refunded || []) as Array<{ final_amount: number | string }>).reduce((s, r) => s + Number(r.final_amount || 0), 0) +
      Number(order.cancellation_refund_amount || 0);
    await admin
      .from("orders")
      .update({
        payment_status: totalRefunded >= Number(order.total_amount) - 0.005 ? "refunded" : "partially_refunded",
        updated_at: now,
      })
      .eq("id", order.id);

    return NextResponse.json({ refundId: refund.id, status: refund.status, amount });
  } catch (caught) {
    return NextResponse.json(
      { error: caught instanceof Error ? caught.message : "Refund failed." },
      { status: 502 }
    );
  }
}
