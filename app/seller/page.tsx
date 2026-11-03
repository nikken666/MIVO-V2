"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "@/app/admin/Admin.module.css";
import { useMyShops } from "./SellerGate";

const statusText: Record<string, string> = {
  approved: "Open",
  pending: "Waiting for MIVO approval",
  suspended: "Suspended by MIVO",
  rejected: "Not approved",
};

export default function SellerHomePage() {
  const { shops, error } = useMyShops();
  const [stats, setStats] = useState({ toShip: 0, returns: 0, chats: 0 });

  useEffect(() => {
    if (!shops?.length) return;
    (async () => {
      const supabase = createClient();
      const [parcels, returns, chats] = await Promise.all([
        supabase.rpc("seller_parcels", { p_seller_id: null }),
        supabase.from("return_requests").select("id", { count: "exact", head: true }).in("status", ["requested", "returning"]),
        supabase.from("chat_conversations").select("seller_unread").gt("seller_unread", 0),
      ]);
      setStats({
        toShip: ((parcels.data || []) as Array<{ parcel_status: string; payment_status: string }>).filter(
          (p) => p.payment_status === "paid" && ["paid", "processing", "packed"].includes(p.parcel_status)
        ).length,
        returns: returns.count || 0,
        chats: ((chats.data || []) as Array<{ seller_unread: number }>).reduce((s, c) => s + c.seller_unread, 0),
      });
    })();
  }, [shops]);

  const open = (shops || []).filter((s) => s.status === "approved");

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Seller Centre</span>
              <h1>Welcome back</h1>
              <p>Everything here is for your own shops only.</p>
            </div>
            {open.length ? <a className={styles.adminAction} href="/admin/products/new">+ Add product</a> : null}
          </header>
          {error ? <p className={styles.adminError}>{error}</p> : null}

          <div className={styles.sellerStats}>
            <a href="/seller/orders"><span>To ship</span><strong>{stats.toShip}</strong></a>
            <a href="/seller/returns"><span>Returns to handle</span><strong>{stats.returns}</strong></a>
            <a href="/seller/chat"><span>Unread chats</span><strong>{stats.chats}</strong></a>
          </div>

          <section className={styles.adminPanel}>
            <h2 className={styles.importStepTitle}>My shops</h2>
            <div className={styles.sellerShops}>
              {(shops || []).map((shop) => (
                <div key={shop.id} className={styles.sellerShop}>
                  <span className={styles.adminMeAvatar}>
                    {shop.logo_url ? <img src={shop.logo_url} alt="" /> : shop.shop_name.slice(0, 1)}
                  </span>
                  <span>
                    <strong>{shop.shop_name}</strong>
                    <small>
                      {statusText[shop.status] || shop.status}
                      {shop.commission_rate != null ? " · Commission " + Number(shop.commission_rate) + "%" : ""}
                    </small>
                  </span>
                  {shop.status === "approved" && shop.slug ? (
                    <a href={"/shops/" + shop.slug} target="_blank" rel="noreferrer">View ↗</a>
                  ) : null}
                </div>
              ))}
            </div>
            <p className={styles.adminNotice}>
              Want another shop? <a href="/sell">Apply here</a> — MIVO reviews new shops before they open.
            </p>
          </section>
        </section>
      </div>
    </main>
  );
}
