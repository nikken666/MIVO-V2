"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { formatPrice } from "@/data/products";
import styles from "../../Admin.module.css";
import { toLocalInput, usePlatformGate, when } from "../usePlatformGate";

type Campaign = {
  id: string;
  name: string;
  description: string | null;
  voucher_code: string;
  starts_at: string;
  ends_at: string;
  funding: "platform" | "shared";
  platform_share_pct: number;
  commission_bump_rate: number | null;
  status: string;
};
type Row = { campaign: Campaign; participants: Array<{ seller_id: string; shop: string; status: string }> };
type Settlement = { shop_name: string; participation: string; orders: number; discount: number; seller_pays: number; mivo_pays: number };

export default function PlatformCampaignsPage() {
  const { ready, error: gateError } = usePlatformGate();
  const [rows, setRows] = useState<Row[]>([]);
  const [vouchers, setVouchers] = useState<Array<{ code: string; name: string }>>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    voucher: "",
    starts: toLocalInput(new Date(Date.now() + 3 * 864e5)),
    ends: toLocalInput(new Date(Date.now() + 10 * 864e5)),
    funding: "platform" as "platform" | "shared",
    share: "50",
    bump: false,
    bumpRate: "8",
  });
  const [open, setOpen] = useState<string | null>(null);
  const [settlement, setSettlement] = useState<Settlement[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [c, v] = await Promise.all([
      supabase.rpc("platform_campaigns_overview"),
      supabase.from("vouchers").select("code, name").eq("is_active", true).order("created_at", { ascending: false }),
    ]);
    if (c.error) setError(c.error.message);
    setRows((c.data || []) as Row[]);
    setVouchers((v.data || []) as Array<{ code: string; name: string }>);
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  useEffect(() => {
    if (!open) return;
    void createClient()
      .rpc("campaign_settlement", { p_campaign_id: open })
      .then(({ data }) => setSettlement((data || []) as Settlement[]));
  }, [open]);

  async function create() {
    setBusy(true);
    setError("");
    setMessage("");
    const { error: rpcError } = await createClient().rpc("platform_create_campaign", {
      p_name: form.name,
      p_description: form.description,
      p_voucher_code: form.voucher,
      p_starts_at: new Date(form.starts).toISOString(),
      p_ends_at: new Date(form.ends).toISOString(),
      p_funding: form.funding,
      p_platform_share_pct: form.funding === "shared" ? Number(form.share) : 100,
      p_commission_bump_rate: form.funding === "platform" && form.bump ? Number(form.bumpRate) : null,
      p_seller_ids: null,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage(
        form.funding === "shared"
          ? "Campaign created. Invitations sent to sellers — they can accept or reject in Seller Centre."
          : form.bump
            ? "Campaign created. Temporary commission scheduled and sellers notified."
            : "Campaign created and sellers notified."
      );
      await load();
    }
    setBusy(false);
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value }));

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Platform</span>
              <h1>Platform campaigns</h1>
              <p>
                Link a campaign to a voucher (create it first in Marketing → Vouchers) and choose who pays the discount.
                Shared campaigns invite sellers to accept or reject; shops that don&rsquo;t accept pay nothing.
              </p>
            </div>
          </header>
          {gateError || error ? <p className={styles.adminError}>{gateError || error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          <section className={styles.adminPanel}>
            <h2 className={styles.importStepTitle}>New campaign</h2>
            <div className={styles.platformGrid}>
              <label className={styles.adminField}><span>Name</span><input value={form.name} onChange={set("name")} placeholder="11.11 Mega Sale" /></label>
              <label className={styles.adminField}>
                <span>Voucher</span>
                <select value={form.voucher} onChange={set("voucher")}>
                  <option value="">Choose a voucher</option>
                  {vouchers.map((v) => <option key={v.code} value={v.code}>{v.code} — {v.name}</option>)}
                </select>
              </label>
              <label className={styles.adminField}><span>Starts</span><input type="datetime-local" value={form.starts} onChange={set("starts")} /></label>
              <label className={styles.adminField}><span>Ends</span><input type="datetime-local" value={form.ends} onChange={set("ends")} /></label>
              <label className={styles.adminField}>
                <span>Who pays the discount</span>
                <select value={form.funding} onChange={set("funding")}>
                  <option value="platform">MIVO pays everything</option>
                  <option value="shared">Shared with sellers (they accept or reject)</option>
                </select>
              </label>
              {form.funding === "shared" ? (
                <label className={styles.adminField}><span>MIVO pays (%)</span><input type="number" min="0" max="99" value={form.share} onChange={set("share")} /></label>
              ) : (
                <>
                  <label className={styles.returnsCheck}><input type="checkbox" checked={form.bump} onChange={set("bump")} /> Raise commission during the campaign</label>
                  {form.bump ? <label className={styles.adminField}><span>Campaign commission (%)</span><input type="number" min="0" max="50" step="0.1" value={form.bumpRate} onChange={set("bumpRate")} /></label> : null}
                </>
              )}
            </div>
            <label className={styles.adminField} style={{ marginTop: 12 }}><span>Description (shown to sellers)</span><textarea rows={2} value={form.description} onChange={set("description")} /></label>
            <button type="button" className={styles.adminAction} style={{ marginTop: 14 }} disabled={busy || !form.name.trim() || !form.voucher} onClick={() => void create()}>
              Create & notify sellers
            </button>
          </section>

          <section className={styles.adminPanel}>
            <h2 className={styles.importStepTitle}>Campaigns</h2>
            {rows.map(({ campaign: c, participants }) => {
              const accepted = participants.filter((p) => p.status === "accepted").length;
              return (
                <div key={c.id} className={styles.platformItem}>
                  <strong>
                    {c.name} · {c.voucher_code}{" "}
                    <span className={styles.platformPill + (c.status === "cancelled" || new Date(c.ends_at) < new Date() ? " " + styles.done : "")}>
                      {c.status === "cancelled" ? "cancelled" : new Date(c.ends_at) < new Date() ? "ended" : new Date(c.starts_at) > new Date() ? "upcoming" : "live"}
                    </span>
                  </strong>
                  <small>
                    {when(c.starts_at)} → {when(c.ends_at)} ·{" "}
                    {c.funding === "platform"
                      ? "MIVO pays 100%" + (c.commission_bump_rate != null ? " · commission " + c.commission_bump_rate + "% during campaign" : "")
                      : "MIVO " + c.platform_share_pct + "% / seller " + (100 - c.platform_share_pct) + "% · " + accepted + " of " + participants.length + " shops accepted"}
                  </small>
                  {c.funding === "shared" ? (
                    <div className={styles.platformChips} style={{ marginTop: 6 }}>
                      {participants.map((p) => (
                        <span key={p.seller_id} className={styles.platformPill + " " + (p.status === "accepted" ? styles.yes : p.status === "rejected" ? styles.no : "")}>
                          {p.shop}: {p.status}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <div className={styles.returnsRow} style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)}>{open === c.id ? "Hide" : "Settlement"}</button>
                    {c.status === "active" && new Date(c.ends_at) > new Date() ? (
                      <button type="button" disabled={busy} onClick={() => void createClient().rpc("platform_cancel_campaign", { p_id: c.id }).then(() => load())}>
                        Cancel campaign
                      </button>
                    ) : null}
                  </div>
                  {open === c.id ? (
                    <table className={styles.sellerTable} style={{ marginTop: 8 }}>
                      <thead><tr><th>Shop</th><th>Joined</th><th>Orders</th><th>Discount</th><th>Seller pays</th><th>MIVO pays</th></tr></thead>
                      <tbody>
                        {settlement.length === 0 ? <tr><td colSpan={6}>No paid orders with this voucher yet.</td></tr> : null}
                        {settlement.map((s) => (
                          <tr key={s.shop_name}>
                            <td>{s.shop_name}</td><td>{s.participation}</td><td>{s.orders}</td>
                            <td>{formatPrice(Number(s.discount))}</td><td>{formatPrice(Number(s.seller_pays))}</td><td>{formatPrice(Number(s.mivo_pays))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : null}
                </div>
              );
            })}
          </section>
        </section>
      </div>
    </main>
  );
}
