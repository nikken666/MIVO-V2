import { createAdminClient } from "@/lib/supabase/admin";
import { stripeRequest } from "@/lib/stripe/server";

// Card holds: authorised at checkout, captured at shipping, released on
// cancellation. Stripe keeps an online card authorisation for about 7 days,
// so holds are captured automatically before that (see /api/cron/capture-holds).

export const HOLD_DAYS = 6;

type Intent = {
  id: string;
  status: string;
  amount_capturable?: number;
  amount_received?: number;
};

/** True when the orders table has the hold columns (supabase/payment-holds.sql). */
export async function holdsEnabled(): Promise<boolean> {
  try {
    const admin = createAdminClient();
    const { error } = await admin.from("orders").select("payment_capture_status").limit(1);
    return !error;
  } catch {
    return false;
  }
}

export async function getIntent(id: string) {
  return stripeRequest<Intent>("/payment_intents/" + encodeURIComponent(id));
}

async function captureFee(intentId: string) {
  const params = new URLSearchParams();
  params.append("expand[]", "latest_charge.balance_transaction");
  const intent = await stripeRequest<Record<string, any>>(
    "/payment_intents/" + encodeURIComponent(intentId) + "?" + params.toString()
  );
  const fee = intent.latest_charge?.balance_transaction?.fee;
  return typeof fee === "number" ? fee / 100 : null;
}

/** Captures a held card payment. Safe to call twice; no-op when not held. */
export async function captureOrderPayment(orderId: string): Promise<"captured" | "not-held"> {
  const admin = createAdminClient();
  const { data: order, error } = await admin
    .from("orders")
    .select("id, order_number, status, stripe_payment_intent_id, payment_capture_status")
    .eq("id", orderId)
    .maybeSingle();
  if (error || !order) throw error || new Error("Order not found.");
  if (order.payment_capture_status !== "authorized" || !order.stripe_payment_intent_id) return "not-held";
  if (["cancelled", "refunded"].includes(order.status)) throw new Error("Order is cancelled.");

  const intent = await getIntent(order.stripe_payment_intent_id);
  if (intent.status === "requires_capture") {
    await stripeRequest("/payment_intents/" + encodeURIComponent(intent.id) + "/capture", {
      method: "POST",
      body: new URLSearchParams(),
      idempotencyKey: "mivo-capture-" + order.id,
    });
  } else if (intent.status !== "succeeded") {
    throw new Error("The card hold for " + order.order_number + " is no longer valid (" + intent.status + ").");
  }

  const fee = await captureFee(intent.id).catch(() => null);
  const update: Record<string, unknown> = {
    payment_capture_status: "captured",
    payment_captured_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (fee !== null) update.payment_processing_fee_amount = fee;
  await admin.from("orders").update(update).eq("id", order.id);
  return "captured";
}

/** Releases a held card payment (nothing is charged). */
export async function releaseOrderPayment(order: { id: string; stripe_payment_intent_id: string }) {
  const intent = await getIntent(order.stripe_payment_intent_id);
  if (intent.status === "requires_capture") {
    const body = new URLSearchParams();
    body.set("cancellation_reason", "requested_by_customer");
    await stripeRequest("/payment_intents/" + encodeURIComponent(intent.id) + "/cancel", {
      method: "POST",
      body,
      idempotencyKey: "mivo-release-" + order.id,
    });
  } else if (intent.status !== "canceled") {
    throw new Error("Payment is not on hold any more.");
  }
}
