"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "@/app/admin/Admin.module.css";
import { useMyShops } from "../SellerGate";

type Notice = {
  id: string;
  kind: string;
  title: string;
  body: string;
  campaign_id: string | null;
  created_at: string;
  is_read: boolean;
  invites: Array<{ seller_id: string; shop: string; status: string }>;
};

export default function SellerNoticesPage() {
  const { shops, error: gateError } = useMyShops();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const { data, error: rpcError } = await createClient().rpc("seller_notices");
    if (rpcError) {
      setError(/seller_notices/.test(rpcError.message) ? "Notices aren't turned on yet (supabase/platform.sql)." : rpcError.message);
      return;
    }
    const list = (data || []) as Notice[];
    setNotices(list);
    // Opening the page marks plain notices as read; invites stay unread until answered.
    const supabase = createClient();
    await Promise.all(
      list
        .filter((n) => !n.is_read && (n.kind !== "campaign_invite" || n.invites.every((i) => i.status !== "invited")))
        .map((n) => supabase.rpc("seller_mark_notice_read", { p_notice_id: n.id }))
    );
  }, []);

  useEffect(() => {
    if (shops?.length) void load();
  }, [shops, load]);

  async function respond(n: Notice, sellerId: string, accept: boolean) {
    setBusy(n.id + sellerId);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("seller_respond_campaign", {
      p_campaign_id: n.campaign_id,
      p_seller_id: sellerId,
      p_accept: accept,
    });
    if (rpcError) setError(rpcError.message);
    else {
      await supabase.rpc("seller_mark_notice_read", { p_notice_id: n.id });
      await load();
    }
    setBusy("");
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Seller Centre</span>
              <h1>MIVO notices</h1>
              <p>Announcements, commission changes and campaign invitations from MIVO.</p>
            </div>
          </header>
          {gateError || error ? <p className={styles.adminError}>{gateError || error}</p> : null}
          <section className={styles.adminPanel}>
            {notices.length === 0 ? <p>No notices yet.</p> : null}
            {notices.map((n) => (
              <div key={n.id} className={styles.platformItem}>
                <strong>
                  {!n.is_read ? <span className={styles.platformPill}>New</span> : null} {n.title}
                </strong>
                <small>
                  {new Date(n.created_at).toLocaleString("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} ·{" "}
                  {n.kind === "campaign_invite" ? "Campaign invitation" : n.kind === "commission_change" ? "Commission" : "Announcement"}
                </small>
                <p>{n.body}</p>
                {n.kind === "campaign_invite"
                  ? n.invites.map((i) => (
                      <div key={i.seller_id} className={styles.returnsRow} style={{ marginTop: 8, alignItems: "center" }}>
                        <span>{i.shop}:</span>
                        {i.status === "invited" ? (
                          <>
                            <button type="button" className={styles.adminAction} disabled={busy === n.id + i.seller_id} onClick={() => void respond(n, i.seller_id, true)}>
                              Accept
                            </button>
                            <button type="button" className={styles.adminSecondaryAction} disabled={busy === n.id + i.seller_id} onClick={() => void respond(n, i.seller_id, false)}>
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className={styles.platformPill + " " + (i.status === "accepted" ? styles.yes : styles.no)}>{i.status}</span>
                        )}
                      </div>
                    ))
                  : null}
              </div>
            ))}
          </section>
        </section>
      </div>
    </main>
  );
}
