"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { leaveBackOffice } from "@/lib/leaveBackOffice";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "../../Admin.module.css";

type Row = {
  id: string;
  name: string;
  slug: string;
  seller_id: string;
  status: string;
  is_universal_fitment: boolean;
  fitment_verified?: boolean;
};

/**
 * Other shops' fitment lists, waiting for a MIVO check. Verified parts show
 * "MIVO-verified fitment" to shoppers; the rest show "Seller-listed fitment".
 */
export default function FitmentReviewPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [shops, setShops] = useState<Map<string, { name: string; tier: string }>>(new Map());
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [tab, setTab] = useState<"todo" | "verified">("todo");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: shopRows } = await supabase.from("sellers").select("id, shop_name, tier");
    const shopMap = new Map(
      ((shopRows || []) as Array<{ id: string; shop_name: string; tier: string | null }>).map((s) => [
        s.id,
        { name: s.shop_name, tier: s.tier || "standard" },
      ])
    );
    setShops(shopMap);
    const otherShops = [...shopMap.entries()].filter(([, s]) => s.tier !== "direct").map(([id]) => id);
    if (!otherShops.length) {
      setRows([]);
      return;
    }
    let products: { data: unknown[] | null; error: { message: string } | null } = await supabase
      .from("products")
      .select("id, name, slug, seller_id, status, is_universal_fitment, fitment_verified")
      .in("seller_id", otherShops)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (products.error) {
      setError("Run supabase/fitment-verification.sql in Supabase to turn on fitment verification.");
      products = await supabase
        .from("products")
        .select("id, name, slug, seller_id, status, is_universal_fitment")
        .in("seller_id", otherShops)
        .order("created_at", { ascending: false })
        .limit(1000);
    }
    const list = (products.data || []) as Row[];
    const ids = list.map((r) => r.id);
    const c = new Map<string, number>();
    for (let i = 0; i < ids.length; i += 300) {
      for (let from = 0; ; from += 1000) {
        const { data } = await supabase
          .from("product_vehicle_fitments")
          .select("product_id")
          .in("product_id", ids.slice(i, i + 300))
          .order("id")
          .range(from, from + 999);
        for (const r of (data || []) as Array<{ product_id: string }>) c.set(r.product_id, (c.get(r.product_id) || 0) + 1);
        if (!data || data.length < 1000) break;
      }
    }
    setCounts(c);
    // Only parts that list vehicles (or are universal) need a check.
    setRows(list.filter((r) => r.is_universal_fitment || c.has(r.id)));
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login?next=/admin/products/fitment-review";
        return;
      }
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (!isAdmin) {
        leaveBackOffice();
        return;
      }
      await load();
      setLoading(false);
    })();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (tab === "verified" ? r.fitment_verified : !r.fitment_verified) &&
        (!q || (r.name + " " + (shops.get(r.seller_id)?.name || "")).toLowerCase().includes(q))
    );
  }, [rows, tab, query, shops]);

  async function setVerified(row: Row, verified: boolean) {
    setBusy(row.id);
    setError("");
    const { error: rpcError } = await createClient().rpc("admin_set_fitment_verified", {
      p_product_id: row.id,
      p_verified: verified,
    });
    if (rpcError) setError(rpcError.message);
    else setRows((current) => current.map((r) => (r.id === row.id ? { ...r, fitment_verified: verified } : r)));
    setBusy("");
  }

  const todo = rows.filter((r) => !r.fitment_verified).length;

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Products · Vehicle fitment</span>
              <h1>Fitment review</h1>
              <p>
                Other shops list which cars their parts fit. Check the list (open the product), then mark it verified.
                Shoppers see <b>MIVO-verified fitment</b> only after this; otherwise <b>Seller-listed fitment</b>.
                If the shop edits the vehicle list later, it goes back to this queue.
              </p>
            </div>
          </header>

          <nav className={styles.adminOrderTabs}>
            <button type="button" className={tab === "todo" ? styles.active : ""} onClick={() => setTab("todo")}>
              <span>To check</span>
              <b>{todo}</b>
            </button>
            <button type="button" className={tab === "verified" ? styles.active : ""} onClick={() => setTab("verified")}>
              <span>Verified</span>
              <b>{rows.length - todo}</b>
            </button>
          </nav>
          <div className={styles.adminOrderToolbar}>
            <label>
              <span>Search</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product or shop" />
            </label>
          </div>
          {error ? <p className={styles.adminError}>{error}</p> : null}

          <section className={styles.adminPanel}>
            {loading ? (
              <p>Loading…</p>
            ) : visible.length === 0 ? (
              <p>Nothing here.</p>
            ) : (
              <table className={styles.fitReviewTable}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Shop</th>
                    <th>Vehicles listed</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {visible.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.name}</strong>
                        <small>{row.status}</small>
                      </td>
                      <td>{shops.get(row.seller_id)?.name || "—"}</td>
                      <td>{row.is_universal_fitment ? "Universal" : counts.get(row.id) || 0}</td>
                      <td className={styles.fitReviewActions}>
                        <a href={"/admin/products/" + row.id + "/edit#fitment"} target="_blank" rel="noreferrer">
                          Check list ↗
                        </a>
                        {row.fitment_verified ? (
                          <button type="button" className={styles.adminSecondaryAction} disabled={busy === row.id} onClick={() => void setVerified(row, false)}>
                            Remove verification
                          </button>
                        ) : (
                          <button type="button" className={styles.adminAction} disabled={busy === row.id} onClick={() => void setVerified(row, true)}>
                            Mark verified
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
