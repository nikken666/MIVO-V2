"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import PaidCancellationModal from "@/components/PaidCancellationModal";
import UnpaidCancellationModal from "@/components/UnpaidCancellationModal";
import StripePayButton from "@/components/StripePayButton";
import { useT } from "@/components/LanguageProvider";
import type { Key, Translate } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";

type OrderItemPreview = {
  id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  image_url?: string | null;
  warranty_months?: number | null;
};

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  created_at: string;
  shipping_address: Record<string, string> | null;
  order_items: OrderItemPreview[] | null;
};

type OrderTab =
  | "all"
  | "to_pay"
  | "to_ship"
  | "to_receive"
  | "completed"
  | "cancelled";

const tabs: Array<{ key: OrderTab; label: Key }> = [
  { key: "all", label: "account.orders.tabAll" },
  { key: "to_pay", label: "me.toPay" },
  { key: "to_ship", label: "me.toShip" },
  { key: "to_receive", label: "me.toReceive" },
  { key: "completed", label: "account.orders.tabCompleted" },
  { key: "cancelled", label: "account.orders.tabCancelled" },
];

function formatOrderStatus(value: string, t: Translate) {
  const key = ("account.status." + value) as Key;
  const label = t(key);
  if (label !== key) return label;
  const text = value.replaceAll("_", " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function orderBucket(order: OrderRow): Exclude<OrderTab, "all"> {
  if (
    order.status === "cancelled" ||
    order.status === "refunded" ||
    order.status === "partially_refunded"
  ) {
    return "cancelled";
  }

  if (order.status === "delivered") return "completed";
  if (order.status === "shipped") return "to_receive";

  if (
    order.status === "paid" ||
    order.status === "processing" ||
    order.status === "packed"
  ) {
    return "to_ship";
  }

  return "to_pay";
}

function statusCopy(order: OrderRow, t: Translate, reviewed = false) {
  const bucket = orderBucket(order);

  if (bucket === "to_pay") {
    return {
      title: t("account.orders.toPayTitle"),
      text: t("account.orders.toPayText"),
    };
  }

  if (bucket === "to_ship") {
    return {
      title:
        order.status === "packed"
          ? t("account.orders.packedTitle")
          : t("account.orders.preparingTitle"),
      text: t("account.orders.toShipText"),
    };
  }

  if (bucket === "to_receive") {
    return {
      title: t("account.orders.toReceiveTitle"),
      text: t("account.orders.toReceiveText"),
    };
  }

  if (bucket === "completed") {
    return {
      title: t("account.orders.completedTitle"),
      text: reviewed
        ? t("account.orders.completedReviewedText")
        : t("account.orders.completedText"),
    };
  }

  return {
    title: formatOrderStatus(order.status, t),
    text: t("account.orders.inactiveText"),
  };
}

export default function OrdersPage() {
  const router = useRouter();
  const t = useT();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<OrderTab>("all");

  // Deep links from the Me page: /orders?tab=to_ship
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (tabs.some((item) => item.key === requested)) {
      setActiveTab(requested as OrderTab);
    }
  }, []);
  const [loading, setLoading] = useState(true);
  const [busyOrder, setBusyOrder] = useState("");
  const [unpaidCancelOrder, setUnpaidCancelOrder] = useState("");
  const [paidCancelOrder, setPaidCancelOrder] = useState("");
  const [error, setError] = useState("");

  async function loadOrders() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login?next=/orders");
      return;
    }

    const { data, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, status, payment_status, total_amount, created_at, shipping_address, order_items(id, product_id, product_name, quantity, warranty_months)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (orderError) throw orderError;

    const loadedOrders = (data as OrderRow[] | null) || [];

    // Show the order list immediately. Product images and review status are
    // enrichment only and should never block order tracking.
    setOrders(loadedOrders);
    setLoading(false);

    const productIds = Array.from(
      new Set(
        loadedOrders
          .flatMap((order) => order.order_items || [])
          .map((item) => item.product_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const completedOrders = loadedOrders.filter(
      (order) => order.status === "delivered"
    );

    const enrichImages = async () => {
      if (productIds.length === 0) return;

      const productImageMap = new Map<string, string>();
      const { data: productData } = await supabase
        .from("products")
        .select("id, primary_image_url")
        .in("id", productIds);

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
        const { data: imageData } = await supabase
          .from("product_images")
          .select("product_id, image_url, sort_order")
          .in("product_id", missingProductIds)
          .order("sort_order", { ascending: true });

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

      setOrders((current) =>
        current.map((order) => ({
          ...order,
          order_items: (order.order_items || []).map((item) => ({
            ...item,
            image_url: item.product_id
              ? productImageMap.get(item.product_id) || item.image_url || null
              : null,
          })),
        }))
      );
    };

    const enrichReviews = async () => {
      const completedOrderIds = completedOrders.map((order) => order.id);
      if (completedOrderIds.length === 0) {
        setReviewedOrderIds([]);
        return;
      }

      const { data: reviewData } = await supabase
        .from("product_reviews")
        .select("order_id, order_item_id")
        .eq("user_id", user.id)
        .in("order_id", completedOrderIds);

      const reviewsByOrder = new Map<string, Set<string>>();
      (
        (reviewData as Array<{
          order_id: string;
          order_item_id: string;
        }> | null) || []
      ).forEach((review) => {
        const current =
          reviewsByOrder.get(review.order_id) || new Set<string>();
        current.add(review.order_item_id);
        reviewsByOrder.set(review.order_id, current);
      });

      const reviewedIds = completedOrders
        .filter((order) => {
          const itemIds = (order.order_items || []).map((item) => item.id);
          const reviewedItems = reviewsByOrder.get(order.id);
          return (
            itemIds.length > 0 &&
            reviewedItems &&
            itemIds.every((itemId) => reviewedItems.has(itemId))
          );
        })
        .map((order) => order.id);

      setReviewedOrderIds(reviewedIds);
    };

    void Promise.allSettled([enrichImages(), enrichReviews()]);
  }
  useEffect(() => {
    let active = true;

    async function load() {
      try {
        await loadOrders();
      } catch (caught) {
        if (!active) return;
        setError(
          friendlyError(caught, t, "account.orders.loadError")
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router]);

  const counts = useMemo(() => {
    const result: Record<OrderTab, number> = {
      all: orders.length,
      to_pay: 0,
      to_ship: 0,
      to_receive: 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      result[orderBucket(order)] += 1;
    });

    return result;
  }, [orders]);

  const visibleOrders = useMemo(
    () =>
      activeTab === "all"
        ? orders
        : orders.filter((order) => orderBucket(order) === activeTab),
    [activeTab, orders]
  );

  async function confirmReceived(orderNumber: string) {
    setBusyOrder(orderNumber);
    setError("");

    try {
      const supabase = createClient();
      const { error: confirmError } = await supabase.rpc(
        "confirm_order_received",
        { p_order_number: orderNumber }
      );

      if (confirmError) throw confirmError;
      await loadOrders();
      setActiveTab("completed");
    } catch (caught) {
      setError(
        friendlyError(caught, t, "account.orders.confirmError")
      );
    } finally {
      setBusyOrder("");
    }
  }

  return (
    <main className="accountDataPage orderCenterPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>{t("account.common.mivoAccount")}</span>
            <h1>{t("account.orders.title")}</h1>
            <p>{t("account.orders.subtitle")}</p>
          </div>

          <Link href="/account">← {t("account.common.backAccount")}</Link>
        </div>

        <section className="orderCenterPanel">
          <nav className="orderStatusTabs">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => setActiveTab(tab.key)}
              >
                <span>{t(tab.label)}</span>
                {counts[tab.key] > 0 ? <b>{counts[tab.key]}</b> : null}
              </button>
            ))}
          </nav>

          {error ? <p className="accountDataError">{error}</p> : null}

          {loading ? (
            <p className="accountDataNotice">{t("account.orders.loading")}</p>
          ) : visibleOrders.length === 0 ? (
            <div className="ordersEmpty">
              <strong>{t("account.orders.emptyTitle")}</strong>
              <p>{t("account.orders.emptyText")}</p>
              <Link href="/products">{t("account.orders.browseParts")}</Link>
            </div>
          ) : (
            <div className="shopOrderList">
              {visibleOrders.map((order) => {
                const bucket = orderBucket(order);
                const reviewed = reviewedOrderIds.includes(order.id);
                const copy = statusCopy(order, t, reviewed);
                const date = new Date(order.created_at);
                const items = order.order_items || [];
                const totalQty = items.reduce(
                  (sum, item) => sum + Number(item.quantity || 0),
                  0
                );

                return (
                  <article className="shopOrderCard" key={order.id}>
                    <div className="shopOrderHead">
                      <div>
                        <span>{t("account.orders.order")}</span>
                        <strong>{order.order_number}</strong>
                        <small>
                          {date.toLocaleDateString(intlTag(), {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </small>
                      </div>

                      <div className={"shopOrderStatus " + bucket}>
                        <span>{copy.title}</span>
                        <small>{copy.text}</small>
                      </div>
                    </div>

                    <div className="shopOrderItems">
                      {items.slice(0, 3).map((item) => (
                        <div className="shopOrderItem" key={item.id}>
                          <div className="shopOrderItemImage">
                            {item.image_url ? (
                              <img
                                src={item.image_url}
                                alt={item.product_name}
                              />
                            ) : (
                              <span>M</span>
                            )}
                          </div>
                          <div>
                            <strong>{item.product_name}</strong>
                            <span>{t("account.common.qty", { n: item.quantity })}</span>
                          </div>
                        </div>
                      ))}

                      {items.length > 3 ? (
                        <span className="shopOrderMore">
                          {t("account.orders.moreItems", { n: items.length - 3 })}
                        </span>
                      ) : null}
                    </div>

                    <div className="shopOrderFoot">
                      <div className="shopOrderTotal">
                        <span>
                          {t("account.common.items", { n: totalQty })}
                        </span>
                        <strong>{formatPrice(Number(order.total_amount))}</strong>
                      </div>

                      <div className="shopOrderActions">
                        <Link
                          href={
                            "/orders/" +
                            encodeURIComponent(order.order_number)
                          }
                          className="orderGhostButton"
                        >
                          {t("account.orders.viewOrder")}
                        </Link>

                        {bucket === "to_pay" ? (
                          <>
                            <button
                              type="button"
                              className="orderGhostButton orderCancelButton"
                              onClick={() =>
                                setUnpaidCancelOrder(order.order_number)
                              }
                            >
                              {t("account.orders.cancelOrder")}
                            </button>

                            <StripePayButton
                              orderNumber={order.order_number}
                            />
                          </>
                        ) : null}

                        {bucket === "to_ship" &&
                        order.status !== "shipped" ? (
                          <button
                            type="button"
                            className="orderGhostButton orderCancelButton"
                            onClick={() =>
                              setPaidCancelOrder(order.order_number)
                            }
                          >
                            {t("account.orders.cancelOrder")}
                          </button>
                        ) : null}

                        {bucket === "to_receive" ? (
                          <button
                            type="button"
                            className="orderPrimaryButton"
                            disabled={busyOrder === order.order_number}
                            onClick={() =>
                              confirmReceived(order.order_number)
                            }
                          >
                            {busyOrder === order.order_number
                              ? t("account.orders.confirming")
                              : t("account.orders.orderReceived")}
                          </button>
                        ) : null}

                        {bucket === "completed" ? (
                          reviewed ? (
                            <button
                              type="button"
                              className="orderGhostButton"
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
                              className="orderPrimaryButton"
                            >
                              {t("account.orders.rateOrder")}
                            </Link>
                          )
                        ) : null}

                        {bucket === "completed" &&
                        items.some(
                          (item) => Number(item.warranty_months || 0) > 0
                        ) ? (
                          <Link
                            href={
                              "/orders/" +
                              encodeURIComponent(order.order_number) +
                              "/warranty"
                            }
                            className="orderGhostButton"
                          >
                            {t("account.orders.warranty")}
                          </Link>

                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {unpaidCancelOrder ? (
        <UnpaidCancellationModal
          orderNumber={unpaidCancelOrder}
          onClose={() => setUnpaidCancelOrder("")}
          onCancelled={async () => {
            await loadOrders();
            setActiveTab("cancelled");
          }}
        />
      ) : null}

      {paidCancelOrder ? (
        <PaidCancellationModal
          orderNumber={paidCancelOrder}
          onClose={() => setPaidCancelOrder("")}
          onCancelled={async () => {
            await loadOrders();
            setActiveTab("cancelled");
          }}
        />
      ) : null}
    </main>
  );
}
