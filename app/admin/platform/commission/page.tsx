"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "../../Admin.module.css";
import { toLocalInput, usePlatformGate, when } from "../usePlatformGate";

type Shop = { id: string; shop_name: string; tier: string | null; status: string; commission_rate: number | null };
type Change = {
  id: string;
  seller_ids: string[] | null;
  rate: number;
  starts_at: string;
  ends_at: string | null;
  reason: string | null;
  status: string;
  campaign_id: string | null;
};

export default function PlatformCommissionPage() {
  const { ready, error: gateError } = usePlatformGate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [all, setAll] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const [rate, setRate] = useState("6");
  const [startsAt, setStartsAt] = useState(toLocalInput(new Date()));
  const [edit, setEdit] = useState<Record<string, string>>({});
  const [temporary, setTemporary] = useState(false);
  const [endsAt, setEndsAt] = useState(toLocalInput(new Date(Date.now() + 14 * 864e5)));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const { data, error: rpcError } = await createClient().rpc("platform_commission_overview");
    if (rpcError) return setError(rpcError.message);
    const value = (data || {}) as { shops: Shop[]; changes: Change[] };
    setShops(value.shops || []);
    setChanges(value.changes || []);
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function run(fn: () => PromiseLike<{ error: { message: string } | null }>, done: string) {
    setBusy(true);
    setError("");
    setMessage("");
    const { error: rpcError } = await fn();
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(done);
      await load();
    }
    setBusy(false);
  }

  const supabase = createClient();
  const name = (id: string) => shops.find((s) => s.id === id)?.shop_name || "shop";
  const sellerShops = shops.filter((s) => s.tier !== "direct" && s.status === "approved");

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Platform</span>
              <h1>Commission</h1>
              <p>Every change sends a notice to the shops it affects. To change a shop right away (including MIVO Direct or your own shop), type the new % in the table and press Set now. Scheduled changes below apply at their start time and temporary ones go back to the previous rate when they end; they never touch MIVO Direct.</p>
            </div>
            <button type="button" className={styles.adminSecondaryAction} disabled={busy} onClick={() => void run(() => supabase.rpc("mivo_apply_commission_changes"), "Due changes applied.")}>
              Apply due changes now
            </button>
          </header>
          {gateError || error ? <p className={styles.adminError}>{gateError || error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          <section className={styles.adminPanel}>
            <h2 className={styles.importStepTitle}>Current rates</h2>
            <table className={styles.sellerTable}>
              <thead><tr><th>Shop</th><th>Status</th><th>Commission</th><th>Change now</th></tr></thead>
              <tbody>
                {shops.map((s) => (
                  <tr key={s.id}>
                    <td>{s.shop_name}{s.tier === "direct" ? " (MIVO Direct)" : ""}</td>
                    <td>{s.status}</td>
                    <td><strong>{Number(s.commission_rate ?? 0)}%</strong></td>
                    <td>
                      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                        <input
                          type="number"
                          min="0"
                          max="50"
                          step="0.1"
                          aria-label={"New commission for " + s.shop_name}
                          style={{ width: 80, padding: "6px 8px", border: "1px solid #d9dcde", borderRadius: 8 }}
                          value={edit[s.id] ?? ""}
                          placeholder={String(Number(s.commission_rate ?? 0))}
                          onChange={(e) => setEdit({ ...edit, [s.id]: e.target.value })}
                        />
                        <button
                          type="button"
                          className={styles.adminSecondaryAction}
                          disabled={busy || edit[s.id] == null || edit[s.id] === ""}
                          onClick={() =>
                            void run(
                              () => supabase.rpc("platform_set_shop_commission", { p_seller_id: s.id, p_rate: Number(edit[s.id]), p_notify: true }),
                              s.shop_name + " is now " + Number(edit[s.id]) + "%."
                            ).then(() => setEdit((current) => ({ ...current, [s.id]: "" })))
                          }
                        >
                          Set now
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className={styles.adminPanel}>
            <h2 className={styles.importStepTitle}>Schedule a change</h2>
            <div className={styles.platformGrid}>
              <label className={styles.adminField}><span>New commission (%)</span><input type="number" min="0" max="50" step="0.1" value={rate} onChange={(e) => setRate(e.target.value)} /></label>
              <label className={styles.adminField}><span>Starts</span><input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
              <label className={styles.returnsCheck}><input type="checkbox" checked={temporary} onChange={(e) => setTemporary(e.target.checked)} /> Temporary (goes back afterwards)</label>
              {temporary ? <label className={styles.adminField}><span>Ends</span><input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label> : null}
            </div>
            <label className={styles.adminField} style={{ marginTop: 12 }}><span>Reason (shown to sellers)</span><input value={reason} onChange={(e) => setReason(e.target.value)} /></label>
            <label className={styles.returnsCheck} style={{ marginTop: 12 }}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> All shops</label>
            {!all ? (
              <div className={styles.platformChips} style={{ marginTop: 8 }}>
                {sellerShops.map((s) => (
                  <label key={s.id} className={styles.returnsCheck}>
                    <input type="checkbox" checked={chosen.includes(s.id)} onChange={(e) => setChosen((c) => (e.target.checked ? [...c, s.id] : c.filter((x) => x !== s.id)))} />
                    {s.shop_name} ({Number(s.commission_rate ?? 0)}%)
                  </label>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              className={styles.adminAction}
              style={{ marginTop: 14 }}
              disabled={busy || !rate || (!all && !chosen.length)}
              onClick={() =>
                void run(
                  () =>
                    supabase.rpc("platform_schedule_commission", {
                      p_seller_ids: all ? null : chosen,
                      p_rate: Number(rate),
                      p_starts_at: new Date(startsAt).toISOString(),
                      p_ends_at: temporary ? new Date(endsAt).toISOString() : null,
                      p_reason: reason,
                      p_campaign_id: null,
                    }),
                  "Scheduled. Sellers have been notified."
                )
              }
            >
              Schedule & notify sellers
            </button>
          </section>

          <section className={styles.adminPanel}>
            <h2 className={styles.importStepTitle}>Changes</h2>
            <table className={styles.sellerTable}>
              <thead><tr><th>Rate</th><th>Shops</th><th>When</th><th>Status</th><th /></tr></thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{Number(c.rate)}%</strong>{c.reason ? <small>{c.reason}</small> : null}</td>
                    <td><small>{c.seller_ids ? c.seller_ids.map(name).join(", ") : "All shops"}</small></td>
                    <td><small>{when(c.starts_at)}{c.ends_at ? " → " + when(c.ends_at) : " (permanent)"}</small></td>
                    <td><span className={styles.platformPill + (c.status === "done" || c.status === "cancelled" ? " " + styles.done : "")}>{c.status}</span></td>
                    <td>
                      {c.status === "scheduled" || c.status === "active" ? (
                        <button type="button" disabled={busy} onClick={() => void run(() => supabase.rpc("platform_cancel_commission", { p_id: c.id }), c.status === "active" ? "Ending now; previous rates return on the next run." : "Cancelled and sellers notified.")}>
                          {c.status === "active" ? "End now" : "Cancel"}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>
      </div>
    </main>
  );
}
