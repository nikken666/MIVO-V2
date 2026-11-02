"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "@/components/LanguageProvider";
import type { Key, Translate } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";

type ReceiptOrder = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal: number | string;
  shipping_amount: number | string;
  discount_amount: number | string;
  voucher_code: string | null;
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

  return new Date(value).toLocaleString(intlTag(), {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatus(value: string | null, t: Translate) {
  if (!value) return "—";
  const key = ("account.status." + value) as Key;
  const label = t(key);
  if (label !== key) return label;
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatMethod(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export default function OrderReceiptPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
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
            "id, order_number, status, payment_status, currency, subtotal, shipping_amount, discount_amount, voucher_code, tax_amount, total_amount, shipping_address, billing_address, created_at, paid_at, payment_provider, stripe_payment_method, payment_paid_amount, payment_currency, refund_status, cancellation_refund_amount"
          )
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();

        if (orderError || !orderData) {
          throw orderError || new Error(t("account.receipt.notFound"));
        }

        if (orderData.payment_status !== "paid") {
          throw new Error(t("account.receipt.notPaid"));
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
          friendlyError(caught, t, "account.receipt.openError")
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
          <p className="accountDataNotice">{t("account.receipt.loading")}</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>{t("account.receipt.openError")}</strong>
            <p>{error || t("account.receipt.notFound")}</p>
            <Link href={"/orders/" + encodeURIComponent(orderNumber)}>
              {t("account.receipt.backToOrder")} →
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
            ← {t("account.receipt.orderDetails")}
          </Link>
          <button
            type="button"
            className="orderPrimaryButton"
            onClick={() => window.print()}
          >
            {t("account.receipt.print")}
          </button>
        </div>

        <section className="receiptSheet">
          <header className="receiptHeader">
            <div>
              <strong className="receiptBrand">MIVO</strong>
              <span>{t("account.receipt.tagline")}</span>
            </div>

            <div>
              <span>{t("account.success.receipt")}</span>
              <strong>{order.order_number}</strong>
            </div>
          </header>

          <div className="receiptMetaGrid">
            <div>
              <span>{t("account.receipt.orderDate")}</span>
              <strong>{formatDate(order.created_at)}</strong>
            </div>
            <div>
              <span>{t("account.receipt.paidDate")}</span>
              <strong>{formatDate(order.paid_at)}</strong>
            </div>
            <div>
              <span>{t("account.receipt.paymentStatus")}</span>
              <strong>{formatStatus(order.payment_status, t)}</strong>
            </div>
            <div>
              <span>{t("account.receipt.paymentMethod")}</span>
              <strong>
                {formatMethod(
                  order.stripe_payment_method || order.payment_provider || "Stripe"
                )}
              </strong>
            </div>
          </div>

          <div className="receiptAddressBlock">
            <span>{t("account.receipt.billedTo")}</span>
            <strong>{address.full_name || t("account.receipt.customer")}</strong>
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
              <span>{t("account.receipt.item")}</span>
              <span>{t("account.receipt.qty")}</span>
              <span>{t("account.receipt.unitPrice")}</span>
              <span>{t("account.receipt.amount")}</span>
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
              <span>{t("account.receipt.fulfilment")}</span>
              {shipment?.courier_name ? (
                <>
                  <strong>{shipment.courier_name}</strong>
                  {shipment.tracking_number ? (
                    <p>{t("account.receipt.tracking", { n: shipment.tracking_number })}</p>
                  ) : null}
                </>
              ) : (
                <strong>{t("account.receipt.preparing")}</strong>
              )}
            </div>

            <div className="receiptTotals">
              <div>
                <span>{t("account.common.subtotal")}</span>
                <strong>{formatPrice(Number(order.subtotal))}</strong>
              </div>
              <div>
                <span>{t("account.common.shipping")}</span>
                <strong>{formatPrice(Number(order.shipping_amount))}</strong>
              </div>
              {Number(order.discount_amount) > 0 ? (
                <div>
                  <span>
                    {t("account.receipt.discount")}{order.voucher_code ? " (" + order.voucher_code + ")" : ""}
                  </span>
                  <strong>− {formatPrice(Number(order.discount_amount))}</strong>
                </div>
              ) : null}
              {Number(order.tax_amount) > 0 ? (
                <div>
                  <span>{t("account.receipt.tax")}</span>
                  <strong>{formatPrice(Number(order.tax_amount))}</strong>
                </div>
              ) : null}

              <div className="receiptGrandTotal">
                <span>{t("account.receipt.totalPaid")}</span>
                <strong>{formatPrice(paidAmount)}</strong>
              </div>
            </div>
          </div>

          {order.refund_status && order.refund_status !== "none" ? (
            <div className="receiptRefundNote">
              {t("account.detail.refundStatusLine", { status: formatStatus(order.refund_status, t) })}
              {Number(order.cancellation_refund_amount || 0) > 0
                ? " · " +
                  formatPrice(Number(order.cancellation_refund_amount || 0))
                : ""}
            </div>
          ) : null}

          <footer className="receiptFooter">
            <strong>{t("account.receipt.thanks")}</strong>
            <span>
              {t("account.receipt.computerGenerated")}
            </span>

          </footer>
        </section>
      </div>
    </main>
  );
}
