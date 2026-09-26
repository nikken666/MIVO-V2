"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";

type ReceiptOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal: number | string;
  shipping_amount: number | string;
  discount_amount: number | string;
  tax_amount: number | string;
  total_amount: number | string;
  shipping_address: Record<string, string> | null;
  billing_address: Record<string, string> | null;
  created_at: string;
  paid_at: string | null;
  payment_provider: string | null;
  stripe_payment_method: string | null;
  payment_paid_amount: number | string | null;
  payment_currency: string | null;
  refund_status: string | null;
  cancellation_refund_amount: number | string | null;
};

type ReceiptItem = {
  id: string;
  product_name: string;
  variant_name: string | null;
  unit_price: number | string;
  quantity: number;
  line_subtotal: number | string;
};

type ShipmentInfo = {
  courier_name: string | null;
  tracking_number: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(value: string | null) {
  return (value || "—").replaceAll("_", " ").toUpperCase();
}

export default function OrderReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<ReceiptOrder | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [shipment, setShipment] = useState<ShipmentInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.replace(
            "/login?next=" +
              encodeURIComponent("/orders/" + orderNumber + "/receipt")
          );
          return;
        }

        const { data: orderData, error: orderError } = await supabase
          .from("orders")
          .select(
            "id, order_number, status, payment_status, currency, subtotal, shipping_amount, discount_amount, tax_amount, total_amount, shipping_address, billing_address, created_at, paid_at, payment_provider, stripe_payment_method, payment_paid_amount, payment_currency, refund_status, cancellation_refund_amount"
          )
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orderError || !orderData) {
          throw orderError || new Error("Receipt not found.");
        }

        if (orderData.payment_status !== "paid") {
          throw new Error("Receipt is available after payment is completed.");
        }

        const { data: itemData, error: itemError } = await supabase
          .from("order_items")
          .select(
            "id, product_name, variant_name, unit_price, quantity, line_subtotal"
          )
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: true });

        if (itemError) throw itemError;

        const { data: sellerOrderData } = await supabase
          .from("seller_orders")
          .select("id")
          .eq("order_id", orderData.id)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        let shipmentData: ShipmentInfo | null = null;

        if (sellerOrderData?.id) {
          const { data: foundShipment } = await supabase
            .from("shipments")
            .select("courier_name, tracking_number")
            .eq("seller_order_id", sellerOrderData.id)
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

          shipmentData = (foundShipment as ShipmentInfo | null) || null;
        }

        if (!active) return;

        setOrder(orderData as ReceiptOrder);
        setItems((itemData as ReceiptItem[] | null) || []);
        setShipment(shipmentData);
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Unable to open receipt."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [orderNumber, router]);

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">Loading receipt...</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>Unable to open receipt.</strong>
            <p>{error || "Receipt not found."}</p>
            <Link href={"/orders/" + encodeURIComponent(orderNumber)}>
              BACK TO ORDER →
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const address = order.billing_address || order.shipping_address || {};
  const paidAmount = Number(order.payment_paid_amount ?? order.total_amount);

  return (
    <main className="accountDataPage receiptPage">
      <div className="container">
        <div className="receiptToolbar receiptNoPrint">
          <Link href={"/orders/" + encodeURIComponent(order.order_number)}>
            ← ORDER DETAILS
          </Link>
          <button
            type="button"
            className="orderPrimaryButton"
            onClick={() => window.print()}
          >
            PRINT / SAVE PDF
          </button>
        </div>

        <section className="receiptSheet">
          <header className="receiptHeader">
            <div>
              <strong className="receiptBrand">MIVO</strong>
              <span>PREMIUM AUTOMOTIVE PARTS</span>
            </div>

            <div>
              <span>RECEIPT</span>
              <strong>{order.order_number}</strong>
            </div>
          </header>

          <div className="receiptMetaGrid">
            <div>
              <span>ORDER DATE</span>
              <strong>{formatDate(order.created_at)}</strong>
            </div>
            <div>
              <span>PAID DATE</span>
              <strong>{formatDate(order.paid_at)}</strong>
            </div>
            <div>
              <span>PAYMENT STATUS</span>
              <strong>{formatStatus(order.payment_status)}</strong>
            </div>
            <div>
              <span>PAYMENT METHOD</span>
              <strong>
                {formatStatus(
                  order.stripe_payment_method || order.payment_provider || "Stripe"
                )}
              </strong>
            </div>
          </div>

          <div className="receiptAddressBlock">
            <span>BILLED / DELIVERED TO</span>
            <strong>{address.full_name || "MIVO CUSTOMER"}</strong>
            <p>
              {address.phone ? <>{address.phone}<br /></> : null}
              {address.address_line_1}
              {address.address_line_2
                ? ", " + address.address_line_2
                : ""}
              <br />
              {address.postcode} {address.city}
              {address.state ? ", " + address.state : ""}
            </p>
          </div>

          <div className="receiptTable">
            <div className="receiptTableHead">
              <span>ITEM</span>
              <span>QTY</span>
              <span>UNIT PRICE</span>
              <span>AMOUNT</span>
            </div>

            {items.map((item) => (
              <div className="receiptTableRow" key={item.id}>
                <div>
                  <strong>{item.product_name}</strong>
                  {item.variant_name ? <small>{item.variant_name}</small> : null}
                </div>
                <span>{item.quantity}</span>
                <span>{formatPrice(Number(item.unit_price))}</span>
                <strong>{formatPrice(Number(item.line_subtotal))}</strong>
              </div>
            ))}
          </div>

          <div className="receiptBottomGrid">
            <div className="receiptShipment">
              <span>FULFILMENT</span>
              {shipment?.courier_name ? (
                <>
                  <strong>{shipment.courier_name}</strong>
                  {shipment.tracking_number ? (
                    <p>Tracking: {shipment.tracking_number}</p>
                  ) : null}
                </>
              ) : (
                <strong>Preparing shipment</strong>
              )}
            </div>

            <div className="receiptTotals">
              <div>
                <span>Subtotal</span>
                <strong>{formatPrice(Number(order.subtotal))}</strong>
              </div>
              <div>
                <span>Shipping</span>
                <strong>{formatPrice(Number(order.shipping_amount))}</strong>
              </div>
              {Number(order.discount_amount) > 0 ? (
                <div>
                  <span>Discount</span>
                  <strong>− {formatPrice(Number(order.discount_amount))}</strong>
                </div>
              ) : null}
              {Number(order.tax_amount) > 0 ? (
                <div>
                  <span>Tax</span>
                  <strong>{formatPrice(Number(order.tax_amount))}</strong>
                </div>
              ) : null}

              <div className="receiptGrandTotal">
                <span>TOTAL PAID</span>
                <strong>{formatPrice(paidAmount)}</strong>
              </div>
            </div>
          </div>

          {order.refund_status && order.refund_status !== "none" ? (
            <div className="receiptRefundNote">
              Refund status: {formatStatus(order.refund_status)}
              {Number(order.cancellation_refund_amount || 0) > 0
                ? " · " +
                  formatPrice(Number(order.cancellation_refund_amount || 0))
                : ""}
            </div>
          ) : null}

          <footer className="receiptFooter">
            <strong>THANK YOU FOR SHOPPING WITH MIVO.</strong>
            <span>
              This is a computer-generated receipt and does not require a
              signature.
            </span>
          </footer>
        </section>
      </div>
    </main>
  );
}
