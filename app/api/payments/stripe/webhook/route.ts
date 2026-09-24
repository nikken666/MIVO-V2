import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  stripeRequest,
  verifyStripeWebhookSignature,
} from "@/lib/stripe/server";

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: Record<string, any>;
  };
};

async function paymentDetails(paymentIntentId: string) {
  const params = new URLSearchParams();
  params.append("expand[]", "latest_charge.balance_transaction");

  const intent = await stripeRequest<Record<string, any>>(
    "/payment_intents/" +
      encodeURIComponent(paymentIntentId) +
      "?" +
      params.toString()
  );

  const charge =
    intent.latest_charge && typeof intent.latest_charge === "object"
      ? intent.latest_charge
      : null;

  const balanceTransaction =
    charge?.balance_transaction &&
    typeof charge.balance_transaction === "object"
      ? charge.balance_transaction
      : null;

  return {
    feeAmount:
      typeof balanceTransaction?.fee === "number"
        ? balanceTransaction.fee / 100
        : 0,
    paymentMethod:
      typeof charge?.payment_method_details?.type === "string"
        ? charge.payment_method_details.type
        : null,
  };
}

async function markOrderPaid(session: Record<string, any>) {
  const admin = createAdminClient();
  const orderId =
    typeof session.metadata?.order_id === "string"
      ? session.metadata.order_id
      : session.client_reference_id;
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

  if (!orderId || !paymentIntentId) {
    throw new Error("Stripe session is missing order metadata.");
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, order_number, status, payment_status, total_amount")
    .eq("id", orderId)
    .maybeSingle();

  if (orderError || !order) {
    throw orderError || new Error("Order not found for Stripe payment.");
  }

  if (order.status === "cancelled") {
    throw new Error("Paid webhook received for a cancelled order.");
  }

  const details = await paymentDetails(paymentIntentId).catch(() => ({
    feeAmount: 0,
    paymentMethod: null,
  }));

  const amountPaid =
    typeof session.amount_total === "number"
      ? session.amount_total / 100
      : Number(order.total_amount);

  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("orders")
    .update({
      status: "paid",
      payment_status: "paid",
      payment_provider: "stripe",
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      stripe_payment_method: details.paymentMethod,
      payment_processing_fee_amount: details.feeAmount,
      payment_paid_amount: amountPaid,
      payment_currency:
        typeof session.currency === "string"
          ? session.currency.toUpperCase()
          : "MYR",
      paid_at: now,
      updated_at: now,
    })
    .eq("id", order.id);

  if (updateError) throw updateError;

  await admin
    .from("seller_orders")
    .update({
      status: "paid",
      updated_at: now,
    })
    .eq("order_id", order.id);

  await admin.from("payments").insert({
    order_id: order.id,
    provider: "stripe",
    provider_payment_id: paymentIntentId,
    provider_session_id: session.id,
    status: "paid",
    amount: amountPaid,
    currency:
      typeof session.currency === "string"
        ? session.currency.toUpperCase()
        : "MYR",
    payment_method: details.paymentMethod,
    raw_payload: session,
    paid_at: now,
    updated_at: now,
  });

  if (order.payment_status !== "paid") {
    await admin.from("order_status_history").insert({
      order_id: order.id,
      old_status: order.status,
      new_status: "paid",
      note: "Payment confirmed by Stripe",
      changed_by: null,
    });
  }
}

async function markPaymentFailed(session: Record<string, any>) {
  const admin = createAdminClient();
  const orderId =
    typeof session.metadata?.order_id === "string"
      ? session.metadata.order_id
      : session.client_reference_id;

  if (!orderId) return;

  await admin
    .from("orders")
    .update({
      payment_status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("status", "pending_payment");
}

async function applyRefundEvent(refund: Record<string, any>) {
  const admin = createAdminClient();

  const paymentIntentId =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : null;

  if (!paymentIntentId) return;

  const status =
    refund.status === "succeeded"
      ? "refunded"
      : refund.status === "failed"
        ? "failed"
        : "processing";

  const update: Record<string, any> = {
    refund_status: status,
    updated_at: new Date().toISOString(),
  };

  if (status === "refunded") {
    update.payment_status = "partially_refunded";
  }

  await admin
    .from("orders")
    .update(update)
    .eq("stripe_payment_intent_id", paymentIntentId);
}

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("stripe-signature") || "";

  if (!verifyStripeWebhookSignature(payload, signature)) {
    return NextResponse.json(
      { error: "Invalid Stripe signature." },
      { status: 400 }
    );
  }

  const event = JSON.parse(payload) as StripeEvent;
  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("payment_webhook_events")
    .select("id, processed_at")
    .eq("provider", "stripe")
    .eq("provider_event_id", event.id)
    .maybeSingle();

  if (existing?.processed_at) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (!existing) {
    const { error: insertError } = await admin
      .from("payment_webhook_events")
      .insert({
        provider: "stripe",
        provider_event_id: event.id,
        event_type: event.type,
        payload: event,
      });

    if (insertError && insertError.code !== "23505") {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }
  }

  try {
    const object = event.data.object;

    if (
      (event.type === "checkout.session.completed" &&
        object.payment_status === "paid") ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      await markOrderPaid(object);
    } else if (
      event.type === "checkout.session.async_payment_failed"
    ) {
      await markPaymentFailed(object);
    } else if (
      event.type === "refund.created" ||
      event.type === "refund.updated"
    ) {
      await applyRefundEvent(object);
    }

    await admin
      .from("payment_webhook_events")
      .update({
        processed_at: new Date().toISOString(),
        processing_error: null,
      })
      .eq("provider", "stripe")
      .eq("provider_event_id", event.id);

    return NextResponse.json({ received: true });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Webhook processing failed.";

    await admin
      .from("payment_webhook_events")
      .update({ processing_error: message })
      .eq("provider", "stripe")
      .eq("provider_event_id", event.id);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
