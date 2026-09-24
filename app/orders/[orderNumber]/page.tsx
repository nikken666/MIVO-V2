"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import PaidCancellationModal from "@/components/PaidCancellationModal";
import UnpaidCancellationModal from "@/components/UnpaidCancellationModal";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number | string;
  shipping_amount: number | string;
  total_amount: number | string;
  shipping_address: Record<string, string>;
  customer_note: string | null;
  created_at: string;
  payment_processing_fee_amount?: number | string;
  cancellation_platform_fee_amount?: number | string;
  cancellation_service_fee_amount?: number | string;
  cancellation_fee_total?: number | string;
  cancellation_refund_amount?: number | string | null;
  refund_status?: string;
};

type OrderItem = {
  id: string;
  product_id: string | null;
  product_name: string;
  variant_name: string | null;
  sku: string;
  unit_price: number | string;
  quantity: number;
  line_subtotal: number | string;
};

const steps = [
  { key: "placed", label: "ORDER PLACED" },
  { key: "paid", label: "PAID" },
  { key: "packed", label: "PACKED" },
  { key: "shipped", label: "SHIPPED" },
  { key: "delivered", label: "DELIVERED" },
];

function progressForStatus(status: string) {
  if (status === "delivered") return 4;
  if (status === "shipped") return 3;
  if (status === "packed" || status === "processing") return 2;
  if (status === "paid") return 1;
  return 0;
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showUnpaidCancel, setShowUnpaidCancel] = useState(false);
  const [showPaidCancel, setShowPaidCancel] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace(
        "/login?next=/orders/" + encodeURIComponent(orderNumber)
      );
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, subtotal, shipping_amount, total_amount, shipping_address, customer_note, created_at, payment_processing_fee_amount, cancellation_platform_fee_amount, cancellation_service_fee_amount, cancellation_fee_total, cancellation_refund_amount, refund_status"
      )
      .eq("order_number", orderNumber)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError || !orderData) {
      throw orderError || new Error("Order not found.");
    }

    const { data: itemData, error: itemError } = await supabase
      .from("order_items")
      .select(
        "id, product_id, product_name, variant_name, sku, unit_price, quantity, line_subtotal"
      )
      .eq("order_id", orderData.id)
      .order("created_at");

    if (itemError) throw itemError;

    setOrder(orderData as OrderRow);
    setItems((itemData as OrderItem[] | null) || []);
  }

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await load();
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Unable to open order."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void run();

    return () => {
      active = false;
    };
  }, [orderNumber, router]);

  const progress = useMemo(
    () => (order ? progressForStatus(order.status) : 0),
    [order]
  );

  async function confirmReceived() {
    if (!order) return;

    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: confirmError } = await supabase.rpc(
        "confirm_order_received",
        { p_order_number: order.order_number }
      );

      if (confirmError) throw confirmError;
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to confirm this order."
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">Loading order...</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>Unable to open order.</strong>
            <p>{error || "Order not found."}</p>
            <Link href="/orders">BACK TO MY ORDERS →</Link>
          </div>
        </div>
      </main>
    );
  }

  const address = order.shipping_address || {};
  const cancelled =
    order.status === "cancelled" ||
    order.status === "refunded" ||
    order.status === "partially_refunded";

  return (
    <main className="accountDataPage orderDetailPage">
      <div className="container">
        <div className="orderDetailTop">
          <div>
            <Link href="/orders">← MY ORDERS</Link>
            <span>ORDER {order.order_number}</span>
          </div>

          <div>
            <span>STATUS</span>
            <strong>{formatStatus(order.status)}</strong>
          </div>
        </div>

        {!cancelled ? (
          <section className="orderProgressCard">
            <div className="orderProgressLine" />
            {steps.map((step, index) => (
              <div
                className={
                  "orderProgressStep" +
                  (index <= progress ? " complete" : "")
                }
                key={step.key}
              >
                <i>{index <= progress ? "✓" : index + 1}</i>
                <span>{step.label}</span>
              </div>
            ))}
          </section>
        ) : (
          <section className="orderCancelledBanner">
            <strong>{formatStatus(order.status)}</strong>
            <span>
              {order.refund_status && order.refund_status !== "none"
                ? "Refund status: " + formatStatus(order.refund_status)
                : "This order is no longer in the active delivery flow."}
            </span>
          </section>
        )}

        <div className="orderDetailLayout">
          <section className="orderDetailMain">
            <div className="orderDetailSectionHead">
              <div>
                <span>ORDER ITEMS</span>
                <h2>
                  {items.length} item{items.length === 1 ? "" : "s"}
                </h2>
              </div>
            </div>

            <div className="orderDetailItems">
              {items.map((item) => (
                <article className="orderDetailItem" key={item.id}>
                  <div className="orderDetailItemImage">M</div>

                  <div className="orderDetailItemInfo">
                    <strong>{item.product_name}</strong>
                    <span>
                      {item.variant_name || "Default"} · SKU {item.sku}
                    </span>
                    <small>Qty {item.quantity}</small>
                  </div>

                  <div className="orderDetailItemPrice">
                    <span>{formatPrice(Number(item.unit_price))} each</span>
                    <strong>
                      {formatPrice(Number(item.line_subtotal))}
                    </strong>
                  </div>
                </article>
              ))}
            </div>

            {order.customer_note ? (
              <div className="orderCustomerNote">
                <span>ORDER NOTE</span>
                <p>{order.customer_note}</p>
              </div>
            ) : null}
          </section>

          <aside className="orderDetailSide">
            <section className="orderSideCard">
              <span>DELIVERY ADDRESS</span>
              <strong>{address.full_name}</strong>
              <p>
                {address.phone}
                <br />
                {address.address_line_1}
                {address.address_line_2
                  ? ", " + address.address_line_2
                  : ""}
                <br />
                {address.postcode} {address.city}, {address.state}
              </p>
            </section>

            <section className="orderSideCard">
              <span>PAYMENT</span>
              <div className="orderPaymentStatus">
                <strong>{formatStatus(order.payment_status)}</strong>
                <small>{formatStatus(order.status)}</small>
              </div>

              <div className="orderSideRows">
                <div>
                  <span>Subtotal</span>
                  <strong>{formatPrice(Number(order.subtotal))}</strong>
                </div>
                <div>
                  <span>Shipping</span>
                  <strong>
                    {Number(order.shipping_amount) > 0
                      ? formatPrice(Number(order.shipping_amount))
                      : "—"}
                  </strong>
                </div>
              </div>

              <div className="orderSideTotal">
                <span>TOTAL</span>
                <strong>{formatPrice(Number(order.total_amount))}</strong>
              </div>
            </section>

            {order.status === "pending_payment" ? (
              <>
                <section className="orderCancellationNotice">
                  <span>PAYMENT DEADLINE</span>
                  <strong>
                    Pay within 24 hours from order creation
                  </strong>
                  <p>
                    Unpaid orders are cancelled automatically and reserved stock
                    is released.
                  </p>
                </section>

                <button
                  type="button"
                  className="orderGhostButton orderSideMainAction orderCancelButton"
                  onClick={() => setShowUnpaidCancel(true)}
                >
                  CANCEL ORDER
                </button>

                <button
                  type="button"
                  className="orderPrimaryButton orderSideMainAction"
                  disabled
                >
                  PAYMENT GATEWAY COMING NEXT
                </button>
              </>
            ) : null}

            {order.payment_status === "paid" &&
            !cancelled &&
            order.status !== "shipped" &&
            order.status !== "delivered" ? (
              <button
                type="button"
                className="orderGhostButton orderSideMainAction orderCancelButton"
                onClick={() => setShowPaidCancel(true)}
              >
                CANCEL ORDER
              </button>
            ) : null}

            {order.status === "shipped" ? (
              <button
                type="button"
                className="orderPrimaryButton orderSideMainAction"
                disabled={busy}
                onClick={confirmReceived}
              >
                {busy ? "CONFIRMING..." : "ORDER RECEIVED"}
              </button>
            ) : null}

            {order.status === "delivered" ? (
              <Link
                href={
                  "/orders/" +
                  encodeURIComponent(order.order_number) +
                  "/review"
                }
                className="orderPrimaryButton orderSideMainAction"
              >
                RATE ORDER
              </Link>
            ) : null}

            {cancelled &&
            Number(order.cancellation_refund_amount || 0) > 0 ? (
              <section className="orderSideCard refundSummaryCard">
                <span>REFUND SUMMARY</span>

                <div className="orderSideRows">
                  <div>
                    <span>Payment processing fee</span>
                    <strong>
                      − {formatPrice(
                        Number(order.payment_processing_fee_amount || 0)
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Cancellation administration fee</span>
                    <strong>
                      − {formatPrice(
                        Number(order.cancellation_platform_fee_amount || 0)
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Service fee</span>
                    <strong>
                      − {formatPrice(
                        Number(order.cancellation_service_fee_amount || 0)
                      )}
                    </strong>
                  </div>
                </div>

                <div className="orderSideTotal">
                  <span>REFUND AMOUNT</span>
                  <strong>
                    {formatPrice(
                      Number(order.cancellation_refund_amount || 0)
                    )}
                  </strong>
                </div>

                <p className="refundStatusText">
                  Refund status:{" "}
                  <strong>
                    {formatStatus(order.refund_status || "pending")}
                  </strong>
                </p>
              </section>
            ) : null}

            <Link href="/products" className="orderGhostButton orderSideMainAction">
              CONTINUE SHOPPING
            </Link>
          </aside>
        </div>
      </div>

      {showUnpaidCancel ? (
        <UnpaidCancellationModal
          orderNumber={order.order_number}
          onClose={() => setShowUnpaidCancel(false)}
          onCancelled={load}
        />
      ) : null}

      {showPaidCancel ? (
        <PaidCancellationModal
          orderNumber={order.order_number}
          onClose={() => setShowPaidCancel(false)}
          onCancelled={load}
        />
      ) : null}
    </main>
  );
}
