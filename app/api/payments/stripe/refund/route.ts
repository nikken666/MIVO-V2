import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripeRequest } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { releaseOrderPayment } from "@/lib/stripe/holds";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  stripe_payment_intent_id: string | null;
  stripe_refund_id: string | null;
  refund_status: string;
  cancellation_refund_amount: number | string | null;
};

type CancelResult = {
  refund_amount: number | string;
};

type StripeRefund = {
  id: string;
  status: string | null;
  amount: number;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in before cancelling an order." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      orderNumber?: string;
      reason?: string | null;
    };

    const orderNumber = String(body.orderNumber || "").trim();
    const reason =
      typeof body.reason === "string" ? body.reason.trim() : "";

    if (!orderNumber) {
      return NextResponse.json(
        { error: "Missing order number." },
        { status: 400 }
      );
    }

    const { data: initialOrder, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, total_amount, stripe_payment_intent_id, stripe_refund_id, refund_status, cancellation_refund_amount"
      )
      .eq("order_number", orderNumber)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError || !initialOrder) {
      return NextResponse.json(
        { error: orderError?.message || "Order not found." },
        { status: 404 }
      );
    }

    let order = initialOrder as OrderRow;

    if (order.status === "shipped" || order.status === "delivered") {
      return NextResponse.json(
        { error: "This order can no longer be cancelled." },
        { status: 409 }
      );
    }

    // Multi-shop orders: once any shop's parcel has shipped, the order as a
    // whole may still read "packed", but it can no longer be cancelled.
    // Checked even for "cancelled" orders, in case the cancel RPC was called directly.
    if (!order.stripe_refund_id) {
      const { data: parcels } = await supabase
        .from("seller_orders")
        .select("id, status")
        .eq("order_id", order.id);
      const parcelIds = (parcels || []).map((row) => row.id as string);
      const parcelShipped = (parcels || []).some((row) =>
        ["shipped", "delivered"].includes(String(row.status))
      );
      const { data: tracked } = parcelIds.length
        ? await supabase
            .from("shipments")
            .select("id")
            .in("seller_order_id", parcelIds)
            .not("tracking_number", "is", null)
            .limit(1)
        : { data: [] };

      if (parcelShipped || (tracked || []).length > 0) {
        return NextResponse.json(
          { error: "Part of this order has already shipped, so it can no longer be cancelled. Please contact MIVO support." },
          { status: 409 }
        );
      }
    }

    const paymentIntentId = order.stripe_payment_intent_id;

    if (!paymentIntentId) {
      return NextResponse.json(
        {
          error:
            "This payment is not linked to Stripe yet. Please contact MIVO support.",
        },
        { status: 409 }
      );
    }

    if (order.stripe_refund_id) {
      return NextResponse.json({
        refundId: order.stripe_refund_id,
        refundStatus: order.refund_status,
        refundAmount: Number(order.cancellation_refund_amount || 0),
      });
    }

    if (order.status !== "cancelled") {
      if (order.payment_status !== "paid") {
        return NextResponse.json(
          { error: "This order is not eligible for paid cancellation." },
          { status: 409 }
        );
      }

      const { data: cancelData, error: cancelError } = await supabase.rpc(
        "customer_cancel_paid_order",
        {
          p_order_number: orderNumber,
          p_reason: reason || null,
        }
      );

      if (cancelError) throw cancelError;

      const cancellation = cancelData as CancelResult;

      order = {
        ...order,
        status: "cancelled",
        refund_status: "pending",
        cancellation_refund_amount: cancellation.refund_amount,
      };
    }

    // Card still on hold (not charged yet): release it in full, no fees.
    {
      const admin = createAdminClient();
      const { data: hold } = await admin
        .from("orders")
        .select("payment_capture_status")
        .eq("id", order.id)
        .maybeSingle()
        .then((r) => r, () => ({ data: null }));
      if ((hold as { payment_capture_status?: string } | null)?.payment_capture_status === "authorized") {
        try {
          await releaseOrderPayment({ id: order.id, stripe_payment_intent_id: paymentIntentId });
        } catch (releaseError) {
          return NextResponse.json(
            {
              error: releaseError instanceof Error ? releaseError.message : "Unable to release the card hold.",
              refundPending: true,
            },
            { status: 502 }
          );
        }
        const total = Number(order.total_amount);
        const now = new Date().toISOString();
        const { error: releaseUpdateError } = await admin
          .from("orders")
          .update({
            payment_capture_status: "released",
            refund_status: "refunded",
            payment_status: "refunded",
            cancellation_refund_amount: total,
            cancellation_fee_total: 0,
            cancellation_platform_fee_amount: 0,
            cancellation_service_fee_amount: 0,
            payment_processing_fee_amount: 0,
            refunded_at: now,
            updated_at: now,
          })
          .eq("id", order.id);
        if (releaseUpdateError) throw releaseUpdateError;
        return NextResponse.json({ refundId: null, refundStatus: "refunded", refundAmount: total, released: true });
      }
    }

    const refundAmount = Number(order.cancellation_refund_amount || 0);
    const amount = Math.round(refundAmount * 100);

    if (!Number.isFinite(amount) || amount < 1) {
      return NextResponse.json(
        { error: "The calculated refund amount is invalid." },
        { status: 409 }
      );
    }

    const params = new URLSearchParams();
    params.set("payment_intent", paymentIntentId);
    params.set("amount", String(amount));
    params.set("metadata[order_id]", order.id);
    params.set("metadata[order_number]", order.order_number);
    params.set("metadata[reason]", reason || "Customer cancellation");

    let refund: StripeRefund;

    try {
      refund = await stripeRequest<StripeRefund>("/refunds", {
        method: "POST",
        body: params,
        idempotencyKey: "mivo-order-cancel-" + order.id,
      });
    } catch (stripeError) {
      return NextResponse.json(
        {
          error:
            stripeError instanceof Error
              ? stripeError.message
              : "Stripe refund failed.",
          refundPending: true,
        },
        { status: 502 }
      );
    }

    const refundStatus =
      refund.status === "succeeded"
        ? "refunded"
        : refund.status === "failed"
          ? "failed"
          : "processing";

    const paymentStatus =
      refund.status === "succeeded"
        ? refundAmount >= Number(order.total_amount)
          ? "refunded"
          : "partially_refunded"
        : order.payment_status;

    const update: Record<string, unknown> = {
      stripe_refund_id: refund.id,
      refund_status: refundStatus,
      payment_status: paymentStatus,
      updated_at: new Date().toISOString(),
    };

    if (refund.status === "succeeded") {
      update.refunded_at = new Date().toISOString();
    }

    const admin = createAdminClient();

    const { error: updateError } = await admin
      .from("orders")
      .update(update)
      .eq("id", order.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      refundId: refund.id,
      refundStatus,
      refundAmount,
    });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : "Unable to cancel and refund this order.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
