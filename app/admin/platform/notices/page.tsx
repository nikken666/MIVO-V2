"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "../../Admin.module.css";
import { usePlatformGate, when } from "../usePlatformGate";

type Shop = { id: string; shop_name: string; tier: string | null; status: string };
type Sent = { id: string; kind: string; title: string; body: string; seller_ids: string[] | null; created_at: string; reads: number };

export default function PlatformNoticesPage() {
  const { ready, error: gateError } = usePlatformGate();
  const [shops, setShops] = useState<Shop[]>([]);
  const [sent, setSent] = useState<Sent[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [all, setAll] = useState(true);
  const [chosen, setChosen] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const [s, n] = await Promise.all([
      supabase.from("sellers").select("id, shop_name, tier, status").eq("status", "approved").order("shop_name"),
      supabase.rpc("platform_notices_sent"),
    ]);
    setShops(((s.data || []) as Shop[]).filter((x) => x.tier !== "direct"));
    setSent((n.data || []) as Sent[]);
  }, []);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  async function send() {
    setBusy(true);
    setError("");
    setMessage("");
    const { error: rpcError } = await createClient().rpc("platform_send_notice", {
      p_title: title,
      p_body: body,
      p_seller_ids: all ? null : chosen,
      p_kind: "info",
      p_campaign_id: null,
    });
    if (rpcError) setError(rpcError.message);
    else {
      setMessage("Notice sent.");
      setTitle("");
      setBody("");
      await load();
    }
    setBusy(false);
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Platform</span>
              <h1>Notices to sellers</h1>
              <p>Sellers see these in Seller Centre → MIVO notices. Commission changes and campaign invites send notices automatically.</p>
            </div>
          </header>
          {gateError || error ? <p className={styles.adminError}>{gateError || error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}

          <section className={styles.adminPanel}>
            <div className={styles.sellerForm}>
              <label className={styles.adminField}><span>Title</span><input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
              <label className={styles.adminField}><span>Message</span><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></label>
              <label className={styles.returnsCheck}><input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} /> All shops</label>
              {!all ? (
                <div className={styles.platformChips}>
                  {shops.map((s) => (
                    <label key={s.id} className={styles.returnsCheck}>
                      <input
                        type="checkbox"
                        checked={chosen.includes(s.id)}
                        onChange={(e) => setChosen((c) => (e.target.checked ? [...c, s.id] : c.filter((x) => x !== s.id)))}
                      />
                      {s.shop_name}
                    </label>
                  ))}
                </div>
              ) : null}
              <button type="button" className={styles.adminAction} disabled={busy || !title.trim() || !body.trim() || (!all && !chosen.length)} onClick={() => void send()}>
                Send notice
              </button>
            </div>
          </section>

          <section className={styles.adminPanel}>
            <h2 className={styles.importStepTitle}>Sent</h2>
            {sent.map((n) => (
              <div key={n.id} className={styles.platformItem}>
                <strong>{n.title}</strong>
                <small>
                  {when(n.created_at)} · {n.kind.replaceAll("_", " ")} · {n.seller_ids ? n.seller_ids.length + " shop(s)" : "all shops"} · read by {n.reads}
                </small>
                <p>{n.body}</p>
              </div>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}
