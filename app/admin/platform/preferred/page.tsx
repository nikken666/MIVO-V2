"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "../../Admin.module.css";
import { usePlatformGate, when } from "../usePlatformGate";

type Scorecard = {
  tier: string;
  open_since: string | null;
  orders_total: number;
  orders_completed: number;
  orders_cancelled: number;
  rating: number | null;
  reviews: number;
  products: number;
  returns: number;
};

type Request = {
  id: string;
  seller_id: string;
  shop_name: string;
  slug: string | null;
  status: "pending" | "approved" | "rejected";
  seller_note: string | null;
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
  scorecard: Scorecard;
};

/** Superadmin: Preferred Seller applications, with each shop's numbers. */
export default function PreferredSellersPage() {
  const { ready, error: gateError } = usePlatformGate();
  const [rows, setRows] = useState<Request[]>([]);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data, error: loadError } = await createClient().rpc("platform_tier_requests");
    if (loadError) {
      setError(/platform_tier_requests|schema cache/.test(loadError.message) ? "Run supabase/RUN-NEW.sql in Supabase first." : loadError.message);
      return;
    }
    setRows((data as Request[] | null) || []);
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function decide(r: Request, approve: boolean) {
    setBusy(r.id);
    setError("");
    setMessage("");
    const { error: rpcError } = await createClient().rpc("platform_review_tier_request", {
      p_id: r.id,
      p_approve: approve,
      p_note: notes[r.id] || null,
    });
    setBusy("");
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(approve ? r.shop_name + " is now a Preferred Seller." : r.shop_name + " was told why.");
      await load();
    }
  }

  async function removePreferred(r: Request) {
    setBusy(r.id);
    const { error: rpcError } = await createClient().rpc("platform_set_shop_tier", { p_seller_id: r.seller_id, p_tier: "standard" });
    setBusy("");
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(r.shop_name + " is back to Standard.");
      await load();
    }
  }

  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");

  const card = (r: Request) => {
    const s = r.scorecard;
    const rate = s.orders_total ? Math.round((s.orders_completed / s.orders_total) * 100) + "%" : "—";
    return (
      <div key={r.id} className={styles.platformItem}>
        <strong>
          {r.slug ? (
            <a href={"/shops/" + r.slug} target="_blank" rel="noreferrer">
              {r.shop_name} ↗
            </a>
          ) : (
            r.shop_name
          )}{" "}
          <span className={styles.platformPill + " " + (r.status === "approved" ? styles.yes : r.status === "rejected" ? styles.no : "")}>
            {r.status === "pending" ? "Waiting" : r.status}
          </span>
        </strong>
        <small>
          Applied {when(r.created_at)} · Open since {when(s.open_since)} · Now {s.tier}
        </small>
        <p>
          {s.orders_completed} completed / {s.orders_total} paid orders ({rate}) · {s.orders_cancelled} cancelled · {s.returns} returns ·{" "}
          {s.rating ? "★ " + Number(s.rating).toFixed(1) + " from " + s.reviews : "no reviews"} · {s.products} products
        </p>
        {r.seller_note ? <p>“{r.seller_note}”</p> : null}
        {r.admin_note ? <p>Your note: {r.admin_note}</p> : null}
        {r.status === "pending" ? (
          <>
            <label className={styles.adminField}>
              <span>Note to the seller (needed to reject)</span>
              <input value={notes[r.id] || ""} onChange={(e) => setNotes({ ...notes, [r.id]: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <button type="button" className={styles.adminAction} disabled={busy === r.id} onClick={() => void decide(r, true)}>
                Approve Preferred
              </button>
              <button type="button" className={styles.adminSecondaryAction} disabled={busy === r.id} onClick={() => void decide(r, false)}>
                Reject
              </button>
            </div>
          </>
        ) : r.status === "approved" && s.tier === "preferred" ? (
          <button type="button" className={styles.adminSecondaryAction} disabled={busy === r.id} onClick={() => void removePreferred(r)} style={{ marginTop: 8 }}>
            Remove Preferred
          </button>
        ) : null}
      </div>
    );
  };

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Platform</span>
              <h1>Preferred sellers</h1>
              <p>Shops ask for the Preferred badge from Seller Centre. Check their numbers, then approve or reject.</p>
            </div>
          </header>
          {gateError || error ? <p className={styles.adminError}>{gateError || error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}
          <section className={styles.adminPanel}>
            <h2>Waiting ({pending.length})</h2>
            {pending.length ? pending.map(card) : <p>No applications waiting.</p>}
          </section>
          {done.length ? (
            <section className={styles.adminPanel} style={{ marginTop: 16 }}>
              <h2>Decided</h2>
              {done.map(card)}
            </section>
          ) : null}
        </section>
      </div>
    </main>
  );
}
