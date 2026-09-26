"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import PaidCancellationModal from "@/components/PaidCancellationModal";
import UnpaidCancellationModal from "@/components/UnpaidCancellationModal";
import StripePayButton from "@/components/StripePayButton";

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

const tabs: Array<{ key: OrderTab; label: string }> = [
  { key: "all", label: "ALL" },
  { key: "to_pay", label: "TO PAY" },
  { key: "to_ship", label: "TO SHIP" },
  { key: "to_receive", label: "TO RECEIVE" },
  { key: "completed", label: "COMPLETED" },
  { key: "cancelled", label: "CANCELLED" },
];

function formatOrderStatus(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
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

function statusCopy(order: OrderRow, reviewed = false) {
  const bucket = orderBucket(order);

  if (bucket === "to_pay") {
    return {
      title: "Waiting for payment",
      text: "Pay within 24 hours. Unpaid orders are cancelled automatically.",
    };
  }

  if (bucket === "to_ship") {
    return {
      title:
        order.status === "packed"
          ? "Packed and ready to ship"
          : "Seller is preparing your order",
      text: "Your order is being prepared for shipment.",
    };
  }

  if (bucket === "to_receive") {
    return {
      title: "Parcel is on the way",
      text: "Confirm receipt after your parcel arrives.",
    };
  }

  if (bucket === "completed") {
    return {
      title: "Order completed",
      text: reviewed
        ? "Your parcel has been received and this order has been reviewed."
        : "Your parcel has been received. You can now rate your order.",
    };
  }

  return {
    title: formatOrderStatus(order.status),
    text: "This order is no longer in the active fulfilment flow.",
  };
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [reviewedOrderIds, setReviewedOrderIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<OrderTab>("all");
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

    let loadedOrders = (data as OrderRow[] | null) || [];

    const productIds = Array.from(
      new Set(
        loadedOrders
          .flatMap((order) => order.order_items || [])
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

    loadedOrders = loadedOrders.map((order) => ({
      ...order,
      order_items: (order.order_items || []).map((item) => ({
        ...item,
        image_url: item.product_id
          ? productImageMap.get(item.product_id) || null
          : null,
      })),
    }));

    const completedOrders = loadedOrders.filter(
      (order) => order.status === "delivered"
    );
    const completedOrderIds = completedOrders.map((order) => order.id);
    const reviewedIds: string[] = [];

    if (completedOrderIds.length > 0) {
      const { data: reviewData, error: reviewError } = await supabase
        .from("product_reviews")
        .select("order_id, order_item_id")
        .eq("user_id", user.id)
        .in("order_id", completedOrderIds);

      if (reviewError) throw reviewError;

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

      completedOrders.forEach((order) => {
        const itemIds = (order.order_items || []).map((item) => item.id);
        const reviewedItems = reviewsByOrder.get(order.id);

        if (
          itemIds.length > 0 &&
          reviewedItems &&
          itemIds.every((itemId) => reviewedItems.has(itemId))
        ) {
          reviewedIds.push(order.id);
        }
      });
    }

    setOrders(loadedOrders);
    setReviewedOrderIds(reviewedIds);
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        await loadOrders();
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error ? caught.message : "Unable to load orders."
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
        caught instanceof Error
          ? caught.message
          : "Unable to confirm this order."
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
            <span>MIVO ACCOUNT</span>
            <h1>My Orders</h1>
            <p>Track payment, fulfilment, delivery and completed orders.</p>
          </div>

          <Link href="/account">← ACCOUNT</Link>
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
                <span>{tab.label}</span>
                {counts[tab.key] > 0 ? <b>{counts[tab.key]}</b> : null}
              </button>
            ))}
          </nav>

          {error ? <p className="accountDataError">{error}</p> : null}

          {loading ? (
            <p className="accountDataNotice">Loading your orders...</p>
          ) : visibleOrders.length === 0 ? (
            <div className="ordersEmpty">
              <strong>No orders here yet.</strong>
              <p>Your orders will move between these tabs automatically.</p>
              <Link href="/products">BROWSE PARTS →</Link>
            </div>
          ) : (
            <div className="shopOrderList">
              {visibleOrders.map((order) => {
                const bucket = orderBucket(order);
                const reviewed = reviewedOrderIds.includes(order.id);
                const copy = statusCopy(order, reviewed);
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
                        <span>ORDER</span>
                        <strong>{order.order_number}</strong>
                        <small>
                          {date.toLocaleDateString("en-MY", {
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
                            <span>Qty {item.quantity}</span>
                          </div>
                        </div>
                      ))}

                      {items.length > 3 ? (
                        <span className="shopOrderMore">
                          +{items.length - 3} more item
                          {items.length - 3 === 1 ? "" : "s"}
                        </span>
                      ) : null}
                    </div>

                    <div className="shopOrderFoot">
                      <div className="shopOrderTotal">
                        <span>
                          {totalQty} ITEM{totalQty === 1 ? "" : "S"}
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
                          VIEW ORDER
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
                              CANCEL ORDER
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
                            CANCEL ORDER
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
                              ? "CONFIRMING..."
                              : "ORDER RECEIVED"}
                          </button>
                        ) : null}

                        {bucket === "completed" ? (
                          reviewed ? (
                            <button
                              type="button"
                              className="orderGhostButton"
                              disabled
                            >
                              REVIEWED
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
                              RATE ORDER
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
                            WARRANTY
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
