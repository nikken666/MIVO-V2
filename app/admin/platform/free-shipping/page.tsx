"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "../../Admin.module.css";
import { toLocalInput, usePlatformGate, when } from "../usePlatformGate";

type Promo = {
  id: string;
  name: string;
  starts_at: string;
  ends_at: string;
  min_spend: number | string;
  max_subsidy: number | string | null;
  active: boolean;
};

type Stats = { orders: number; subsidy: number };

/** Superadmin: MIVO-funded free shipping promotions (min spend, cap per order). */
export default function FreeShippingPage() {
  const { ready, error: gateError } = usePlatformGate();
  const [promos, setPromos] = useState<Promo[]>([]);
  const [stats, setStats] = useState<Record<string, Stats>>({});
  const [name, setName] = useState("");
  const [start, setStart] = useState(toLocalInput(new Date()));
  const [end, setEnd] = useState(toLocalInput(new Date(Date.now() + 7 * 86400000)));
  const [minSpend, setMinSpend] = useState("50");
  const [cap, setCap] = useState("8");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: loadError } = await supabase.rpc("platform_shipping_promotions");
    if (loadError) {
      setError(/platform_shipping_promotions/.test(loadError.message) ? "Run supabase/checkout-per-shop.sql first." : loadError.message);
      return;
    }
    const rows = (data as Promo[] | null) || [];
    setPromos(rows);
    if (rows.length) {
      const { data: orders } = await supabase
        .from("orders")
        .select("shipping_promotion_id, shipping_subsidy, payment_status")
        .in("shipping_promotion_id", rows.map((p) => p.id));
      const next: Record<string, Stats> = {};
      for (const o of (orders as Array<{ shipping_promotion_id: string; shipping_subsidy: number | string; payment_status: string }> | null) || []) {
        if (!["paid", "partially_refunded"].includes(o.payment_status)) continue;
        const s = (next[o.shipping_promotion_id] ||= { orders: 0, subsidy: 0 });
        s.orders += 1;
        s.subsidy += Number(o.shipping_subsidy || 0);
      }
      setStats(next);
    }
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function save() {
    setBusy(true);
    setError("");
    setMessage("");
    const { error: saveError } = await createClient().rpc("platform_save_shipping_promotion", {
      p_name: name,
      p_starts_at: new Date(start).toISOString(),
      p_ends_at: new Date(end).toISOString(),
      p_min_spend: Number(minSpend) || 0,
      p_max_subsidy: Number(cap) > 0 ? Number(cap) : null,
    });
    setBusy(false);
    if (saveError) setError(saveError.message);
    else {
      setMessage("Free shipping promotion saved.");
      setName("");
      await load();
    }
  }

  async function end_(id: string) {
    setBusy(true);
    const { error: endError } = await createClient().rpc("platform_end_shipping_promotion", { p_id: id });
    setBusy(false);
    if (endError) setError(endError.message);
    else await load();
  }

  const now = Date.now();

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Platform</span>
              <h1>Free shipping</h1>
              <p>
                MIVO pays the shipping, up to the cap per order, when an order reaches the minimum spend during the
                promotion. Buyers see &ldquo;Free shipping by MIVO&rdquo; at checkout and a nudge to reach the minimum.
              </p>
            </div>
          </header>

          {gateError ? <p role="alert">{gateError}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {message ? <p>{message}</p> : null}

          <section className={styles.adminPanel}>
            <h2>New promotion</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
              <label className={styles.adminField}>
                <span>Name</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="11.11 Free shipping" />
              </label>
              <label className={styles.adminField}>
                <span>Starts</span>
                <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className={styles.adminField}>
                <span>Ends</span>
                <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
              </label>
              <label className={styles.adminField}>
                <span>Minimum spend (RM)</span>
                <input type="number" min="0" step="1" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} />
              </label>
              <label className={styles.adminField}>
                <span>MIVO pays up to (RM per order, empty = all)</span>
                <input type="number" min="0" step="0.5" value={cap} onChange={(e) => setCap(e.target.value)} />
              </label>
            </div>
            <button type="button" className={styles.adminAction} disabled={busy || !name.trim()} onClick={() => void save()} style={{ marginTop: 12 }}>
              Start promotion
            </button>
          </section>

          <section className={styles.adminPanel}>
            <h2>Promotions</h2>
            {promos.length === 0 ? (
              <p>No free shipping promotions yet.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th>Name</th><th>When</th><th>Min spend</th><th>MIVO pays up to</th><th>Paid orders</th><th>Cost to MIVO</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {promos.map((p) => {
                    const running = p.active && new Date(p.starts_at).getTime() <= now && new Date(p.ends_at).getTime() > now;
                    return (
                      <tr key={p.id} style={{ borderTop: "1px solid #eee" }}>
                        <td>{p.name}{running ? " · running" : !p.active ? " · ended" : ""}</td>
                        <td>{when(p.starts_at)} → {when(p.ends_at)}</td>
                        <td>RM {Number(p.min_spend).toFixed(2)}</td>
                        <td>{p.max_subsidy != null ? "RM " + Number(p.max_subsidy).toFixed(2) : "All shipping"}</td>
                        <td>{stats[p.id]?.orders || 0}</td>
                        <td>RM {(stats[p.id]?.subsidy || 0).toFixed(2)}</td>
                        <td>
                          {p.active && new Date(p.ends_at).getTime() > now ? (
                            <button type="button" className={styles.adminSecondaryAction} disabled={busy} onClick={() => void end_(p.id)}>
                              End now
                            </button>
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
