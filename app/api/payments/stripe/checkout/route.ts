import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripeRequest } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  shipping_amount: number | string;
  currency: string;
  stripe_checkout_session_id: string | null;
};

type OrderItem = {
  product_name: string;
  variant_name: string | null;
  sku: string;
  unit_price: number | string;
  quantity: number;
};

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  expires_at?: number;
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Please sign in before payment." },
        { status: 401 }
      );
    }

    const body = (await request.json()) as { orderNumber?: string };
    const orderNumber = String(body.orderNumber || "").trim();

    if (!orderNumber) {
      return NextResponse.json(
        { error: "Missing order number." },
        { status: 400 }
      );
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, total_amount, shipping_amount, currency, stripe_checkout_session_id"
      )
      .eq("order_number", orderNumber)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError || !orderData) {
      return NextResponse.json(
        { error: orderError?.message || "Order not found." },
        { status: 404 }
      );
    }

    const order = orderData as OrderRow;

    if (order.status !== "pending_payment") {
      return NextResponse.json(
        { error: "This order is no longer waiting for payment." },
        { status: 409 }
      );
    }

    if (
      order.payment_status !== "pending" &&
      order.payment_status !== "failed"
    ) {
      return NextResponse.json(
        { error: "This order cannot be paid in its current state." },
        { status: 409 }
      );
    }

    const { data: itemData, error: itemError } = await supabase
      .from("order_items")
      .select(
        "product_name, variant_name, sku, unit_price, quantity"
      )
      .eq("order_id", order.id)
      .order("created_at");

    if (itemError) throw itemError;

    const items = (itemData as OrderItem[] | null) || [];

    if (!items.length) {
      return NextResponse.json(
        { error: "This order has no payable items." },
        { status: 409 }
      );
    }

    const origin =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
      request.nextUrl.origin;

    const params = new URLSearchParams();
    params.set("mode", "payment");
    params.set(
      "success_url",
      origin +
        "/orders/" +
        encodeURIComponent(order.order_number) +
        "/success?session_id={CHECKOUT_SESSION_ID}"
    );
    params.set(
      "cancel_url",
      origin +
        "/orders/" +
        encodeURIComponent(order.order_number) +
        "?payment=cancelled"
    );
    params.set("client_reference_id", order.id);
    params.set("locale", "auto");

    // Malaysia checkout methods.
    // Card also allows eligible Apple Pay / Google Pay wallets on Stripe Checkout.
    params.append("payment_method_types[]", "card");
    params.append("payment_method_types[]", "fpx");
    params.append("payment_method_types[]", "grabpay");

    if (user.email) {
      params.set("customer_email", user.email);
    }

    params.set("metadata[order_id]", order.id);
    params.set("metadata[order_number]", order.order_number);
    params.set("metadata[user_id]", user.id);
    params.set("payment_intent_data[metadata][order_id]", order.id);
    params.set(
      "payment_intent_data[metadata][order_number]",
      order.order_number
    );

    items.forEach((item, index) => {
      const unitAmount = Math.round(Number(item.unit_price) * 100);

      if (!Number.isFinite(unitAmount) || unitAmount < 1) {
        throw new Error("Invalid item price for " + item.sku + ".");
      }

      const name = item.variant_name
        ? item.product_name + " — " + item.variant_name
        : item.product_name;

      params.set(
        `line_items[${index}][price_data][currency]`,
        String(order.currency || "MYR").toLowerCase()
      );
      params.set(
        `line_items[${index}][price_data][product_data][name]`,
        name.slice(0, 250)
      );
      params.set(
        `line_items[${index}][price_data][product_data][metadata][sku]`,
        item.sku
      );
      params.set(
        `line_items[${index}][price_data][unit_amount]`,
        String(unitAmount)
      );
      params.set(
        `line_items[${index}][quantity]`,
        String(item.quantity)
      );
    });

    const shippingAmount = Math.round(
      Number(order.shipping_amount || 0) * 100
    );

    if (shippingAmount > 0) {
      const shippingIndex = items.length;

      params.set(
        `line_items[${shippingIndex}][price_data][currency]`,
        String(order.currency || "MYR").toLowerCase()
      );
      params.set(
        `line_items[${shippingIndex}][price_data][product_data][name]`,
        "Shipping"
      );
      params.set(
        `line_items[${shippingIndex}][price_data][unit_amount]`,
        String(shippingAmount)
      );
      params.set(
        `line_items[${shippingIndex}][quantity]`,
        "1"
      );
    }

    const expectedTotal = Math.round(Number(order.total_amount) * 100);
    const itemTotal = items.reduce(
      (sum, item) =>
        sum + Math.round(Number(item.unit_price) * 100) * item.quantity,
      0
    );
    const checkoutTotal = itemTotal + Math.max(0, shippingAmount);

    if (checkoutTotal !== expectedTotal) {
      throw new Error(
        "Payment total does not match the order total. Please refresh the order."
      );
    }

    const requestFingerprint = createHash("sha256")
      .update(params.toString())
      .digest("hex")
      .slice(0, 16);

    const session = await stripeRequest<StripeCheckoutSession>(
      "/checkout/sessions",
      {
        method: "POST",
        body: params,
        idempotencyKey:
          "mivo-checkout-" + order.id + "-" + requestFingerprint,
      }
    );

    if (!session.url) {
      throw new Error("Stripe did not return a checkout URL.");
    }

    const admin = createAdminClient();

    const { error: linkError } = await admin
      .from("orders")
      .update({
        payment_provider: "stripe",
        stripe_checkout_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (linkError) {
      console.error("MIVO Stripe checkout: unable to link session to order", {
        orderId: order.id,
        orderNumber: order.order_number,
        message: linkError.message,
        code: linkError.code,
      });
    }

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
      orderLinked: !linkError,
    });
  } catch (caught) {
    const message =
      caught instanceof Error ? caught.message : "Unable to start payment.";

    console.error("MIVO Stripe checkout failed", {
      message,
      caught,
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
