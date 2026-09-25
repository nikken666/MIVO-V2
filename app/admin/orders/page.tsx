"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";

type OrderItemRow = {
  id: string;
  order_id: string;
  product_name: string;
  variant_name: string | null;
  sku: string;
  quantity: number;
  unit_price: number | string;
  line_subtotal: number | string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
};

type ShipmentRow = {
  id: string;
  seller_order_id: string;
  courier_name: string | null;
  tracking_number: string | null;
  tracking_url: string | null;
  status: string;
};

type SellerOrderRow = {
  id: string;
  order_id: string;
};

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  subtotal: number | string;
  shipping_amount: number | string;
  shipping_address: Record<string, string> | null;
  customer_note: string | null;
  created_at: string;
  paid_at: string | null;
  refund_status: string | null;
  cancellation_refund_amount: number | string | null;
};

type OrderView = OrderRow & {
  items: OrderItemRow[];
  customer?: ProfileRow;
  shipment?: ShipmentRow;
};

type TabKey =
  | "all"
  | "to_pay"
  | "to_ship"
  | "shipped"
  | "completed"
  | "cancelled";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "ALL" },
  { key: "to_pay", label: "TO PAY" },
  { key: "to_ship", label: "TO SHIP" },
  { key: "shipped", label: "SHIPPED" },
  { key: "completed", label: "COMPLETED" },
  { key: "cancelled", label: "CANCELLED / REFUND" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function label(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

function bucket(order: OrderView): Exclude<TabKey, "all"> {
  if (
    ["cancelled", "refunded", "partially_refunded"].includes(order.status)
  ) {
    return "cancelled";
  }

  if (order.status === "delivered") return "completed";
  if (order.status === "shipped") return "shipped";
  if (["paid", "processing", "packed"].includes(order.status)) {
    return "to_ship";
  }

  return "to_pay";
}

function customerName(order: OrderView) {
  return (
    order.customer?.full_name ||
    order.shipping_address?.full_name ||
    order.customer?.email ||
    "MIVO CUSTOMER"
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadOrders() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login?next=/admin/orders";
      return;
    }

    const { data: isAdmin, error: adminError } = await supabase.rpc(
      "is_admin"
    );

    if (adminError) throw adminError;

    if (!isAdmin) {
      window.location.href = "/";
      return;
    }

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        "id, order_number, user_id, status, payment_status, total_amount, subtotal, shipping_amount, shipping_address, customer_note, created_at, paid_at, refund_status, cancellation_refund_amount"
      )
      .order("created_at", { ascending: false });

    if (orderError) throw orderError;

    const baseOrders = (orderData as OrderRow[] | null) || [];
    const orderIds = baseOrders.map((order) => order.id);
    const userIds = Array.from(
      new Set(baseOrders.map((order) => order.user_id).filter(Boolean))
    );

    const [profileResult, itemResult, sellerOrderResult] =
      await Promise.all([
        userIds.length
          ? supabase
              .from("profiles")
              .select("id, full_name, email, phone")
              .in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("order_items")
              .select(
                "id, order_id, product_name, variant_name, sku, quantity, unit_price, line_subtotal"
              )
              .in("order_id", orderIds)
              .order("created_at")
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("seller_orders")
              .select("id, order_id")
              .in("order_id", orderIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (
      profileResult.error ||
      itemResult.error ||
      sellerOrderResult.error
    ) {
      throw (
        profileResult.error ||
        itemResult.error ||
        sellerOrderResult.error
      );
    }

    const sellerOrders =
      (sellerOrderResult.data as SellerOrderRow[] | null) || [];
    const sellerOrderIds = sellerOrders.map((row) => row.id);

    const shipmentResult = sellerOrderIds.length
      ? await supabase
          .from("shipments")
          .select(
            "id, seller_order_id, courier_name, tracking_number, tracking_url, status"
          )
          .in("seller_order_id", sellerOrderIds)
      : { data: [], error: null };

    if (shipmentResult.error) throw shipmentResult.error;

    const profiles = new Map(
      ((profileResult.data as ProfileRow[] | null) || []).map((row) => [
        row.id,
        row,
      ])
    );

    const itemsByOrder = new Map<string, OrderItemRow[]>();
    ((itemResult.data as OrderItemRow[] | null) || []).forEach((item) => {
      const rows = itemsByOrder.get(item.order_id) || [];
      rows.push(item);
      itemsByOrder.set(item.order_id, rows);
    });

    const sellerOrderByOrder = new Map(
      sellerOrders.map((row) => [row.order_id, row.id])
    );

    const shipmentBySellerOrder = new Map(
      ((shipmentResult.data as ShipmentRow[] | null) || []).map((row) => [
        row.seller_order_id,
        row,
      ])
    );

    const nextOrders = baseOrders.map((order) => {
      const sellerOrderId = sellerOrderByOrder.get(order.id);

      return {
        ...order,
        items: itemsByOrder.get(order.id) || [],
        customer: profiles.get(order.user_id),
        shipment: sellerOrderId
          ? shipmentBySellerOrder.get(sellerOrderId)
          : undefined,
      };
    });

    setOrders(nextOrders);

    const requestedOrder =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("order")
        : null;

    if (
      requestedOrder &&
      nextOrders.some((order) => order.order_number === requestedOrder)
    ) {
      setSelected(requestedOrder);
    }
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        await loadOrders();
      } catch (caught) {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load admin orders."
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const counts = useMemo(() => {
    const result: Record<TabKey, number> = {
      all: orders.length,
      to_pay: 0,
      to_ship: 0,
      shipped: 0,
      completed: 0,
      cancelled: 0,
    };

    orders.forEach((order) => {
      result[bucket(order)] += 1;
    });

    return result;
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orders.filter((order) => {
      const tabMatch = tab === "all" || bucket(order) === tab;
      const searchMatch =
        !q ||
        [
          order.order_number,
          customerName(order),
          order.customer?.email || "",
          order.shipping_address?.phone || "",
          ...order.items.map((item) => item.sku),
          ...order.items.map((item) => item.product_name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      return tabMatch && searchMatch;
    });
  }, [orders, query, tab]);

  const selectedOrder =
    orders.find((order) => order.order_number === selected) || null;

  useEffect(() => {
    if (!selectedOrder) return;
    setCourier(selectedOrder.shipment?.courier_name || "");
    setTracking(selectedOrder.shipment?.tracking_number || "");
    setTrackingUrl(selectedOrder.shipment?.tracking_url || "");
  }, [selectedOrder?.order_number]);

  async function updateStatus(
    order: OrderView,
    nextStatus: "processing" | "packed" | "shipped" | "delivered"
  ) {
    setBusy(order.order_number);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.rpc(
        "admin_update_order_fulfilment",
        {
          p_order_number: order.order_number,
          p_status: nextStatus,
          p_courier_name:
            nextStatus === "shipped" ? courier.trim() || null : null,
          p_tracking_number:
            nextStatus === "shipped" ? tracking.trim() || null : null,
          p_tracking_url:
            nextStatus === "shipped"
              ? trackingUrl.trim() || null
              : null,
        }
      );

      if (updateError) throw updateError;

      await loadOrders();
      setMessage(
        order.order_number + " updated to " + label(nextStatus) + "."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update order."
      );
    } finally {
      setBusy("");
    }
  }

  function openOrder(order: OrderView) {
    setSelected(order.order_number);
    setMessage("");
    setError("");
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <aside className={styles.adminSidebar}>
          <Link href="/admin" className={styles.adminBrand}>
            <span>MIVO</span>
            <small>STORE CONTROL</small>
          </Link>

          <nav className={styles.adminSideNav}>
            <Link href="/admin">
              <span>01</span>
              Dashboard
            </Link>
            <Link href="/admin/orders" className={styles.active}>
              <span>02</span>
              Orders
            </Link>
            <Link href="/admin/products">
              <span>03</span>
              Products
            </Link>
            <Link href="/admin/products/new">
              <span>04</span>
              Add Product
            </Link>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>FULFILMENT</span>
            <strong>{counts.to_ship} TO SHIP</strong>
            <Link href="/">OPEN STOREFRONT ↗</Link>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO · ORDER OPERATIONS</span>
              <h1>Orders</h1>
              <p>Payment, packing, shipment, tracking and refunds.</p>
            </div>

            <div className={styles.adminHeaderActions}>
              <div className={styles.adminAttention}>
                <span>TO SHIP</span>
                <strong>{loading ? "—" : counts.to_ship}</strong>
              </div>
            </div>
          </header>

          <section className={styles.adminOrdersPanel}>
            <nav className={styles.adminOrderTabs}>
              {tabs.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={tab === item.key ? styles.active : ""}
                  onClick={() => setTab(item.key)}
                >
                  <span>{item.label}</span>
                  <b>{counts[item.key]}</b>
                </button>
              ))}
            </nav>

            <div className={styles.adminOrderToolbar}>
              <label>
                <span>SEARCH ORDERS</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Order no., customer, SKU or product"
                />
              </label>

              <div>
                <span>SHOWING</span>
                <strong>
                  {loading ? "—" : filtered.length + " / " + orders.length}
                </strong>
              </div>
            </div>

            {message ? (
              <p className={styles.adminSuccess}>{message}</p>
            ) : null}
            {error ? <p className={styles.adminError}>{error}</p> : null}

            {loading ? (
              <p className={styles.adminNotice}>Loading orders...</p>
            ) : filtered.length === 0 ? (
              <div className={styles.adminEmptyState}>
                <strong>No orders in this view.</strong>
                <span>Try another status or search term.</span>
              </div>
            ) : (
              <div className={styles.adminOrderList}>
                {filtered.map((order) => (
                  <article
                    className={
                      styles.adminOrderCard +
                      (selected === order.order_number
                        ? " " + styles.selected
                        : "")
                    }
                    key={order.id}
                  >
                    <button
                      type="button"
                      className={styles.adminOrderCardMain}
                      onClick={() => openOrder(order)}
                    >
                      <div className={styles.adminOrderIdentity}>
                        <span>ORDER</span>
                        <strong>{order.order_number}</strong>
                        <small>
                          {new Date(order.created_at).toLocaleString("en-MY", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </small>
                      </div>

                      <div className={styles.adminOrderCustomer}>
                        <span>CUSTOMER</span>
                        <strong>{customerName(order)}</strong>
                        <small>
                          {order.customer?.email ||
                            order.shipping_address?.phone ||
                            "—"}
                        </small>
                      </div>

                      <div className={styles.adminOrderItemsBrief}>
                        <span>ITEMS</span>
                        <strong>
                          {order.items.reduce(
                            (sum, item) => sum + Number(item.quantity || 0),
                            0
                          )}
                        </strong>
                        <small>
                          {order.items[0]?.product_name || "No item data"}
                        </small>
                      </div>

                      <div className={styles.adminOrderStatusCell}>
                        <span
                          className={
                            styles.adminStatus +
                            " " +
                            styles["status_" + order.status]
                          }
                        >
                          {label(order.status)}
                        </span>
                        <small>{label(order.payment_status)}</small>
                      </div>

                      <div className={styles.adminOrderAmount}>
                        <span>TOTAL</span>
                        <strong>{money(Number(order.total_amount))}</strong>
                        <small>VIEW →</small>
                      </div>
                    </button>

                    {selected === order.order_number ? (
                      <div className={styles.adminOrderDrawer}>
                        <div className={styles.adminOrderDrawerMain}>
                          <section>
                            <span className={styles.adminPanelKicker}>
                              ORDER ITEMS
                            </span>
                            <div className={styles.adminDrawerItems}>
                              {order.items.map((item) => (
                                <div
                                  className={styles.adminDrawerItem}
                                  key={item.id}
                                >
                                  <div>
                                    <strong>{item.product_name}</strong>
                                    <span>
                                      {item.variant_name || "Default"} ·{" "}
                                      {item.sku}
                                    </span>
                                  </div>
                                  <div>
                                    <span>QTY {item.quantity}</span>
                                    <strong>
                                      {money(Number(item.line_subtotal))}
                                    </strong>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </section>

                          <section className={styles.adminAddressBlock}>
                            <span className={styles.adminPanelKicker}>
                              DELIVERY ADDRESS
                            </span>
                            <strong>
                              {order.shipping_address?.full_name ||
                                customerName(order)}
                            </strong>
                            <p>
                              {order.shipping_address?.phone}
                              <br />
                              {order.shipping_address?.address_line_1}
                              {order.shipping_address?.address_line_2
                                ? ", " +
                                  order.shipping_address.address_line_2
                                : ""}
                              <br />
                              {order.shipping_address?.postcode}{" "}
                              {order.shipping_address?.city},{" "}
                              {order.shipping_address?.state}
                            </p>
                          </section>

                          {order.customer_note ? (
                            <section className={styles.adminAddressBlock}>
                              <span className={styles.adminPanelKicker}>
                                CUSTOMER NOTE
                              </span>
                              <p>{order.customer_note}</p>
                            </section>
                          ) : null}
                        </div>

                        <aside className={styles.adminOrderDrawerSide}>
                          <section className={styles.adminFulfilmentCard}>
                            <span className={styles.adminPanelKicker}>
                              FULFILMENT
                            </span>
                            <div className={styles.adminFulfilmentStatus}>
                              <strong>{label(order.status)}</strong>
                              <small>
                                PAYMENT {label(order.payment_status)}
                              </small>
                            </div>

                            {["paid", "processing", "packed"].includes(
                              order.status
                            ) ? (
                              <>
                                {order.status === "paid" ? (
                                  <button
                                    type="button"
                                    className={styles.adminAction}
                                    disabled={busy === order.order_number}
                                    onClick={() =>
                                      updateStatus(order, "processing")
                                    }
                                  >
                                    MARK PROCESSING
                                  </button>
                                ) : null}

                                {order.status === "processing" ? (
                                  <button
                                    type="button"
                                    className={styles.adminAction}
                                    disabled={busy === order.order_number}
                                    onClick={() =>
                                      updateStatus(order, "packed")
                                    }
                                  >
                                    MARK PACKED
                                  </button>
                                ) : null}

                                {order.status === "packed" ? (
                                  <div className={styles.adminShipForm}>
                                    <label>
                                      <span>COURIER *</span>
                                      <input
                                        value={courier}
                                        onChange={(event) =>
                                          setCourier(event.target.value)
                                        }
                                        placeholder="SPX / J&T / DHL / Ninja Van"
                                      />
                                    </label>
                                    <label>
                                      <span>TRACKING NUMBER *</span>
                                      <input
                                        value={tracking}
                                        onChange={(event) =>
                                          setTracking(event.target.value)
                                        }
                                        placeholder="Tracking number"
                                      />
                                    </label>
                                    <label>
                                      <span>TRACKING URL</span>
                                      <input
                                        value={trackingUrl}
                                        onChange={(event) =>
                                          setTrackingUrl(event.target.value)
                                        }
                                        placeholder="Optional tracking link"
                                      />
                                    </label>

                                    <button
                                      type="button"
                                      className={styles.adminAction}
                                      disabled={
                                        busy === order.order_number ||
                                        !courier.trim() ||
                                        !tracking.trim()
                                      }
                                      onClick={() =>
                                        updateStatus(order, "shipped")
                                      }
                                    >
                                      MARK SHIPPED
                                    </button>
                                  </div>
                                ) : null}
                              </>
                            ) : null}

                            {order.status === "shipped" ? (
                              <>
                                <div className={styles.adminTrackingBox}>
                                  <span>COURIER</span>
                                  <strong>
                                    {order.shipment?.courier_name || "—"}
                                  </strong>
                                  <span>TRACKING</span>
                                  <strong>
                                    {order.shipment?.tracking_number || "—"}
                                  </strong>
                                </div>

                                <button
                                  type="button"
                                  className={styles.adminAction}
                                  disabled={busy === order.order_number}
                                  onClick={() =>
                                    updateStatus(order, "delivered")
                                  }
                                >
                                  MARK DELIVERED
                                </button>
                              </>
                            ) : null}

                            {order.status === "pending_payment" ? (
                              <p className={styles.adminNotice}>
                                Waiting for customer payment. This order
                                auto-cancels after 24 hours if unpaid.
                              </p>
                            ) : null}

                            {["cancelled", "refunded", "partially_refunded"].includes(
                              order.status
                            ) ? (
                              <div className={styles.adminRefundBox}>
                                <span>REFUND STATUS</span>
                                <strong>
                                  {label(order.refund_status || "none")}
                                </strong>
                                {Number(
                                  order.cancellation_refund_amount || 0
                                ) > 0 ? (
                                  <small>
                                    Refund{" "}
                                    {money(
                                      Number(
                                        order.cancellation_refund_amount
                                      )
                                    )}
                                  </small>
                                ) : null}
                              </div>
                            ) : null}
                          </section>

                          <section className={styles.adminTotalsCard}>
                            <div>
                              <span>SUBTOTAL</span>
                              <strong>
                                {money(Number(order.subtotal))}
                              </strong>
                            </div>
                            <div>
                              <span>SHIPPING</span>
                              <strong>
                                {money(Number(order.shipping_amount || 0))}
                              </strong>
                            </div>
                            <div className={styles.total}>
                              <span>TOTAL</span>
                              <strong>
                                {money(Number(order.total_amount))}
                              </strong>
                            </div>
                          </section>
                        </aside>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
