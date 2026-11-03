"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import styles from "@/app/admin/Admin.module.css";
import { useMyShops } from "../SellerGate";

type Row = { id: string; name: string; slug: string; status: string; seller_id: string; primary_image_url: string | null };
type Variant = { product_id: string; price: number | string; stock_on_hand: number; stock_reserved: number };

export default function SellerProductsPage() {
  const { shops, error } = useMyShops();
  const [rows, setRows] = useState<Row[]>([]);
  const [variants, setVariants] = useState<Map<string, Variant[]>>(new Map());
  const [query, setQuery] = useState("");
  const [shopFilter, setShopFilter] = useState("");

  useEffect(() => {
    const ids = (shops || []).filter((s) => s.status === "approved").map((s) => s.id);
    if (!ids.length) return;
    (async () => {
      const supabase = createClient();
      const list: Row[] = [];
      for (let from = 0; from < 50000; from += 1000) {
        const { data } = await supabase
          .from("products")
          .select("id, name, slug, status, seller_id, primary_image_url")
          .in("seller_id", ids)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, from + 999);
        list.push(...((data || []) as Row[]));
        if (!data || data.length < 1000) break;
      }
      setRows(list);
      const map = new Map<string, Variant[]>();
      for (let i = 0; i < list.length; i += 300) {
        const { data: v } = await supabase
          .from("product_variants")
          .select("product_id, price, stock_on_hand, stock_reserved")
          .in("product_id", list.slice(i, i + 300).map((r) => r.id))
          .limit(5000);
        ((v || []) as Variant[]).forEach((x) => map.set(x.product_id, [...(map.get(x.product_id) || []), x]));
      }
      setVariants(map);
    })();
  }, [shops]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (!shopFilter || r.seller_id === shopFilter) && (!q || r.name.toLowerCase().includes(q)));
  }, [rows, query, shopFilter]);

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Seller Centre · Products</span>
              <h1>My products</h1>
              <p>{rows.length} products across your shops.</p>
            </div>
            <div className={styles.adminHeaderActions}>
              <a className={styles.adminSecondaryAction} href="/admin/products/import">Import from Shopee</a>
              <a className={styles.adminAction} href="/admin/products/new">+ Add product</a>
            </div>
          </header>
          {error ? <p className={styles.adminError}>{error}</p> : null}
          <div className={styles.adminOrderToolbar}>
            <label>
              <span>Search</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Product name" />
            </label>
            {(shops || []).length > 1 ? (
              <label>
                <span>Shop</span>
                <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
                  <option value="">All my shops</option>
                  {(shops || []).map((s) => (
                    <option key={s.id} value={s.id}>{s.shop_name}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <section className={styles.adminPanel}>
            <table className={styles.sellerTable}>
              <thead>
                <tr><th>Product</th><th>Shop</th><th>Price</th><th>Stock</th><th>Status</th><th /></tr>
              </thead>
              <tbody>
                {visible.map((r) => {
                  const v = variants.get(r.id) || [];
                  const prices = v.map((x) => Number(x.price));
                  const stock = v.reduce((s, x) => s + Math.max(0, x.stock_on_hand - x.stock_reserved), 0);
                  return (
                    <tr key={r.id}>
                      <td><strong>{r.name}</strong></td>
                      <td><small>{shops?.find((s) => s.id === r.seller_id)?.shop_name}</small></td>
                      <td>{prices.length ? "RM " + Math.min(...prices).toFixed(2) : "—"}</td>
                      <td>{stock}</td>
                      <td>{r.status}</td>
                      <td><a href={"/admin/products/" + r.id + "/edit"}>Edit</a></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </section>
      </div>
    </main>
  );
}
