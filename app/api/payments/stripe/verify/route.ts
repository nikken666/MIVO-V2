import { NextRequest, NextResponse } from "next/server";
import { stripeRequest } from "@/lib/stripe/server";

type StripeCheckoutSession = {
  id: string;
  mode?: string;
  payment_status?: string;
  amount_total?: number | null;
  currency?: string | null;
  client_reference_id?: string | null;
  payment_intent?: string | { id?: string } | null;
  metadata?: Record<string, string> | null;
};

export async function GET(request: NextRequest) {
  try {
    const orderNumber = String(
      request.nextUrl.searchParams.get("orderNumber") || ""
    ).trim();
    const sessionId = String(
      request.nextUrl.searchParams.get("sessionId") || ""
    ).trim();

    if (
      !/^[A-Z0-9-]{6,40}$/.test(orderNumber) ||
      !/^cs_(?:test|live)_[A-Za-z0-9_]+$/.test(sessionId)
    ) {
      return NextResponse.json({ paid: false }, { status: 400 });
    }

    const session = await stripeRequest<StripeCheckoutSession>(
      "/checkout/sessions/" + encodeURIComponent(sessionId)
    );

    const metadataOrderNumber =
      typeof session.metadata?.order_number === "string"
        ? session.metadata.order_number
        : "";

    if (
      session.id !== sessionId ||
      session.mode !== "payment" ||
      metadataOrderNumber !== orderNumber
    ) {
      return NextResponse.json({ paid: false }, { status: 404 });
    }

    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || null;

    return NextResponse.json({
      paid: session.payment_status === "paid",
      orderNumber,
      sessionId: session.id,
      paymentIntentId,
      amountPaid:
        typeof session.amount_total === "number"
          ? session.amount_total / 100
          : null,
      currency:
        typeof session.currency === "string"
          ? session.currency.toUpperCase()
          : null,
    });
  } catch {
    return NextResponse.json({ paid: false }, { status: 404 });
  }
}
