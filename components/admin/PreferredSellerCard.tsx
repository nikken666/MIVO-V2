"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/admin/Admin.module.css";

type Status = {
  tier: string;
  open_since: string | null;
  orders_total: number;
  orders_completed: number;
  orders_cancelled: number;
  rating: number | null;
  reviews: number;
  products: number;
  returns: number;
  request: { status: "pending" | "approved" | "rejected"; admin_note: string | null; created_at: string; reviewed_at: string | null } | null;
};

/** Seller Centre: apply for the Preferred Seller badge; MIVO's superadmin decides. */
export default function PreferredSellerCard({ sellerId }: { sellerId: string }) {
  const [data, setData] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    const { data: status, error: loadError } = await createClient().rpc("seller_tier_status", { p_seller_id: sellerId });
    if (loadError) {
      setUnavailable(/seller_tier_status|schema cache|does not exist/i.test(loadError.message));
      if (!/seller_tier_status|schema cache|does not exist/i.test(loadError.message)) setError(loadError.message);
      return;
    }
    setData(status as Status);
  }, [sellerId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function apply() {
    setBusy(true);
    setError("");
    const { error: applyError } = await createClient().rpc("seller_request_preferred", { p_seller_id: sellerId, p_note: note });
    setBusy(false);
    if (applyError) setError(applyError.message);
    else {
      setNote("");
      await load();
    }
  }

  if (unavailable) return null;
  if (!data) return null;

  const req = data.request;
  const completionRate = data.orders_total ? Math.round((data.orders_completed / data.orders_total) * 100) : null;

  return (
    <section className={styles.adminPanel} style={{ marginTop: 16 }}>
      <h2 className={styles.importStepTitle}>Preferred Seller</h2>
      {data.tier === "preferred" ? (
        <p className={styles.adminSuccess}>⭐ Your shop is a Preferred Seller. Buyers see the Preferred badge on your shop and products.</p>
      ) : data.tier === "direct" ? (
        <p>This is MIVO Direct.</p>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", color: "#5f656a", fontSize: 13 }}>
            Preferred shops get a badge that buyers trust. MIVO looks at completed orders, cancellations, ratings and how you handle
            returns. Apply when you&apos;re ready; MIVO replies here and in MIVO notices.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10, margin: "0 0 14px" }}>
            {[
              ["Completed orders", String(data.orders_completed)],
              ["Completion rate", completionRate == null ? "—" : completionRate + "%"],
              ["Rating", data.rating ? "★ " + Number(data.rating).toFixed(1) + " (" + data.reviews + ")" : "No reviews yet"],
              ["Active products", String(data.products)],
              ["Returns", String(data.returns)],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: 12, border: "1px solid #eceef0", borderRadius: 12, background: "#fafbfc" }}>
                <small style={{ color: "#8a9095", fontSize: 12 }}>{label}</small>
                <strong style={{ display: "block", fontSize: 18 }}>{value}</strong>
              </div>
            ))}
          </div>
          {req?.status === "pending" ? (
            <p className={styles.adminNotice}>
              Your application was sent on {new Date(req.created_at).toLocaleDateString("en-MY", { dateStyle: "medium" })}. MIVO is
              reviewing it.
            </p>
          ) : (
            <>
              {req?.status === "rejected" ? (
                <p className={styles.adminError}>
                  Last application wasn&apos;t approved{req.admin_note ? ": " + req.admin_note : "."} You can apply again 14 days after
                  the decision.
                </p>
              ) : null}
              <label className={styles.adminField}>
                <span>Why should your shop be Preferred? (optional)</span>
                <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Genuine parts only, ships within 24 hours, 5 years on Shopee." />
              </label>
              <button type="button" className={styles.adminAction} disabled={busy} onClick={() => void apply()} style={{ marginTop: 10 }}>
                {busy ? "Sending…" : "Apply for Preferred Seller"}
              </button>
            </>
          )}
          {error ? <p className={styles.adminError}>{error}</p> : null}
        </>
      )}
    </section>
  );
}
