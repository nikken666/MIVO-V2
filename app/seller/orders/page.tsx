"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { chargeBeforeShipping } from "@/lib/adminPayments";
import { formatPrice } from "@/data/products";
import styles from "@/app/admin/Admin.module.css";
import { useMyShops } from "../SellerGate";

type Parcel = {
  seller_order_id: string;
  seller_id: string;
  order_number: string;
  order_status: string;
  payment_status: string;
  parcel_status: string;
  subtotal: number | string;
  shipping_address: Record<string, string> | null;
  customer_note: string | null;
  created_at: string;
  paid_at: string | null;
  courier_name: string | null;
  tracking_number: string | null;
};
type Item = { seller_order_id: string; product_name: string; variant_name: string | null; sku: string; quantity: number };

const tabs = [
  { key: "toShip", label: "To ship", match: ["paid", "processing", "packed"] },
  { key: "shipped", label: "Shipped", match: ["shipped"] },
  { key: "done", label: "Completed", match: ["delivered"] },
  { key: "unpaid", label: "Unpaid", match: ["pending_payment"] },
  { key: "all", label: "All", match: [] as string[] },
];

const label = (v: string) => {
  const t = v.replaceAll("_", " ");
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export default function SellerOrdersPage() {
  const { shops, error: gateError } = useMyShops();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [items, setItems] = useState<Map<string, Item[]>>(new Map());
  const [tab, setTab] = useState("toShip");
  const [courier, setCourier] = useState<Record<string, string>>({});
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: listError } = await supabase.rpc("seller_parcels", { p_seller_id: null });
    if (listError) {
      setError(listError.message);
      return;
    }
    const list = (data || []) as Parcel[];
    setParcels(list);
    const ids = list.map((p) => p.seller_order_id);
    if (ids.length) {
      const { data: rows } = await supabase
        .from("order_items")
        .select("seller_order_id, product_name, variant_name, sku, quantity")
        .in("seller_order_id", ids);
      const map = new Map<string, Item[]>();
      ((rows || []) as Item[]).forEach((row) => map.set(row.seller_order_id, [...(map.get(row.seller_order_id) || []), row]));
      setItems(map);
    }
  }, []);

  useEffect(() => {
    if (shops?.length) void load();
  }, [shops, load]);

  const shopName = (id: string) => shops?.find((s) => s.id === id)?.shop_name || "";
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    tabs.forEach((t) => (c[t.key] = t.match.length ? parcels.filter((p) => t.match.includes(p.parcel_status)).length : parcels.length));
    return c;
  }, [parcels]);
  const visible = parcels.filter((p) => {
    const t = tabs.find((x) => x.key === tab)!;
    return !t.match.length || t.match.includes(p.parcel_status);
  });

  async function move(parcel: Parcel, next: "processing" | "packed" | "shipped" | "delivered") {
    setBusy(parcel.seller_order_id);
    setError("");
    setMessage("");
    try {
      const c = (courier[parcel.seller_order_id] ?? parcel.courier_name ?? "").trim();
      const tr = (tracking[parcel.seller_order_id] ?? parcel.tracking_number ?? "").trim();
      if (next === "shipped") {
        if (!c || !tr) throw new Error("Courier and tracking number are required.");
        await chargeBeforeShipping(parcel.order_number);
      }
      const { error: rpcError } = await createClient().rpc("admin_update_shop_fulfilment", {
        p_seller_order_id: parcel.seller_order_id,
        p_status: next,
        p_courier_name: next === "shipped" ? c : null,
        p_tracking_number: next === "shipped" ? tr : null,
        p_tracking_url: null,
      });
      if (rpcError) throw new Error(rpcError.message);
      setMessage(parcel.order_number + " → " + label(next));
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Update failed.");
    } finally {
      setBusy("");
    }
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Seller Centre · Orders</span>
              <h1>My orders</h1>
              <p>Pack and ship your parcels. Card payments are charged when you mark a parcel shipped.</p>
            </div>
          </header>
          <nav className={styles.adminOrderTabs}>
            {tabs.map((t) => (
              <button type="button" key={t.key} className={tab === t.key ? styles.active : ""} onClick={() => setTab(t.key)}>
                <span>{t.label}</span>
                <b>{counts[t.key] || 0}</b>
              </button>
            ))}
          </nav>
          {gateError || error ? <p className={styles.adminError}>{gateError || error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          <section className={styles.adminPanel}>
            {visible.length === 0 ? (
              <p>No orders here.</p>
            ) : (
              <table className={styles.sellerTable}>
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Items</th>
                    <th>Ship to</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((p) => {
                    const id = p.seller_order_id;
                    const a = p.shipping_address || {};
                    return (
                      <tr key={id}>
                        <td>
                          <strong>{p.order_number}</strong>
                          <small>{shopName(p.seller_id)}</small>
                          <small>{new Date(p.created_at).toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</small>
                          <small>{formatPrice(Number(p.subtotal))}</small>
                        </td>
                        <td>
                          {(items.get(id) || []).map((i, n) => (
                            <small key={n}>
                              {i.quantity} × {i.product_name}
                              {i.variant_name ? " · " + i.variant_name : ""} ({i.sku})
                            </small>
                          ))}
                          {p.customer_note ? <small>Note: {p.customer_note}</small> : null}
                        </td>
                        <td>
                          <small>
                            {a.full_name} · {a.phone}
                          </small>
                          <small>
                            {[a.address_line_1, a.address_line_2].filter(Boolean).join(", ")}
                          </small>
                          <small>
                            {a.postcode} {a.city}, {a.state}
                          </small>
                        </td>
                        <td>
                          <strong>{label(p.parcel_status)}</strong>
                          {p.tracking_number ? (
                            <small>
                              {p.courier_name} · {p.tracking_number}
                            </small>
                          ) : null}
                          {p.payment_status !== "paid" ? <small>Payment: {label(p.payment_status)}</small> : null}
                        </td>
                        <td>
                          {p.payment_status === "paid" && p.parcel_status === "paid" ? (
                            <button type="button" className={styles.adminAction} disabled={busy === id} onClick={() => void move(p, "processing")}>
                              Start processing
                            </button>
                          ) : null}
                          {p.parcel_status === "processing" ? (
                            <button type="button" className={styles.adminAction} disabled={busy === id} onClick={() => void move(p, "packed")}>
                              Mark packed
                            </button>
                          ) : null}
                          {p.payment_status === "paid" && ["paid", "processing", "packed"].includes(p.parcel_status) ? (
                            <div className={styles.sellerShip}>
                              <select
                                value={courier[id] ?? p.courier_name ?? ""}
                                onChange={(e) => setCourier((c) => ({ ...c, [id]: e.target.value }))}
                              >
                                <option value="">Courier</option>
                                <option value="Pos Laju">Pos Laju</option>
                                <option value="SPX Express">SPX Express</option>
                                <option value="J&T Express">J&T Express</option>
                              </select>
                              <input
                                placeholder="Tracking no."
                                value={tracking[id] ?? p.tracking_number ?? ""}
                                onChange={(e) => setTracking((t) => ({ ...t, [id]: e.target.value }))}
                              />
                              <button type="button" className={styles.adminSecondaryAction} disabled={busy === id} onClick={() => void move(p, "shipped")}>
                                Ship
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
