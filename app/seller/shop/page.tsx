"use client";

import { useEffect, useState } from "react";
import PickupAddressEditor from "@/components/admin/PickupAddressEditor";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "@/app/admin/Admin.module.css";
import { useMyShops } from "../SellerGate";

const empty = { tagline: "", description: "", logo_url: "", banner_url: "", return_name: "", return_phone: "", return_address: "" };

export default function SellerShopSettingsPage() {
  const { shops, error: gateError } = useMyShops();
  const [shopId, setShopId] = useState("");
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (shops?.length && !shopId) setShopId(shops[0].id);
  }, [shops, shopId]);

  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const supabase = createClient();
      const [{ data: shop }, { data: ret }] = await Promise.all([
        supabase.from("sellers").select("tagline, description, logo_url, banner_url").eq("id", shopId).maybeSingle(),
        supabase.rpc("admin_get_shop_return_address", { p_id: shopId }),
      ]);
      const s = (shop || {}) as Record<string, string | null>;
      const r = (ret || {}) as Record<string, string | null>;
      setForm({
        tagline: s.tagline || "",
        description: s.description || "",
        logo_url: s.logo_url || "",
        banner_url: s.banner_url || "",
        return_name: r.name || "",
        return_phone: r.phone || "",
        return_address: r.address || "",
      });
    })();
  }, [shopId]);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const supabase = createClient();
    const a = await supabase.rpc("seller_save_shop", {
      p_id: shopId,
      p_tagline: form.tagline,
      p_description: form.description,
      p_logo_url: form.logo_url,
      p_banner_url: form.banner_url,
    });
    const b = await supabase.rpc("admin_save_shop_return_address", {
      p_id: shopId,
      p_name: form.return_name,
      p_phone: form.return_phone,
      p_address: form.return_address,
    });
    if (a.error || b.error) setError((a.error || b.error)!.message);
    else setMessage("Saved.");
    setBusy(false);
  }

  const field = (key: keyof typeof empty) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Seller Centre · Shop</span>
              <h1>Shop settings</h1>
              <p>Shop name, tier and commission are managed by MIVO. Ask in your notices if they need changing.</p>
            </div>
          </header>
          {gateError || error ? <p className={styles.adminError}>{gateError || error}</p> : null}
          {message ? <p className={styles.adminSuccess}>{message}</p> : null}
          <section className={styles.adminPanel}>
            {(shops || []).length > 1 ? (
              <label className={styles.adminField}>
                <span>Shop</span>
                <select value={shopId} onChange={(e) => setShopId(e.target.value)}>
                  {(shops || []).map((s) => <option key={s.id} value={s.id}>{s.shop_name}</option>)}
                </select>
              </label>
            ) : null}
            <form onSubmit={save} className={styles.sellerForm}>
              <label className={styles.adminField}><span>Tagline</span><input {...field("tagline")} /></label>
              <label className={styles.adminField}><span>About the shop</span><textarea rows={3} {...field("description")} /></label>
              <label className={styles.adminField}><span>Logo image URL</span><input {...field("logo_url")} /></label>
              <label className={styles.adminField}><span>Banner image URL</span><input {...field("banner_url")} /></label>
              <h2 className={styles.importStepTitle}>Return address</h2>
              <label className={styles.adminField}><span>Name</span><input {...field("return_name")} /></label>
              <label className={styles.adminField}><span>Phone</span><input {...field("return_phone")} /></label>
              <label className={styles.adminField}><span>Address (shown to customers on approved returns)</span><textarea rows={2} {...field("return_address")} /></label>
              <button type="submit" className={styles.adminAction} disabled={busy || !shopId}>{busy ? "Saving…" : "Save"}</button>
            </form>
            {shopId ? <PickupAddressEditor key={shopId} sellerId={shopId} /> : null}
          </section>
        </section>
      </div>
    </main>
  );
}
