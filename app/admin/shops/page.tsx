"use client";

import { useEffect, useMemo, useState } from "react";
import { leaveBackOffice } from "@/lib/leaveBackOffice";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";
import ui from "../store-health/StoreHealth.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

type Tier = "direct" | "preferred" | "standard";

type ShopRow = {
  id: string;
  shop_name: string;
  slug: string | null;
  tier: Tier;
  tagline: string | null;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  sort_order: number;
  status: string;
};

type ListingRow = { seller_id: string; stock_group: string | null };

const emptyForm = {
  id: null as string | null,
  shop_name: "",
  slug: "",
  tier: "standard" as Tier,
  tagline: "",
  description: "",
  logo_url: "",
  banner_url: "",
  sort_order: 100,
  return_name: "",
  return_phone: "",
  return_address: "",
};

const tierLabel: Record<Tier, string> = {
  direct: "MIVO Direct (official)",
  preferred: "Preferred",
  standard: "Standard",
};

const BATCH = 1000;

export default function AdminShopsPage() {
  const [shops, setShops] = useState<ShopRow[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const client = createClient();
      const { data: { user } } = await client.auth.getUser();
      if (!user) {
        window.location.assign("/login?next=/admin/shops");
        return;
      }
      const { data: isAdmin, error: adminError } = await client.rpc("is_admin");
      if (adminError) throw adminError;
      if (!isAdmin) {
        leaveBackOffice();
        return;
      }

      const { data, error: shopError } = await client
        .from("sellers")
        .select("id, shop_name, slug, tier, tagline, description, logo_url, banner_url, sort_order, status")
        .order("sort_order")
        .order("shop_name");
      if (shopError) {
        throw new Error(
          "Shop settings are not available yet. Run supabase/multi-shop-linked-stock.sql in Supabase first. (" +
            shopError.message + ")"
        );
      }
      setShops((data as ShopRow[] | null) || []);

      const rows: ListingRow[] = [];
      for (let from = 0; ; from += BATCH) {
        const { data: batch, error: variantError } = await client
          .from("product_variants")
          .select("seller_id, stock_group")
          .eq("is_active", true)
          .order("id")
          .range(from, from + BATCH - 1);
        if (variantError) throw variantError;
        rows.push(...((batch as ListingRow[] | null) || []));
        if (!batch || batch.length < BATCH) break;
      }
      setListings(rows);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load shops.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  // Load the saved return address when a shop is opened for editing.
  useEffect(() => {
    if (!form.id) return;
    const id = form.id;
    void createClient()
      .rpc("admin_get_shop_return_address", { p_id: id })
      .then(({ data }) => {
        const value = (data || {}) as { name?: string | null; phone?: string | null; address?: string | null };
        setForm((current) =>
          current.id === id
            ? { ...current, return_name: value.name || "", return_phone: value.phone || "", return_address: value.address || "" }
            : current
        );
      });
  }, [form.id]);

  // Linked stock overview: groups whose stock is shared by several shops.
  const linked = useMemo(() => {
    const shopsPerGroup = new Map<string, Set<string>>();
    for (const row of listings) {
      if (!row.stock_group) continue;
      const set = shopsPerGroup.get(row.stock_group) || new Set<string>();
      set.add(row.seller_id);
      shopsPerGroup.set(row.stock_group, set);
    }
    const shared = [...shopsPerGroup.values()].filter((set) => set.size > 1).length;
    return { groups: shopsPerGroup.size, shared };
  }, [listings]);

  const listingCount = (shopId: string) => listings.filter((row) => row.seller_id === shopId).length;

  // Approve a seller's application, or suspend a shop.
  async function setStatus(id: string, status: string) {
    setError("");
    setMessage("");
    const { error: statusError } = await createClient().rpc("admin_set_shop_status", { p_id: id, p_status: status });
    if (statusError) setError(statusError.message);
    else {
      setMessage(status === "approved" ? "Shop approved. The seller can now use Seller Centre." : "Shop " + status + ".");
      await load();
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const { error: saveError } = await createClient().rpc("admin_save_shop", {
        p_id: form.id,
        p_shop_name: form.shop_name,
        p_slug: form.slug || form.shop_name,
        p_tier: form.tier,
        p_tagline: form.tagline,
        p_description: form.description,
        p_logo_url: form.logo_url,
        p_banner_url: form.banner_url,
        p_sort_order: Number(form.sort_order) || 100,
      });
      if (saveError) throw saveError;
      // Return address (supabase/shop-return-address.sql). New shops get it on their next edit.
      if (form.id) {
        const { error: addressError } = await createClient().rpc("admin_save_shop_return_address", {
          p_id: form.id,
          p_name: form.return_name,
          p_phone: form.return_phone,
          p_address: form.return_address,
        });
        if (addressError && !/admin_save_shop_return_address/.test(addressError.message)) throw addressError;
      }
      setMessage(form.id ? "Shop updated." : "Shop created.");
      setForm(emptyForm);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save shop.");
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof emptyForm) => ({
    value: String(form[key] ?? ""),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value })),
  });

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO store control · Marketplace</span>
              <h1>Shops</h1>
              <p>Each shop packs and ships its own parcels. Listings with the same SKU in your own shops share one stock.</p>
            </div>
            <a className={styles.adminAction} href="/shops" target="_blank" rel="noreferrer">View shops ↗</a>
          </header>

          <section className={styles.adminPanel}>
            <div className={ui.cards}>
              <div className={ui.card}><small>Shops</small><strong>{loading ? "—" : shops.length}</strong><span>Approved and pending</span></div>
              <div className={ui.card}><small>Active listings</small><strong>{loading ? "—" : listings.length}</strong><span>Variants across all shops</span></div>
              <div className={ui.card}><small>Stock groups</small><strong>{loading ? "—" : linked.groups}</strong><span>Physical items (by SKU)</span></div>
              <div className={ui.card}><small>Shared stock</small><strong>{loading ? "—" : linked.shared}</strong><span>Items listed in 2+ shops</span></div>
            </div>

            {error ? <p role="alert">{error}</p> : null}
            {message ? <p>{message}</p> : null}

            <form onSubmit={save} className={ui.toolbar} style={{ flexWrap: "wrap", alignItems: "end" }}>
              <label className={styles.adminField}><span>Shop name</span><input required {...field("shop_name")} placeholder="e.g. MIVO Auto Parts KL" /></label>
              <label className={styles.adminField}><span>Link (slug)</span><input {...field("slug")} placeholder="mivo-auto-kl" /></label>
              <label className={styles.adminField}><span>Tier</span>
                <select {...field("tier")}>
                  {(Object.keys(tierLabel) as Tier[]).map((tier) => <option key={tier} value={tier}>{tierLabel[tier]}</option>)}
                </select>
              </label>
              <label className={styles.adminField}><span>Order</span><input type="number" {...field("sort_order")} /></label>
              <label className={styles.adminField}><span>Tagline</span><input {...field("tagline")} placeholder="Short line under the shop name" /></label>
              <label className={styles.adminField}><span>Logo URL</span><input {...field("logo_url")} placeholder="https://…" /></label>
              <label className={styles.adminField}><span>Banner URL</span><input {...field("banner_url")} placeholder="https://…" /></label>
              {form.id ? (
                <>
                  <label className={styles.adminField}><span>Return to (name)</span><input {...field("return_name")} placeholder="MIVO Returns" /></label>
                  <label className={styles.adminField}><span>Return phone</span><input {...field("return_phone")} placeholder="01X-XXXXXXX" /></label>
                  <label className={styles.adminField} style={{ minWidth: 320, flex: 1 }}><span>Return address (shown to customers on approved returns)</span><input {...field("return_address")} placeholder="Street, postcode, city, state" /></label>
                </>
              ) : null}
              <button type="submit" disabled={saving}>{saving ? "Saving…" : form.id ? "Update shop" : "Add shop"}</button>
              {form.id ? <button type="button" onClick={() => setForm(emptyForm)}>Cancel</button> : null}
            </form>

            {loading ? (
              <p>Loading shops…</p>
            ) : (
              <div className={ui.tableWrap}>
                <table className={ui.table}>
                  <thead><tr><th>Shop</th><th>Tier</th><th>Link</th><th>Listings</th><th>Status</th><th>Action</th></tr></thead>
                  <tbody>
                    {shops.map((shop) => (
                      <tr key={shop.id}>
                        <td>{shop.shop_name}</td>
                        <td>{tierLabel[shop.tier] || shop.tier}</td>
                        <td>{shop.slug ? <a href={"/shops/" + shop.slug} target="_blank" rel="noreferrer">/shops/{shop.slug}</a> : "—"}</td>
                        <td>{listingCount(shop.id)}</td>
                        <td>
                          {shop.status}
                          {shop.status !== "approved" ? (
                            <button type="button" className={styles.adminAction} style={{ marginLeft: 8 }} onClick={() => void setStatus(shop.id, "approved")}>
                              Approve
                            </button>
                          ) : shop.tier !== "direct" ? (
                            <button type="button" style={{ marginLeft: 8 }} onClick={() => void setStatus(shop.id, "suspended")}>
                              Suspend
                            </button>
                          ) : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() =>
                              setForm({
                                id: shop.id,
                                shop_name: shop.shop_name,
                                slug: shop.slug || "",
                                tier: shop.tier,
                                tagline: shop.tagline || "",
                                description: shop.description || "",
                                logo_url: shop.logo_url || "",
                                banner_url: shop.banner_url || "",
                                sort_order: shop.sort_order,
                                return_name: "",
                                return_phone: "",
                                return_address: "",
                              })
                            }
                          >
                            Edit
                          </button>{" "}
                          <a href={"/admin/products/new?shop=" + shop.id}>Add product</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}
