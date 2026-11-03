import { createAdminClient } from "@/lib/supabase/admin";
import { stripeRequest } from "@/lib/stripe/server";
import { captureOrderPayment } from "@/lib/stripe/holds";

type Refund = { id: string; status: string };

export class RefundError extends Error {
  constructor(message: string, public status = 409) {
    super(message);
  }
}

/**
 * Pays out an approved return (status "refunding") through Stripe.
 * Used by MIVO's refund button, the seller's "received in good order" and the
 * daily job that refunds automatically once the seller's 3-day inspection ends.
 * Safe to call twice: a request that already has a Stripe refund is skipped.
 */
export async function payReturnRefund(id: string) {
  const admin = createAdminClient();
  const { data: ret, error } = await admin
    .from("return_requests")
    .select("id, request_number, order_id, status, final_amount, requested_amount, stripe_refund_id")
    .eq("id", id)
    .maybeSingle();
  if (error || !ret) throw new RefundError("Return request not found.", 404);
  if (ret.stripe_refund_id) return { refundId: ret.stripe_refund_id as string, already: true, amount: Number(ret.final_amount) };
  if (ret.status !== "refunding") {
    throw new RefundError("Only approved requests can be refunded (now: " + ret.status + ").");
  }

  const amount = Number(ret.final_amount ?? ret.requested_amount);
  if (!Number.isFinite(amount) || amount <= 0) throw new RefundError("Refund amount is invalid.");

  const { data: order } = await admin
    .from("orders")
    .select("id, order_number, total_amount, stripe_payment_intent_id, cancellation_refund_amount")
    .eq("id", ret.order_id)
    .maybeSingle();
  if (!order?.stripe_payment_intent_id) {
    throw new RefundError("This order was not paid through Stripe; refund it manually.");
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
  const full = totalRefunded >= Number(order.total_amount) - 0.005;
  await admin
    .from("orders")
    .update({
      payment_status: full ? "refunded" : "partially_refunded",
      refund_status: full ? "refunded" : "partially_refunded",
      updated_at: now,
    })
    .eq("id", order.id);

  return { refundId: refund.id, status: refund.status, amount };
}
