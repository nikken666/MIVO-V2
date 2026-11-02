"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";

type OrderItemRow = {
  id: string;
  order_id: string;
  seller_order_id: string | null;
  product_name: string;
  sku: string;
  quantity: number;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type SellerOrderRow = {
  id: string;
  order_id: string;
  seller_id: string | null;
  status: string;
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

type OrderRow = {
  id: string;
  order_number: string;
  user_id: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  shipping_address: Record<string, string> | null;
  created_at: string;
  paid_at: string | null;
};

type OrderView = OrderRow & {
  items: OrderItemRow[];
  customer?: ProfileRow;
  shipment?: ShipmentRow;
  shopCount: number;
  // One row per order, or per shop parcel when an order spans several shops.
  key: string;
  parcelId?: string;
  shopName?: string;
  parcelIndex?: number;
};

const fulfilmentSteps = ["paid", "processing", "packed", "shipped", "delivered"];

function describeError(caught: unknown, fallback: string) {
  const text =
    (caught as { message?: string } | null)?.message || fallback;
  return /admin_(arrange_shop_shipments|update_shop_fulfilment)/.test(text)
    ? "Run supabase/per-shop-fulfilment.sql in Supabase to ship multi-shop orders per shop."
    : text;
}

type PageTab = "ready" | "arranged";

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function customerName(order: OrderView) {
  return (
    order.customer?.full_name ||
    order.shipping_address?.full_name ||
    order.customer?.email ||
    "MIVO CUSTOMER"
  );
}

function isArranged(order: OrderView) {
  if (order.shipment?.arrangement_method) return true;

  return [
    "booked",
    "label_ready",
    "picked_up",
    "in_transit",
    "delivered",
  ].includes(order.shipment?.status || "");
}

function courierName(order: OrderView) {
  return (
    order.shipment?.courier_name ||
    order.shipping_address?.shipping_courier_name ||
    "Courier from checkout"
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

export default function ArrangeShipmentPage() {
  const [orders, setOrders] = useState<OrderView[]>([]);
  const [tab, setTab] = useState<PageTab>("ready");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [arrangementMethod, setArrangementMethod] = useState<
    "drop_off" | "pickup"
  >("drop_off");
  const [pickupDate, setPickupDate] = useState("");
  const [courierOverride, setCourierOverride] = useState("");
  const [courierInputs, setCourierInputs] = useState<Record<string, string>>({});
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});
  const [shippingBusy, setShippingBusy] = useState("");

  async function loadOrders() {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login?next=/admin/arrange-shipment";
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
        "id, order_number, user_id, status, payment_status, total_amount, shipping_address, created_at, paid_at"
      )
      .eq("payment_status", "paid")
      .in("status", ["paid", "processing", "packed"])
      .order("paid_at", { ascending: true, nullsFirst: false });

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
              .select("id, full_name, email")
              .in("id", userIds)
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("order_items")
              .select("id, order_id, seller_order_id, product_name, sku, quantity")
              .in("order_id", orderIds)
              .order("created_at")
          : Promise.resolve({ data: [], error: null }),
        orderIds.length
          ? supabase
              .from("seller_orders")
              .select("id, order_id, seller_id, status")
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

    const sellerOrders =
      (sellerOrderResult.data as SellerOrderRow[] | null) || [];
    const sellerOrderIds = sellerOrders.map((row) => row.id);

    const shipmentResult = sellerOrderIds.length
      ? await supabase
          .from("shipments")
          .select(
            "id, seller_order_id, courier_name, tracking_number, tracking_url, status, arrangement_method, pickup_date"
          )
          .in("seller_order_id", sellerOrderIds)
      : { data: [], error: null };

    if (shipmentResult.error) throw shipmentResult.error;

    const sellerIds = Array.from(
      new Set(
        sellerOrders
          .map((row) => row.seller_id)
          .filter((value): value is string => Boolean(value))
      )
    );
    const shopResult = sellerIds.length
      ? await supabase.from("sellers").select("id, shop_name").in("id", sellerIds)
      : { data: [], error: null };
    const shopNames = new Map(
      (
        (shopResult.data as Array<{ id: string; shop_name: string }> | null) ||
        []
      ).map((row) => [row.id, row.shop_name])
    );

    const sellerOrdersByOrder = new Map<string, SellerOrderRow[]>();
    sellerOrders.forEach((row) => {
      const rows = sellerOrdersByOrder.get(row.order_id) || [];
      rows.push(row);
      sellerOrdersByOrder.set(row.order_id, rows);
    });
    const shipmentBySellerOrder = new Map<string, ShipmentRow>();
    ((shipmentResult.data as ShipmentRow[] | null) || []).forEach((row) => {
      if (!shipmentBySellerOrder.has(row.seller_order_id)) {
        shipmentBySellerOrder.set(row.seller_order_id, row);
      }
    });

    const rows: OrderView[] = [];
    baseOrders.forEach((order) => {
      const items = itemsByOrder.get(order.id) || [];
      const parcels = sellerOrdersByOrder.get(order.id) || [];
      const base = {
        ...order,
        items,
        customer: profiles.get(order.user_id),
        shopCount: Math.max(parcels.length, 1),
      };

      if (parcels.length <= 1) {
        rows.push({
          ...base,
          key: order.order_number,
          shipment: parcels[0] ? shipmentBySellerOrder.get(parcels[0].id) : undefined,
        });
        return;
      }

      const parentRank = fulfilmentSteps.indexOf(order.status);
      parcels.forEach((parcel, index) => {
        // Parcels already shipped are done here.
        if (Math.max(fulfilmentSteps.indexOf(parcel.status), parentRank) >= 3) return;
        rows.push({
          ...base,
          key: "parcel:" + parcel.id,
          parcelId: parcel.id,
          parcelIndex: index + 1,
          shopName: (parcel.seller_id && shopNames.get(parcel.seller_id)) || "MIVO shop",
          items: items.filter((item) => item.seller_order_id === parcel.id),
          shipment: shipmentBySellerOrder.get(parcel.id),
        });
      });
    });

    setOrders(rows);
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
            : "Unable to load paid orders."
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
    const ready = orders.filter((order) => !isArranged(order)).length;
    const arranged = orders.filter((order) => isArranged(order)).length;

    return {
      ready,
      arranged,
    };
  }, [orders]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return orders.filter((order) => {
      const arranged = isArranged(order);
      const tabMatch =
        (tab === "ready" && !arranged) ||
        (tab === "arranged" && arranged);

      const searchMatch =
        !q ||
        [
          order.order_number,
          customerName(order),
          order.customer?.email || "",
          order.shipping_address?.phone || "",
          courierName(order),
          ...order.items.map((item) => item.sku),
          ...order.items.map((item) => item.product_name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      return tabMatch && searchMatch;
    });
  }, [orders, query, tab]);

  const selectable = filtered.filter((order) => !isArranged(order));
  const allVisibleSelected =
    selectable.length > 0 &&
    selectable.every((order) => selected.includes(order.key));

  function toggleOrder(orderNumber: string) {
    setSelected((current) =>
      current.includes(orderNumber)
        ? current.filter((value) => value !== orderNumber)
        : [...current, orderNumber]
    );
  }

  function toggleAllVisible() {
    const visible = selectable.map((order) => order.key);

    setSelected((current) => {
      const allSelected = visible.every((value) => current.includes(value));

      if (allSelected) {
        return current.filter((value) => !visible.includes(value));
      }

      return Array.from(new Set([...current, ...visible]));
    });
  }

  async function arrangeSelected() {
    if (!selected.length) return;

    setBusy(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const pickup =
        arrangementMethod === "pickup" && pickupDate ? pickupDate : null;
      const courierName = courierOverride.trim() || null;
      // Single-shop orders use the order-level arrangement; shop parcels
      // of multi-shop orders are arranged one by one.
      const orderNumbers = selected.filter((key) => !key.startsWith("parcel:"));
      const parcelIds = selected
        .filter((key) => key.startsWith("parcel:"))
        .map((key) => key.slice("parcel:".length));
      let processedCount = 0;

      if (orderNumbers.length) {
        const { data, error: arrangeError } = await supabase.rpc(
          "admin_mass_arrange_shipments",
          {
            p_order_numbers: orderNumbers,
            p_arrangement_method: arrangementMethod,
            p_pickup_date: pickup,
            p_courier_name: courierName,
          }
        );
        if (arrangeError) throw arrangeError;
        processedCount += Number(
          (data as { processed_count?: number } | null)?.processed_count || 0
        );
      }

      if (parcelIds.length) {
        const { data, error: arrangeError } = await supabase.rpc(
          "admin_arrange_shop_shipments",
          {
            p_seller_order_ids: parcelIds,
            p_arrangement_method: arrangementMethod,
            p_pickup_date: pickup,
            p_courier_name: courierName,
          }
        );
        if (arrangeError) throw arrangeError;
        processedCount += Number(
          (data as { processed_count?: number } | null)?.processed_count || 0
        );
      }

      await loadOrders();
      setSelected([]);
      setModalOpen(false);
      setTab("arranged");
      setMessage(
        processedCount +
          " shipment" +
          (processedCount === 1 ? "" : "s") +
          " arranged."
      );
    } catch (caught) {
      setError(describeError(caught, "Unable to arrange selected shipments."));
    } finally {
      setBusy(false);
    }
  }

  async function markShipped(order: OrderView) {
    const orderNumber = order.key;
    const courier = (
      courierInputs[orderNumber] ??
      order.shipment?.courier_name ??
      ""
    ).trim();
    const tracking = (
      trackingInputs[orderNumber] ??
      order.shipment?.tracking_number ??
      ""
    ).trim();
    const trackingUrl =
      officialTrackingUrl(courier, tracking) ||
      (order.shipment?.tracking_url || "").trim();

    if (!courier || !tracking) {
      setError("Courier and tracking number are required.");
      return;
    }

    setShippingBusy(orderNumber);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const { error: shipError } = order.parcelId
        ? await supabase.rpc("admin_update_shop_fulfilment", {
            p_seller_order_id: order.parcelId,
            p_status: "shipped",
            p_courier_name: courier,
            p_tracking_number: tracking,
            p_tracking_url: trackingUrl || null,
          })
        : await supabase.rpc("admin_update_order_fulfilment", {
            p_order_number: order.order_number,
            p_status: "shipped",
            p_courier_name: courier,
            p_tracking_number: tracking,
            p_tracking_url: trackingUrl || null,
          });

      if (shipError) throw shipError;

      await loadOrders();
      setMessage(
        order.order_number +
          (order.shopName ? " · " + order.shopName : "") +
          " marked as SHIPPED."
      );
    } catch (caught) {
      setError(describeError(caught, "Unable to mark this order as shipped."));
    } finally {
      setShippingBusy("");
    }
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <aside className={styles.adminSidebar}>
          <a href="/admin" className={styles.adminBrand}>
            <span>MIVO</span>
            <small>STORE CONTROL</small>
          </a>

          <nav className={styles.adminSideNav}>
            <a href="/admin"><span>01</span>Dashboard</a>
            <a href="/admin/orders"><span>02</span>Orders</a>
            <a href="/admin/arrange-shipment" className={styles.active}><span>03</span>Arrange Shipment</a>
            <a href="/admin/claims"><span>04</span>Claims</a>
            <a href="/admin/marketing"><span>05</span>Marketing Centre</a>
            <a href="/admin/products"><span>06</span>Products</a>
            <a href="/admin/products/new"><span>07</span>Add Product</a>
            <a href="/admin/shipping"><span>08</span>Shipping</a>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>PAID ORDERS</span>
            <strong>{counts.ready} TO ARRANGE</strong>
            <a href="/admin/orders?tab=to_ship">OPEN TO SHIP</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MIVO · FULFILMENT
              </span>
              <h1>Arrange Shipment</h1>
              <p>
                Paid orders only. Select one or many orders and arrange them
                together.
              </p>
            </div>

            <div className={styles.adminHeaderActions}>
              <div className={styles.adminAttention}>
                <span>READY</span>
                <strong>{loading ? "—" : counts.ready}</strong>
              </div>
            </div>
          </header>

          <section className={styles.adminOrdersPanel}>
            <nav className={styles.adminOrderTabs}>
              <button
                type="button"
                className={tab === "ready" ? styles.active : ""}
                onClick={() => setTab("ready")}
              >
                <span>READY TO ARRANGE</span>
                <b>{counts.ready}</b>
              </button>
              <button
                type="button"
                className={tab === "arranged" ? styles.active : ""}
                onClick={() => setTab("arranged")}
              >
                <span>ARRANGED</span>
                <b>{counts.arranged}</b>
              </button>
            </nav>

            <div className={styles.adminOrderToolbar}>
              <label>
                <span>SEARCH PAID ORDERS</span>
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

            {tab !== "arranged" && selectable.length > 0 ? (
              <div className={styles.adminMassArrangeBar}>
                <label className={styles.adminMassSelectAll}>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleAllVisible}
                  />
                  <span>SELECT ALL {selectable.length} READY ORDERS</span>
                </label>

                <div className={styles.adminMassArrangeActions}>
                  <span>{selected.length} SELECTED</span>
                  <button
                    type="button"
                    className={styles.adminAction}
                    disabled={selected.length === 0}
                    onClick={() => setModalOpen(true)}
                  >
                    MASS ARRANGE SHIPMENT
                  </button>
                </div>
              </div>
            ) : null}

            {message ? (
              <p className={styles.adminSuccess}>{message}</p>
            ) : null}
            {error ? <p className={styles.adminError}>{error}</p> : null}

            {loading ? (
              <p className={styles.adminNotice}>Loading paid orders...</p>
            ) : filtered.length === 0 ? (
              <div className={styles.adminEmptyState}>
                <strong>No paid orders in this view.</strong>
                <span>New paid orders will appear here automatically.</span>
              </div>
            ) : (
              <div className={styles.adminOrderList}>
                {filtered.map((order) => {
                  const arranged = isArranged(order);
                  const totalQty = order.items.reduce(
                    (sum, item) => sum + Number(item.quantity || 0),
                    0
                  );

                  return (
                    <article
                      className={styles.adminOrderCard}
                      key={order.key}
                    >
                      {!arranged ? (
                        <label className={styles.adminOrderBatchCheck}>
                          <input
                            type="checkbox"
                            checked={selected.includes(order.key)}
                            onChange={() => toggleOrder(order.key)}
                          />
                          <span>SELECT</span>
                        </label>
                      ) : null}

                      <div
                        className={styles.adminOrderCardMain}
                        style={!arranged ? { paddingLeft: 102 } : undefined}
                      >
                        <div className={styles.adminOrderIdentity}>
                          <span>ORDER</span>
                          <strong>{order.order_number}</strong>
                          {order.parcelId ? (
                            <small>
                              Parcel {order.parcelIndex}/{order.shopCount} ·{" "}
                              {order.shopName}
                            </small>
                          ) : null}
                          <small>
                            Paid{" "}
                            {order.paid_at
                              ? new Date(order.paid_at).toLocaleString(
                                  "en-MY",
                                  {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )
                              : "—"}
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
                          <strong>{totalQty}</strong>
                          <small>
                            {order.items[0]?.product_name || "No item data"}
                          </small>
                        </div>

                        <div className={styles.adminOrderStatusCell}>
                          <span
                            className={
                              styles.adminStatus +
                              " " +
                              styles[
                                "status_" +
                                  (arranged ? "packed" : order.status)
                              ]
                            }
                          >
                            {arranged ? "ARRANGED" : "READY"}
                          </span>
                          <small>{courierName(order)}</small>
                        </div>

                        <div className={styles.adminOrderAmount}>
                          <span>TOTAL</span>
                          <strong>
                            {money(Number(order.total_amount))}
                          </strong>
                          <small>
                            {arranged
                              ? order.shipment?.arrangement_method ===
                                "pickup"
                                ? "PICKUP"
                                : "DROP-OFF"
                              : "PAID"}
                          </small>
                        </div>
                      </div>

                      {arranged ? (
                        <div className={styles.adminArrangedTracking}>
                          <label>
                            <span>COURIER *</span>
                            <select
                              value={
                                courierInputs[order.key] ??
                                order.shipment?.courier_name ??
                                ""
                              }
                              onChange={(event) =>
                                setCourierInputs((current) => ({
                                  ...current,
                                  [order.key]: event.target.value,
                                }))
                              }
                            >
                              <option value="">SELECT COURIER</option>
                              <option value="SPX Express">SPX EXPRESS</option>
                              <option value="J&T Express">J&T EXPRESS</option>
                            </select>
                          </label>

                          <label>
                            <span>TRACKING NUMBER *</span>
                            <input
                              value={
                                trackingInputs[order.key] ??
                                order.shipment?.tracking_number ??
                                ""
                              }
                              onChange={(event) =>
                                setTrackingInputs((current) => ({
                                  ...current,
                                  [order.key]: event.target.value,
                                }))
                              }
                              placeholder="Enter tracking number"
                            />
                          </label>

                          <button
                            type="button"
                            className={styles.adminAction}
                            disabled={
                              shippingBusy === order.key ||
                              !(
                                courierInputs[order.key] ??
                                order.shipment?.courier_name ??
                                ""
                              ).trim() ||
                              !(
                                trackingInputs[order.key] ??
                                order.shipment?.tracking_number ??
                                ""
                              ).trim()
                            }
                            onClick={() => void markShipped(order)}
                          >
                            {shippingBusy === order.key
                              ? "SAVING..."
                              : "SAVE TRACKING & MARK SHIPPED"}
                          </button>
                        </div>
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </section>
      </div>

      {modalOpen ? (
        <div
          className={styles.adminModalBackdrop}
          onMouseDown={() => {
            if (!busy) setModalOpen(false);
          }}
        >
          <section
            className={styles.adminMassArrangeModal}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className={styles.adminMassArrangeHeader}>
              <div>
                <span>MIVO FULFILMENT</span>
                <h2>MASS ARRANGE SHIPMENT</h2>
                <p>
                  Arrange {selected.length} paid order
                  {selected.length === 1 ? "" : "s"} at once.
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => setModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className={styles.adminMassArrangeBody}>
              <div className={styles.adminMassMethodGrid}>
                <button
                  type="button"
                  className={
                    arrangementMethod === "drop_off"
                      ? styles.active
                      : ""
                  }
                  onClick={() => setArrangementMethod("drop_off")}
                >
                  <strong>DROP-OFF</strong>
                  <span>Pack and drop parcels at the courier point.</span>
                </button>

                <button
                  type="button"
                  className={
                    arrangementMethod === "pickup"
                      ? styles.active
                      : ""
                  }
                  onClick={() => setArrangementMethod("pickup")}
                >
                  <strong>PICKUP</strong>
                  <span>Prepare parcels for courier collection.</span>
                </button>
              </div>

              {arrangementMethod === "pickup" ? (
                <label className={styles.adminMassField}>
                  <span>PICKUP DATE *</span>
                  <input
                    type="date"
                    value={pickupDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setPickupDate(event.target.value)}
                  />
                </label>
              ) : null}

              <label className={styles.adminMassField}>
                <span>COURIER</span>
                <select
                  value={courierOverride}
                  onChange={(event) =>
                    setCourierOverride(event.target.value)
                  }
                >
                  <option value="">USE EACH ORDER'S COURIER</option>
                  <option value="SPX Express">SPX EXPRESS</option>
                  <option value="J&T Express">J&T EXPRESS</option>
                </select>
              </label>

              <div className={styles.adminMassSummary}>
                <span>PAID ORDERS SELECTED</span>
                <strong>{selected.length}</strong>
                <small>
                  Confirmed orders move to ARRANGED / PACKED.
                </small>
              </div>
            </div>

            <div className={styles.adminMassArrangeFooter}>
              <button
                type="button"
                className={styles.adminSecondaryAction}
                disabled={busy}
                onClick={() => setModalOpen(false)}
              >
                CANCEL
              </button>
              <button
                type="button"
                className={styles.adminAction}
                disabled={
                  busy ||
                  selected.length === 0 ||
                  (arrangementMethod === "pickup" && !pickupDate)
                }
                onClick={() => void arrangeSelected()}
              >
                {busy
                  ? "ARRANGING..."
                  : "CONFIRM " +
                    selected.length +
                    " SHIPMENT" +
                    (selected.length === 1 ? "" : "S")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
