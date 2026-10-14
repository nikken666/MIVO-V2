"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../../Admin.module.css";
import ui from "./Unmatched.module.css";

type SKU = { id: string; product_id: string; sku: string; title: string; is_active: boolean };
type Product = { id: string; name: string; status: string; is_universal_fitment: boolean; primary_image_url: string | null };
type Match = { product_id: string; variant_id: string | null };
type MissingSKU = SKU & { product: Product };

const PAGE_SIZE = 500;

export default function UnmatchedSkuPage() {
  const [rows, setRows] = useState<MissingSKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<"all" | "active" | "draft">("all");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) { window.location.href = "/login?next=/admin/products/unmatched"; return; }
      const { data: admin, error: adminError } = await supabase.rpc("is_admin");
      if (adminError) throw adminError;
      if (!admin) { window.location.href = "/admin"; return; }

      async function allPages<T>(table: string, columns: string) {
        const result: T[] = [];
        for (let start = 0; ; start += PAGE_SIZE) {
          const { data, error: pageError } = await supabase.from(table)
            .select(columns).order("id").range(start, start + PAGE_SIZE - 1);
          if (pageError) throw pageError;
          const batch = (data || []) as T[];
          result.push(...batch);
          if (batch.length < PAGE_SIZE) break;
        }
        return result;
      }

      const [products, variants, matches] = await Promise.all([
        allPages<Product>("products", "id,name,status,is_universal_fitment,primary_image_url"),
        allPages<SKU>("product_variants", "id,product_id,sku,title,is_active"),
        allPages<Match>("product_vehicle_fitments", "product_id,variant_id"),
      ]);
      const byProduct = new Map(products.map(p => [p.id, p]));
      const allSkuProducts = new Set(matches.filter(m => m.variant_id === null).map(m => m.product_id));
      const matchedSkuIds = new Set(matches.filter(m => m.variant_id !== null).map(m => m.variant_id));
      const missing: MissingSKU[] = [];
      for (const variant of variants) {
        const product = byProduct.get(variant.product_id);
        if (!product || product.is_universal_fitment || allSkuProducts.has(product.id) || matchedSkuIds.has(variant.id)) continue;
        missing.push({ ...variant, product });
      }
      missing.sort((a,b) => a.product.name.localeCompare(b.product.name) || a.sku.localeCompare(b.sku));
      setRows(missing);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to load unmatched SKUs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const shown = useMemo(() => rows.filter(row => {
    if (scope === "active" && row.product.status !== "active") return false;
    if (scope === "draft" && row.product.status === "active") return false;
    const needle = search.trim().toLowerCase();
    return !needle || [row.product.name,row.sku,row.title].join(" ").toLowerCase().includes(needle);
  }), [rows,scope,search]);
  const unmatchedProducts = new Set(rows.map(r => r.product_id)).size;

  function downloadCsv() {
    const quote = (s: string) => '"' + s.replaceAll('"','""') + '"';
    const content = [["Product","SKU","Variation","Status"],...shown.map(r => [r.product.name,r.sku,r.title,r.product.status])]
      .map(line => line.map(quote).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF",content], { type:"text/csv;charset=utf-8" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = "mivo-unmatched-skus.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return <main className={styles.adminShell}>
    <div className={styles.adminWorkspace}>
      <aside className={styles.adminSidebar}>
        <a href="/admin" className={styles.adminBrand}><span>MIVO</span><small>STORE CONTROL</small></a>
        <nav className={styles.adminSideNav}>
          <a href="/admin">Dashboard</a>
          <a href="/admin/orders">Orders</a>
          <a href="/admin/products">Products</a>
          <a href="/admin/products/unmatched" className={styles.active}>Unmatched SKU</a>
          <a href="/admin/products/new">Add Product</a>
        </nav>
      </aside>
      <section className={styles.adminContent}>
        <header className={styles.adminHeader}>
          <div><span className={styles.adminEyebrow}>CATALOGUE · VEHICLE MATCHING</span>
            <h1>Unmatched SKU</h1>
            <p>Find every SKU without any compatible vehicle assigned. Whole-product matching and universal products are counted as matched.</p>
          </div>
          <div className={styles.adminHeaderActions}>
            <a href="/admin/products" className={styles.adminAction}>ALL PRODUCTS</a>
          </div>
        </header>
        <section className={`${styles.adminPanel} ${ui.panel}`}>
          <div className={ui.stats}>
            <div><small>UNMATCHED SKU</small><h2>{loading ? "—" : rows.length}</h2></div>
            <div><small>AFFECTED PRODUCTS</small><h2>{loading ? "—" : unmatchedProducts}</h2></div>
          </div>
          <div className={ui.filters}>
            <label className={`${styles.adminField} ${ui.searchField}`}><span>SEARCH SKU OR PRODUCT</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search SKU, variation, model..." />
            </label>
            <label className={styles.adminField}><span>PRODUCT STATUS</span>
              <select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}>
                <option value="all">All products</option><option value="active">Live only</option><option value="draft">Unpublished only</option>
              </select>
            </label>
            <button className={ui.secondaryButton} type="button" onClick={()=>void load()}>REFRESH</button>
            <button className={ui.secondaryButton} type="button" onClick={downloadCsv} disabled={!shown.length}>EXPORT CSV</button>
          </div>
          {error && <p role="alert" style={{color:"#c22"}}>{error}</p>}
          {loading ? <p>Checking product variants and vehicle matches...</p> :
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <thead><tr><th>PRODUCT</th><th>SKU</th><th>VARIATION</th><th>STATUS</th><th>ACTION</th></tr></thead>
              <tbody>{shown.map(row=><tr key={row.id}>
                <td className={ui.productCell}>{row.product.name}</td>
                <td className={ui.skuCell}>{row.sku}</td>
                <td>{row.title || "Default"}</td>
                <td>{row.product.status}</td>
                <td><a className={ui.matchLink} href={"/admin/products/"+row.product_id+"/edit#fitment"}>MATCH VEHICLE</a></td>
              </tr>)}</tbody>
            </table>
            {!shown.length && <p style={{padding:20}}>{rows.length ? "No SKUs match the filters." : "All SKUs have vehicle matching, or are universal."}</p>}
          </div>}
        </section>
      </section>
    </div>
  </main>;
}
