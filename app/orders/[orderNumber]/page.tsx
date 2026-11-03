"use client";

import Link from "next/link";
import OrderJourney from "@/components/orders/OrderJourney";
import ParcelTracker from "@/components/orders/ParcelTracker";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import ChatNowButton from "@/components/chat/ChatNowButton";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import PaidCancellationModal from "@/components/PaidCancellationModal";
import UnpaidCancellationModal from "@/components/UnpaidCancellationModal";
import StripePayButton from "@/components/StripePayButton";
import { useT } from "@/components/LanguageProvider";
import type { Key, Translate } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number | string;
  shipping_amount: number | string;
  discount_amount: number | string;
  voucher_code: string | null;
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
  image_url?: string | null;
  warranty_months?: number | null;
  unit_price: number | string;
  quantity: number;
  line_subtotal: number | string;
};

type ShipmentInfo = {
  seller_order_id?: string;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
  shop_name?: string | null;
};

type OrderStatusHistoryRow = {
  id: string;
  new_status: string;
  note: string | null;
  created_at: string;
};


function progressForStatus(status: string) {
  if (status === "delivered") return 4;
  if (status === "shipped") return 3;
  if (status === "packed" || status === "processing") return 2;
  if (status === "paid") return 1;
  return 0;
}

function formatStatus(value: string, t: Translate) {
  const key = ("account.status." + value) as Key;
  const label = t(key);
  if (label !== key) return label;
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function OrderDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [shipments, setShipments] = useState<ShipmentInfo[]>([]);
  const [shopCount, setShopCount] = useState(1);
  const [orderShops, setOrderShops] = useState<Array<{ id: string; name: string }>>([]);
  const shipment = shipments[0] || null;
  const [statusHistory, setStatusHistory] = useState<OrderStatusHistoryRow[]>([]);
  const [reviewedAll, setReviewedAll] = useState(false);
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
        "id, order_number, status, payment_status, subtotal, shipping_amount, discount_amount, voucher_code, total_amount, shipping_address, customer_note, created_at, payment_processing_fee_amount, cancellation_platform_fee_amount, cancellation_service_fee_amount, cancellation_fee_total, cancellation_refund_amount, refund_status"
      )
      .eq("order_number", orderNumber)
      .eq("user_id", user.id)
      .maybeSingle();

    if (orderError || !orderData) {
      throw orderError || new Error(t("account.detail.notFound"));
    }

    const { data: itemData, error: itemError } = await supabase
      .from("order_items")
      .select(
        "id, product_id, product_name, variant_name, sku, warranty_months, unit_price, quantity, line_subtotal"
      )
      .eq("order_id", orderData.id)
      .order("created_at");

    if (itemError) throw itemError;

    // One seller order per shop; each shop ships its own parcel.
    const { data: sellerOrderData, error: sellerOrderError } = await supabase
      .from("seller_orders")
      .select("id, seller_id")
      .eq("order_id", orderData.id)
      .order("created_at", { ascending: true });

    if (sellerOrderError) throw sellerOrderError;

    const sellerOrderRows =
      (sellerOrderData as Array<{ id: string; seller_id: string | null }> | null) ||
      [];
    let shipmentData: ShipmentInfo[] = [];

    if (sellerOrderRows.length > 0) {
      const sellerIds = Array.from(
        new Set(
          sellerOrderRows
            .map((row) => row.seller_id)
            .filter((value): value is string => Boolean(value))
        )
      );
      const [shipmentResult, shopResult] = await Promise.all([
        supabase
          .from("shipments")
          .select("seller_order_id, courier_name, tracking_number, tracking_url, status")
          .in(
            "seller_order_id",
            sellerOrderRows.map((row) => row.id)
          )
          .order("created_at", { ascending: true }),
        sellerIds.length
          ? supabase.from("sellers").select("id, shop_name").in("id", sellerIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (shipmentResult.error) throw shipmentResult.error;

      const shopNames = new Map(
        (
          (shopResult.data as Array<{ id: string; shop_name: string }> | null) ||
          []
        ).map((row) => [row.id, row.shop_name])
      );
      const found = (shipmentResult.data as ShipmentInfo[] | null) || [];

      // First shipment per shop, in shop order.
      shipmentData = sellerOrderRows
        .map((row): ShipmentInfo | null => {
          const match = found.find((item) => item.seller_order_id === row.id);
          return match
            ? {
                ...match,
                shop_name: row.seller_id ? shopNames.get(row.seller_id) : null,
              }
            : null;
        })
        .filter((value): value is ShipmentInfo => Boolean(value));
    }

    const rawItems = (itemData as OrderItem[] | null) || [];
    const productIds = Array.from(
      new Set(
        rawItems
          .map((item) => item.product_id)
          .filter((value): value is string => Boolean(value))
      )
    );
    const productImageMap = new Map<string, string>();

    if (productIds.length > 0) {
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("id, primary_image_url")
        .in("id", productIds);

      if (productError) throw productError;

      (
        (productData as Array<{
          id: string;
          primary_image_url: string | null;
        }> | null) || []
      ).forEach((product) => {
        if (product.primary_image_url) {
          productImageMap.set(product.id, product.primary_image_url);
        }
      });

      const missingProductIds = productIds.filter(
        (productId) => !productImageMap.has(productId)
      );

      if (missingProductIds.length > 0) {
        const { data: imageData, error: imageError } = await supabase
          .from("product_images")
          .select("product_id, image_url, sort_order")
          .in("product_id", missingProductIds)
          .order("sort_order", { ascending: true });

        if (imageError) throw imageError;

        (
          (imageData as Array<{
            product_id: string;
            image_url: string;
            sort_order: number;
          }> | null) || []
        ).forEach((image) => {
          if (!productImageMap.has(image.product_id) && image.image_url) {
            productImageMap.set(image.product_id, image.image_url);
          }
        });
      }
    }

    const loadedItems = rawItems.map((item) => ({
      ...item,
      image_url: item.product_id
        ? productImageMap.get(item.product_id) || null
        : null,
    }));

    const { data: historyData, error: historyError } = await supabase
      .from("order_status_history")
      .select("id, new_status, note, created_at")
      .eq("order_id", orderData.id)
      .order("created_at", { ascending: true });

    if (historyError) throw historyError;

    let allReviewed = false;

    if (orderData.status === "delivered" && loadedItems.length > 0) {
      const { data: reviewData, error: reviewError } = await supabase
        .from("product_reviews")
        .select("order_item_id")
        .eq("order_id", orderData.id)
        .eq("user_id", user.id);

      if (reviewError) throw reviewError;

      const reviewedItemIds = new Set(
        ((reviewData as Array<{ order_item_id: string }> | null) || []).map(
          (review) => review.order_item_id
        )
      );

      allReviewed = loadedItems.every((item) =>
        reviewedItemIds.has(item.id)
      );
    }

    setOrder(orderData as OrderRow);
    setItems(loadedItems);
    setShipments(shipmentData);
    setShopCount(Math.max(sellerOrderRows.length, 1));
    {
      const ids = Array.from(
        new Set(sellerOrderRows.map((row) => row.seller_id).filter((v): v is string => Boolean(v)))
      );
      const { data: shopRows } = ids.length
        ? await supabase.from("sellers").select("id, shop_name").in("id", ids)
        : { data: [] };
      setOrderShops(
        ((shopRows || []) as Array<{ id: string; shop_name: string }>).map((row) => ({
          id: row.id,
          name: row.shop_name,
        }))
      );
    }
    setReviewedAll(allReviewed);
    setStatusHistory(
      (historyData as OrderStatusHistoryRow[] | null) || []
    );
  }

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        await load();
      } catch (caught) {
        if (!active) return;
        setError(
          friendlyError(caught, t, "account.detail.openError")
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
        friendlyError(caught, t, "account.orders.confirmError")
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <p className="accountDataNotice">{t("account.detail.loading")}</p>
        </div>
      </main>
    );
  }

  if (error || !order) {
    return (
      <main className="accountDataPage">
        <div className="container">
          <div className="ordersEmpty">
            <strong>{t("account.detail.openError")}</strong>
            <p>{error || t("account.detail.notFound")}</p>
            <Link href="/orders">{t("account.detail.backToOrders")}</Link>
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

  const timelineSteps = [
    {
      key: "placed",
      title: t("account.detail.placedTitle"),
      description: t("account.detail.placedText"),
      complete: progress >= 0,
      timestamp: order.created_at,
    },
    {
      key: "paid",
      title: t("account.detail.paidTitle"),
      description: t("account.detail.paidText"),
      complete: progress >= 1,
      timestamp:
        statusHistory.find((entry) => entry.new_status === "paid")
          ?.created_at || null,
    },
    {
      key: "packed",
      title: t("account.detail.packedTitle"),
      description: t("account.detail.packedText"),
      complete: progress >= 2,
      timestamp:
        statusHistory.find((entry) =>
          ["processing", "packed"].includes(entry.new_status)
        )?.created_at || null,
    },
    {
      key: "shipped",
      title: t("account.detail.shippedTitle"),
      description:
        shopCount > 1
          ? t("account.detail.parcelsShipped", {
              n: shipments.length,
              total: shopCount,
            })
          : shipment?.tracking_number
          ? (shipment.courier_name || t("account.detail.courier")) +
            " · " +
            shipment.tracking_number
          : t("account.detail.shippedText"),
      complete: progress >= 3,
      timestamp:
        statusHistory.find((entry) => entry.new_status === "shipped")
          ?.created_at || null,
    },
    {
      key: "delivered",
      title: t("account.detail.deliveredTitle"),
      description: t("account.detail.deliveredText"),
      complete: progress >= 4,
      timestamp:
        statusHistory.find((entry) => entry.new_status === "delivered")
          ?.created_at || null,
    },
  ];

  return (
    <main className="accountDataPage orderDetailPage">
      <div className="container">
        <div className="orderDetailTop">
          <div>
            <Link href="/orders">← {t("account.orders.title")}</Link>
            <span>{t("account.detail.orderNo", { n: order.order_number })}</span>
          </div>

          <div>
            <span>{t("account.detail.status")}</span>
            <strong>{formatStatus(order.status, t)}</strong>
          </div>
        </div>

        {!cancelled ? (
          <OrderJourney
            status={order.status}
            detail={
              order.status === "shipped" && shipment?.tracking_number
                ? (shipment.courier_name || t("account.detail.courier")) + " · " + shipment.tracking_number
                : null
            }
          />
        ) : (
          <section className="orderCancelledBanner">
            <strong>{formatStatus(order.status, t)}</strong>
            <span>
              {order.refund_status && order.refund_status !== "none"
                ? t("account.detail.refundStatusLine", {
                    status: formatStatus(order.refund_status, t),
                  })
                : t("account.orders.inactiveText")}
            </span>
          </section>
        )}

        {["shipped", "delivered", "completed"].includes(order.status) || shipments.some((row) => row.tracking_number) ? (
          <ParcelTracker
            orderNumber={order.order_number}
            shopNames={Object.fromEntries(
              shipments
                .filter((row) => row.seller_order_id)
                .map((row) => [row.seller_order_id as string, row.shop_name || ""])
            )}
          />
        ) : null}

        <div className="orderDetailLayout">
          <div className="orderDetailMainColumn">
            <section className="orderDetailMain">
              <div className="orderDetailSectionHead">
                <div>
                  <span>{t("account.detail.orderItems")}</span>
                  <h2>
                    {t("account.common.items", { n: items.length })}
                  </h2>
                </div>
              </div>

              <div className="orderDetailItems">
                {items.map((item) => (
                  <article className="orderDetailItem" key={item.id}>
                    <div className="orderDetailItemImage">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.product_name}
                        />
                      ) : (
                        <span>M</span>
                      )}
                    </div>

                    <div className="orderDetailItemInfo">
                      <strong>{item.product_name}</strong>
                      <span>{item.variant_name || t("account.common.defaultVariant")}</span>
                      <small>{t("account.common.qty", { n: item.quantity })}</small>
                    </div>

                    <div className="orderDetailItemPrice">
                      <span>{t("account.common.each", { price: formatPrice(Number(item.unit_price)) })}</span>
                      <strong>
                        {formatPrice(Number(item.line_subtotal))}
                      </strong>
                    </div>
                  </article>
                ))}
              </div>

              {order.customer_note ? (
                <div className="orderCustomerNote">
                  <span>{t("account.detail.orderNote")}</span>
                  <p>{order.customer_note}</p>
                </div>
              ) : null}
            </section>

            {!cancelled ? (
              <section className="orderTimelineCard">
                <div className="orderTimelineHead">
                  <div>
                    <span>{t("account.detail.shipmentUpdates")}</span>
                    <h2>{t("account.detail.timeline")}</h2>
                  </div>
                  {shopCount <= 1 && shipment?.courier_name ? (
                    <strong>{shipment.courier_name}</strong>
                  ) : null}
                </div>

                <div className="orderTimelineList">
                  {timelineSteps.map((step, index) => (
                    <div
                      className={
                        "orderTimelineItem" +
                        (step.complete ? " complete" : "")
                      }
                      key={step.key}
                    >
                      <div className="orderTimelineMarker">
                        <i>{step.complete ? "✓" : index + 1}</i>
                        {index < timelineSteps.length - 1 ? <span /> : null}
                      </div>

                      <div className="orderTimelineContent">
                        <div>
                          <strong>{step.title}</strong>
                          {step.timestamp ? (
                            <time>
                              {new Date(step.timestamp).toLocaleString(
                                intlTag(),
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                }
                              )}
                            </time>
                          ) : (
                            <time>{step.complete ? t("account.detail.stepDone") : t("account.detail.stepPending")}</time>
                          )}
                        </div>
                        <p>{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          <aside className="orderDetailSide">
            {orderShops.length ? (
              <section className="orderSideCard orderChatCard">
                <span>{t("account.detail.questions")}</span>
                {orderShops.map((shop) => (
                  <div className="orderChatRow" key={shop.id}>
                    <strong>{shop.name}</strong>
                    <ChatNowButton sellerId={shop.id} orderNumber={order.order_number} />
                  </div>
                ))}
              </section>
            ) : null}

            <section className="orderSideCard">
              <span>{t("account.detail.deliveryAddress")}</span>
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

            {shipments
              .filter((parcel) => parcel.tracking_number)
              .map((parcel, index) => (
                <section
                  className="orderSideCard"
                  key={parcel.seller_order_id || index}
                >
                  <span>
                    {shopCount > 1
                      ? t("account.detail.parcelN", { n: index + 1 }) +
                        (parcel.shop_name ? " · " + parcel.shop_name : "")
                      : t("account.detail.shipmentTracking")}
                  </span>
                  <div className="orderPaymentStatus">
                    <strong>{parcel.courier_name || t("account.detail.courier")}</strong>
                    <small>{formatStatus(parcel.status, t)}</small>
                  </div>

                  <div className="orderSideRows">
                    <div>
                      <span>{t("account.detail.trackingNumber")}</span>
                      <strong>{parcel.tracking_number}</strong>
                    </div>
                  </div>

                  {parcel.tracking_url ? (
                    <a
                      href={parcel.tracking_url}
                      target="_blank"
                      rel="noreferrer"
                      className="orderPrimaryButton orderSideMainAction"
                    >
                      {t("account.detail.trackParcel")}
                    </a>
                  ) : null}
                </section>
              ))}

            <section className="orderSideCard">
              <span>{t("account.detail.payment")}</span>
              <div className="orderPaymentStatus">
                <strong>{formatStatus(order.payment_status, t)}</strong>
                <small>{formatStatus(order.status, t)}</small>
              </div>

              <div className="orderSideRows">
                <div>
                  <span>{t("account.common.subtotal")}</span>
                  <strong>{formatPrice(Number(order.subtotal))}</strong>
                </div>
                <div>
                  <span>{t("account.common.shipping")}</span>
                  <strong>
                    {Number(order.shipping_amount) > 0
                      ? formatPrice(Number(order.shipping_amount))
                      : "—"}
                  </strong>
                </div>
                {Number(order.discount_amount || 0) > 0 ? (
                  <div>
                    <span>
                      {t("account.common.voucher")}{order.voucher_code ? " (" + order.voucher_code + ")" : ""}
                    </span>
                    <strong className="orderDiscountValue">
                      − {formatPrice(Number(order.discount_amount))}
                    </strong>
                  </div>
                ) : null}
              </div>

              <div className="orderSideTotal">
                <span>{t("account.common.total")}</span>
                <strong>{formatPrice(Number(order.total_amount))}</strong>
              </div>
            </section>

            {order.payment_status === "paid" ? (
              <Link
                href={
                  "/orders/" +
                  encodeURIComponent(order.order_number) +
                  "/receipt"
                }
                className="orderGhostButton orderSideMainAction"
              >
                {t("account.detail.viewReceipt")}
              </Link>
            ) : null}

            {order.status === "pending_payment" ? (
              <>
                <section className="orderCancellationNotice">
                  <span>{t("account.detail.deadline")}</span>
                  <strong>
                    {t("account.detail.deadlineTitle")}
                  </strong>
                  <p>
                    {t("account.detail.deadlineText")}
                  </p>
                </section>

                <button
                  type="button"
                  className="orderGhostButton orderSideMainAction orderCancelButton"
                  onClick={() => setShowUnpaidCancel(true)}
                >
                  {t("account.orders.cancelOrder")}
                </button>

                <StripePayButton
                  orderNumber={order.order_number}
                  className="orderPrimaryButton orderSideMainAction"
                  children={t("account.detail.payNow")}
                />
              </>
            ) : null}

            {order.payment_status === "paid" &&
            !cancelled &&
            order.status !== "shipped" &&
            order.status !== "delivered" &&
            // A multi-shop order with one parcel already on its way can't be cancelled.
            !shipments.some((parcel) => parcel.tracking_number) ? (
              <button
                type="button"
                className="orderGhostButton orderSideMainAction orderCancelButton"
                onClick={() => setShowPaidCancel(true)}
              >
                {t("account.orders.cancelOrder")}
              </button>
            ) : null}

            {order.status === "shipped" || order.status === "delivered" ? (
              <Link
                href={"/orders/" + encodeURIComponent(order.order_number) + "/return"}
                className="orderGhostButton orderSideMainAction"
              >
                {t("ret.request")}
              </Link>
            ) : null}

            {order.status === "shipped" ? (
              <button
                type="button"
                className="orderPrimaryButton orderSideMainAction"
                disabled={busy}
                onClick={confirmReceived}
              >
                {busy ? t("account.orders.confirming") : t("account.orders.orderReceived")}
              </button>
            ) : null}

            {order.status === "delivered" ? (
              reviewedAll ? (
                <button
                  type="button"
                  className="orderGhostButton orderSideMainAction"
                  disabled
                >
                  {t("account.orders.reviewed")}
                </button>
              ) : (
                <Link
                  href={
                    "/orders/" +
                    encodeURIComponent(order.order_number) +
                    "/review"
                  }
                  className="orderPrimaryButton orderSideMainAction"
                >
                  {t("account.orders.rateOrder")}
                </Link>
              )
            ) : null}

            {order.status === "delivered" &&
            items.some((item) => Number(item.warranty_months || 0) > 0) ? (
              <Link
                href={
                  "/orders/" +
                  encodeURIComponent(order.order_number) +
                  "/warranty"
                }
                className="orderGhostButton orderSideMainAction"
              >
                {t("account.detail.viewWarranty")}
              </Link>
            ) : null}

            {cancelled &&
            Number(order.cancellation_refund_amount || 0) > 0 ? (
              <section className="orderSideCard refundSummaryCard">
                <span>{t("account.detail.refundSummary")}</span>

                <div className="orderSideRows">
                  <div>
                    <span>{t("account.common.processingFee")}</span>
                    <strong>
                      − {formatPrice(
                        Number(order.payment_processing_fee_amount || 0)
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>{t("account.common.adminFee")}</span>
                    <strong>
                      − {formatPrice(
                        Number(order.cancellation_platform_fee_amount || 0)
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>{t("account.common.serviceFee")}</span>
                    <strong>
                      − {formatPrice(
                        Number(order.cancellation_service_fee_amount || 0)
                      )}
                    </strong>
                  </div>
                </div>

                <div className="orderSideTotal">
                  <span>{t("account.common.refundAmount")}</span>
                  <strong>
                    {formatPrice(
                      Number(order.cancellation_refund_amount || 0)
                    )}
                  </strong>
                </div>

                <p className="refundStatusText">
                  {t("account.detail.refundStatus")}{" "}
                  <strong>
                    {formatStatus(order.refund_status || "pending", t)}
                  </strong>
                </p>
              </section>
            ) : null}

            <Link href="/products" className="orderGhostButton orderSideMainAction">
              {t("account.common.continueShopping")}

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
