"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

type OrderItemRow = {
  id: string;
  order_id: string;
  seller_order_id: string | null;
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
  arrangement_method: string | null;
  pickup_date: string | null;
};

type SellerOrderRow = {
  id: string;
  order_id: string;
  seller_id: string | null;
  status: string;
  created_at: string;
};

type Parcel = {
  id: string;
  shopName: string;
  status: string;
  items: OrderItemRow[];
  shipment?: ShipmentRow;
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
  discount_amount: number | string;
  voucher_code: string | null;
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
  parcels: Parcel[];
};

type TabKey =
  | "all"
  | "to_pay"
  | "to_ship"
  | "shipped"
  | "completed"
  | "cancelled";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "all", label: "All" },
  { key: "to_pay", label: "To pay" },
  { key: "to_ship", label: "To ship" },
  { key: "shipped", label: "Shipped" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled / refund" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function label(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
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

const fulfilmentSteps = ["paid", "processing", "packed", "shipped", "delivered"];

// A shop parcel is never behind its parent order (older orders moved as a whole).
function parcelStatus(parcel: Parcel, order: OrderView) {
  const own = fulfilmentSteps.indexOf(parcel.status);
  const parent = fulfilmentSteps.indexOf(order.status);
  if (parent < 0) return order.status;
  return fulfilmentSteps[Math.max(own, parent)];
}

function customerName(order: OrderView) {
  return (
    order.customer?.full_name ||
    order.shipping_address?.full_name ||
    order.customer?.email ||
    "MIVO CUSTOMER"
  );
}

function officialTrackingUrl(courier: string, trackingNumber: string) {
  const value = courier.toLowerCase().replaceAll("&", "and");
  const tracking = trackingNumber.trim();

  if (
    value.includes("spx") ||
    value.includes("shopee xpress") ||
    value.includes("shopee express")
  ) {
    return tracking
      ? "https://spx.com.my/track?" + encodeURIComponent(tracking)
      : "https://spx.com.my/track";
  }

  if (
    value.includes("j&t") ||
    value.includes("j and t") ||
    value.includes("jnt") ||
    value.includes("jt express")
  ) {
    return "https://www.jtexpress.my/tracking";
  }

  return "";
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [tab, setTab] = useState<TabKey>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [parcelCourier, setParcelCourier] = useState<Record<string, string>>({});
  const [parcelTracking, setParcelTracking] = useState<Record<string, string>>({});
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
        "id, order_number, user_id, status, payment_status, total_amount, subtotal, shipping_amount, discount_amount, voucher_code, shipping_address, customer_note, created_at, paid_at, refund_status, cancellation_refund_amount"
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
                "id, order_id, seller_order_id, product_name, variant_name, sku, quantity, unit_price, line_subtotal"
              )
              .in("order_id", orderIds)
              .order("created_at")
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("seller_orders")
              .select("id, order_id, seller_id, status, created_at")
              .in("order_id", orderIds)
              .order("created_at")
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
    const sellerIds = Array.from(
      new Set(
        sellerOrders
          .map((row) => row.seller_id)
          .filter((value): value is string => Boolean(value))
      )
    );

    const [shipmentResult, shopResult] = await Promise.all([
      sellerOrderIds.length
        ? supabase
            .from("shipments")
            .select(
              "id, seller_order_id, courier_name, tracking_number, tracking_url, status, arrangement_method, pickup_date"
            )
            .in("seller_order_id", sellerOrderIds)
            .order("created_at")
        : Promise.resolve({ data: [], error: null }),
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

    const sellerOrdersByOrder = new Map<string, SellerOrderRow[]>();
    sellerOrders.forEach((row) => {
      const rows = sellerOrdersByOrder.get(row.order_id) || [];
      rows.push(row);
      sellerOrdersByOrder.set(row.order_id, rows);
    });

    // Keep the first shipment per shop order.
    const shipmentBySellerOrder = new Map<string, ShipmentRow>();
    ((shipmentResult.data as ShipmentRow[] | null) || []).forEach((row) => {
      if (!shipmentBySellerOrder.has(row.seller_order_id)) {
        shipmentBySellerOrder.set(row.seller_order_id, row);
      }
    });

    const nextOrders: OrderView[] = baseOrders.map((order) => {
      const items = itemsByOrder.get(order.id) || [];
      const parcels: Parcel[] = (sellerOrdersByOrder.get(order.id) || []).map(
        (row) => ({
          id: row.id,
          shopName:
            (row.seller_id && shopNames.get(row.seller_id)) || "MIVO shop",
          status: row.status,
          items: items.filter((item) => item.seller_order_id === row.id),
          shipment: shipmentBySellerOrder.get(row.id),
        })
      );

      return {
        ...order,
        items,
        customer: profiles.get(order.user_id),
        shipment: parcels[0]?.shipment,
        parcels,
      };
    });

    setOrders(nextOrders);

    const searchParams =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : null;
    const requestedOrder = searchParams?.get("order") || null;
    const requestedTab = searchParams?.get("tab") || "";

    if (tabs.some((item) => item.key === requestedTab)) {
      setTab(requestedTab as TabKey);
    }

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
              ? officialTrackingUrl(courier.trim(), tracking.trim()) ||
                trackingUrl.trim() ||
                null
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

  async function updateParcel(
    order: OrderView,
    parcel: Parcel,
    nextStatus: "processing" | "packed" | "shipped" | "delivered"
  ) {
    const parcelCourierValue = (
      parcelCourier[parcel.id] ??
      parcel.shipment?.courier_name ??
      ""
    ).trim();
    const parcelTrackingValue = (
      parcelTracking[parcel.id] ??
      parcel.shipment?.tracking_number ??
      ""
    ).trim();

    setBusy(parcel.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const shipping = nextStatus === "shipped";
      const { error: updateError } = await supabase.rpc(
        "admin_update_shop_fulfilment",
        {
          p_seller_order_id: parcel.id,
          p_status: nextStatus,
          p_courier_name: shipping ? parcelCourierValue || null : null,
          p_tracking_number: shipping ? parcelTrackingValue || null : null,
          p_tracking_url: shipping
            ? officialTrackingUrl(parcelCourierValue, parcelTrackingValue) ||
              null
            : null,
        }
      );

      if (updateError) throw updateError;

      await loadOrders();
      setMessage(
        order.order_number +
          " · " +
          parcel.shopName +
          " updated to " +
          label(nextStatus) +
          "."
      );
    } catch (caught) {
      const text =
        caught instanceof Error
          ? caught.message
          : (caught as { message?: string } | null)?.message ||
            "Unable to update this shop parcel.";
      setError(
        /admin_update_shop_fulfilment/.test(text)
          ? "Run supabase/per-shop-fulfilment.sql in Supabase to ship multi-shop orders per shop."
          : text
      );
    } finally {
      setBusy("");
    }
  }

  async function markPaid(order: OrderView) {
    setBusy(order.order_number);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: paymentError } = await supabase.rpc(
        "admin_mark_order_paid",
        {
          p_order_number: order.order_number,
        }
      );

      if (paymentError) throw paymentError;

      await loadOrders();
      setMessage(order.order_number + " marked as PAID.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to mark this order as paid."
      );
    } finally {
      setBusy("");
    }
  }

  function renderParcels(order: OrderView) {
    return (
      <div className={styles.adminParcelList}>
        <p className={styles.adminNotice}>
          This order has {order.parcels.length} shops. Each shop ships its own
          parcel; the order moves on when the slowest shop does.
        </p>

        {order.parcels.map((parcel) => {
          const status = parcelStatus(parcel, order);
          const isBusy = busy === parcel.id;
          const courierValue =
            parcelCourier[parcel.id] ?? parcel.shipment?.courier_name ?? "";
          const trackingValue =
            parcelTracking[parcel.id] ??
            parcel.shipment?.tracking_number ??
            "";

          return (
            <div className={styles.adminParcel} key={parcel.id}>
              <div className={styles.adminParcelHead}>
                <strong>{parcel.shopName}</strong>
                <span>{label(status)}</span>
              </div>
              <small className={styles.adminParcelMeta}>
                {parcel.items.reduce(
                  (sum, item) => sum + Number(item.quantity || 0),
                  0
                )}{" "}
                item(s)
              </small>

              {status === "paid" ? (
                <button
                  type="button"
                  className={styles.adminAction}
                  disabled={isBusy}
                  onClick={() => updateParcel(order, parcel, "processing")}
                >
                  Mark processing
                </button>
              ) : null}

              {status === "processing" ? (
                <button
                  type="button"
                  className={styles.adminAction}
                  disabled={isBusy}
                  onClick={() => updateParcel(order, parcel, "packed")}
                >
                  Mark packed
                </button>
              ) : null}

              {status === "packed" ? (
                <div className={styles.adminShipForm}>
                  <label>
                    <span>Courier *</span>
                    <select
                      value={courierValue}
                      onChange={(event) =>
                        setParcelCourier((current) => ({
                          ...current,
                          [parcel.id]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Select courier</option>
                      <option value="SPX Express">SPX Express</option>
                      <option value="J&T Express">J&T Express</option>
                    </select>
                  </label>
                  <label>
                    <span>Tracking number *</span>
                    <input
                      value={trackingValue}
                      onChange={(event) =>
                        setParcelTracking((current) => ({
                          ...current,
                          [parcel.id]: event.target.value,
                        }))
                      }
                      placeholder="Tracking number"
                    />
                  </label>
                  <button
                    type="button"
                    className={styles.adminAction}
                    disabled={
                      isBusy || !courierValue.trim() || !trackingValue.trim()
                    }
                    onClick={() => updateParcel(order, parcel, "shipped")}
                  >
                    Mark shipped
                  </button>
                </div>
              ) : null}

              {status === "shipped" || status === "delivered" ? (
                <div className={styles.adminTrackingBox}>
                  <span>Courier</span>
                  <strong>{parcel.shipment?.courier_name || "—"}</strong>
                  <span>Tracking</span>
                  <strong>{parcel.shipment?.tracking_number || "—"}</strong>
                </div>
              ) : null}

              {status === "shipped" ? (
                <button
                  type="button"
                  className={styles.adminAction}
                  disabled={isBusy}
                  onClick={() => updateParcel(order, parcel, "delivered")}
                >
                  Mark delivered
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  function openOrder(order: OrderView) {
    setSelected((current) =>
      current === order.order_number ? "" : order.order_number
    );
    setMessage("");
    setError("");
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO · Order operations</span>
              <h1>Orders</h1>
              <p>Payment, packing, shipment, tracking and refunds.</p>
            </div>

            <div className={styles.adminHeaderActions}>
              <div className={styles.adminAttention}>
                <span>To ship</span>
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
                <span>Search orders</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Order no., customer, SKU or product"
                />
              </label>

              <div>
                <span>Showing</span>
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
                        <span>Order</span>
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
                        <span>Customer</span>
                        <strong>{customerName(order)}</strong>
                        <small>
                          {order.customer?.email ||
                            order.shipping_address?.phone ||
                            "—"}
                        </small>
                      </div>

                      <div className={styles.adminOrderItemsBrief}>
                        <span>Items</span>
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
                        <span>Total</span>
                        <strong>{money(Number(order.total_amount))}</strong>
                        <small>
                          {selected === order.order_number
                            ? "CLOSE ↑"
                            : "VIEW →"}
                        </small>
                      </div>
                    </button>

                    {selected === order.order_number ? (
                      <div className={styles.adminOrderDrawer}>
                        <div className={styles.adminOrderDrawerMain}>
                          <section>
                            <span className={styles.adminPanelKicker}>
                              Order items
                            </span>
                            {order.parcels.length > 1 ? (
                              order.parcels.map((parcel) => (
                                <div
                                  className={styles.adminParcelItems}
                                  key={parcel.id}
                                >
                                  <div className={styles.adminParcelHead}>
                                    <strong>{parcel.shopName}</strong>
                                    <span>
                                      {label(parcelStatus(parcel, order))}
                                    </span>
                                  </div>
                                  <div className={styles.adminDrawerItems}>
                                    {parcel.items.map((item) => (
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
                                </div>
                              ))
                            ) : (
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
                            )}
                          </section>

                          <section className={styles.adminAddressBlock}>
                            <span className={styles.adminPanelKicker}>
                              Delivery address
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
                                Customer note
                              </span>
                              <p>{order.customer_note}</p>
                            </section>
                          ) : null}
                        </div>

                        <aside className={styles.adminOrderDrawerSide}>
                          <section className={styles.adminFulfilmentCard}>
                            <span className={styles.adminPanelKicker}>
                              Fulfilment
                            </span>
                            <div className={styles.adminFulfilmentStatus}>
                              <strong>{label(order.status)}</strong>
                              <small>
                                PAYMENT {label(order.payment_status)}
                              </small>
                            </div>

                            {order.parcels.length > 1 &&
                            fulfilmentSteps.slice(0, 4).includes(order.status)
                              ? renderParcels(order)
                              : null}

                            {order.parcels.length <= 1 &&
                            ["paid", "processing", "packed"].includes(
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
                                    Mark processing
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
                                    Mark packed
                                  </button>
                                ) : null}

                                {order.status === "packed" ? (
                                  <div className={styles.adminShipForm}>
                                    <label>
                                      <span>Courier *</span>
                                      <select
                                        value={courier}
                                        onChange={(event) =>
                                          setCourier(event.target.value)
                                        }
                                      >
                                        <option value="">Select courier</option>
                                        <option value="SPX Express">
                                          SPX Express
                                        </option>
                                        <option value="J&T Express">
                                          J&T Express
                                        </option>
                                      </select>
                                    </label>
                                    <label>
                                      <span>Tracking number *</span>
                                      <input
                                        value={tracking}
                                        onChange={(event) =>
                                          setTracking(event.target.value)
                                        }
                                        placeholder="Tracking number"
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
                                      Mark shipped
                                    </button>
                                  </div>
                                ) : null}
                              </>
                            ) : null}

                            {order.parcels.length <= 1 &&
                            order.status === "shipped" ? (
                              <>
                                <div className={styles.adminTrackingBox}>
                                  <span>Courier</span>
                                  <strong>
                                    {order.shipment?.courier_name || "—"}
                                  </strong>
                                  <span>Tracking</span>
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
                                  Mark delivered
                                </button>
                              </>
                            ) : null}

                            {order.status === "pending_payment" ? (
                              <>
                                <p className={styles.adminNotice}>
                                  Waiting for customer payment. For testing or
                                  manually verified payments, confirm it here
                                  before fulfilment.
                                </p>
                                <button
                                  type="button"
                                  className={styles.adminAction}
                                  disabled={busy === order.order_number}
                                  onClick={() => markPaid(order)}
                                >
                                  {busy === order.order_number
                                    ? "Confirming…"
                                    : "Mark as paid"}
                                </button>
                              </>
                            ) : null}

                            {["cancelled", "refunded", "partially_refunded"].includes(
                              order.status
                            ) ? (
                              <div className={styles.adminRefundBox}>
                                <span>Refund status</span>
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
                              <span>Subtotal</span>
                              <strong>
                                {money(Number(order.subtotal))}
                              </strong>
                            </div>
                            <div>
                              <span>Shipping</span>
                              <strong>
                                {money(Number(order.shipping_amount || 0))}
                              </strong>
                            </div>
                            {Number(order.discount_amount || 0) > 0 ? (
                              <div>
                                <span>
                                  Voucher
                                  {order.voucher_code
                                    ? " · " + order.voucher_code
                                    : ""}
                                </span>
                                <strong style={{ color: "#d8242f" }}>
                                  − {money(Number(order.discount_amount || 0))}
                                </strong>
                              </div>
                            ) : null}
                            <div className={styles.total}>
                              <span>Total</span>
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
