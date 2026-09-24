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
  product_name: string;
  quantity: number;
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

function statusCopy(order: OrderRow) {
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
      text: "Your parcel has been received. You can now rate your order.",
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
        "id, order_number, status, payment_status, total_amount, created_at, shipping_address, order_items(id, product_name, quantity)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (orderError) throw orderError;

    setOrders((data as OrderRow[] | null) || []);
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
                const copy = statusCopy(order);
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
                          <div className="shopOrderItemImage">M</div>
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
