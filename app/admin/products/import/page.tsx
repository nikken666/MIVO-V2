"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { readXlsx } from "@/lib/xlsxReader";
import { getStaffAccess } from "@/lib/staff";
import {
  guessBrandId,
  guessCategoryId,
  parseCsv,
  parseShopeeTables,
  type Cell,
  type ImportProduct,
  type Table,
} from "@/lib/shopeeImport";
import styles from "../../Admin.module.css";
import ui from "../../store-health/StoreHealth.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

type Option = { id: string; name: string };
type CategoryRow = { id: string; name: string; parent_id: string | null };
type LogLine = { name: string; ok: boolean; detail: string };

// Supabase errors are plain objects, not Error instances: show all their parts.
function describeError(caught: unknown): string {
  const e = (caught || {}) as { message?: string; details?: string; hint?: string; code?: string };
  const message = e.message || String(caught);
  if (e.code === "23505" && /sku/i.test(message + (e.details || ""))) {
    return (
      "This SKU already exists in another shop and the database only allows each SKU once. " +
      "Run supabase/shopee-import-fix.sql in Supabase so the same SKU can be listed in several shops (shared stock)."
    );
  }
  if (e.code === "23502" && /primary_image_url/.test(message)) {
    return "No product image. Also upload Shopee's Media Info file so each product has images.";
  }
  return [message, e.details, e.hint, e.code ? "(" + e.code + ")" : ""].filter(Boolean).join(" · ");
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export default function ShopeeImportPage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState("");
  const [shops, setShops] = useState<Option[]>([]);
  const [brands, setBrands] = useState<Option[]>([]);
  const [categories, setCategories] = useState<Option[]>([]);
  const [error, setError] = useState("");

  const [files, setFiles] = useState<string[]>([]);
  const [products, setProducts] = useState<ImportProduct[]>([]);
  const [unrecognised, setUnrecognised] = useState<string[]>([]);
  const [existingSkus, setExistingSkus] = useState<Set<string>>(new Set());
  const [categoryOverride, setCategoryOverride] = useState<Record<string, string>>({});

  const [shopId, setShopId] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState(0);
  const [copyImages, setCopyImages] = useState(true);

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [log, setLog] = useState<LogLine[]>([]);
  const stopRef = useRef(false);

  // Admin check + reference data.
  useEffect(() => {
    (async () => {
      try {
        const client = createClient();
        const { data: { user } } = await client.auth.getUser();
        if (!user) {
          window.location.assign("/login?next=/admin/products/import");
          return;
        }
        const access = await getStaffAccess(client);
        if (!access.allowed) {
          window.location.assign("/sell");
          return;
        }
        setUserId(user.id);

        const [shopRes, brandRes, categoryRes] = await Promise.all([
          client.from("sellers").select("id, shop_name").eq("status", "approved").order("shop_name"),
          client.from("brands").select("id, name").eq("is_active", true).order("name"),
          client.from("categories").select("id, name, parent_id").eq("is_active", true).order("name"),
        ]);
        if (shopRes.error || brandRes.error || categoryRes.error) {
          throw shopRes.error || brandRes.error || categoryRes.error;
        }
        const shopList = ((shopRes.data || []) as Array<{ id: string; shop_name: string }>)
          .filter((s) => access.isAdmin || access.shopIds.includes(s.id))
          .map(
          (s) => ({ id: s.id, name: s.shop_name })
        );
        setShops(shopList);
        setShopId(shopList[0]?.id || "");
        setBrands((brandRes.data || []) as Option[]);

        // Products must sit in a final (leaf) category.
        const rows = (categoryRes.data || []) as CategoryRow[];
        const parents = new Set(rows.map((c) => c.parent_id).filter(Boolean));
        setCategories(rows.filter((c) => !parents.has(c.id)).map((c) => ({ id: c.id, name: c.name })));
        setReady(true);
      } catch (caught) {
        setError(describeError(caught) || "Unable to load import tool.");
      }
    })();
  }, []);

  // SKUs that already exist in the chosen shop are skipped (safe re-runs).
  useEffect(() => {
    if (!shopId) return;
    (async () => {
      const client = createClient();
      const skus = new Set<string>();
      for (let from = 0; ; from += 1000) {
        const { data, error: skuError } = await client
          .from("product_variants")
          .select("sku")
          .eq("seller_id", shopId)
          .order("id")
          .range(from, from + 999);
        if (skuError) break;
        for (const row of (data || []) as Array<{ sku: string }>) skus.add(String(row.sku).toUpperCase());
        if (!data || data.length < 1000) break;
      }
      setExistingSkus(skus);
    })();
  }, [shopId]);

  async function readFiles(list: FileList | null) {
    if (!list?.length) return;
    setError("");
    setLog([]);
    setDone(0);
    try {
      const tables: Table[] = [];
      for (const file of Array.from(list)) {
        if (/\.csv$/i.test(file.name)) {
          // Strip a UTF-8 byte-order mark so the first header still matches.
          tables.push({ name: file.name, rows: parseCsv((await file.text()).replace(/^\uFEFF/, "")) });
          continue;
        }
        if (/\.xls$/i.test(file.name)) {
          throw new Error(file.name + " is an old .xls file. Open it in Excel and save as .xlsx, or export CSV.");
        }
        try {
          const sheets = await readXlsx(await file.arrayBuffer());
          for (const sheet of sheets) {
            tables.push({ name: file.name + (sheets.length > 1 ? " › " + sheet.name : ""), rows: sheet.rows as Cell[][] });
          }
        } catch (caught) {
          throw new Error(file.name + ": " + (caught instanceof Error ? caught.message : String(caught)));
        }
      }
      const parsed = parseShopeeTables(tables);
      setFiles(Array.from(list).map((f) => f.name));
      setProducts(parsed.products);
      setCategoryOverride({});
      setUnrecognised(parsed.unrecognisedFiles);
      if (!parsed.products.length) {
        setError("No products found. Upload the product file exported from Shopee Seller Centre (Mass Update / Mass Upload).");
      }
    } catch (caught) {
      setError(describeError(caught) || "Unable to read the file.");
    }
  }

  const plan = useMemo(
    () =>
      products.map((product) => {
        const newVariants = product.variants.filter((v) => !existingSkus.has(v.sku));
        const brandId = guessBrandId(product, brands);
        const categoryId =
          categoryOverride[product.key] || guessCategoryId(product, categories) || defaultCategoryId;
        const skip = product.variants.length > 0 && newVariants.length === 0;
        return { product, brandId, categoryId, skip, newVariants };
      }),
    [products, existingSkus, brands, categories, defaultCategoryId, categoryOverride]
  );

  const importable = plan.filter((row) => !row.skip && !row.product.errors.length && row.categoryId);
  const summary = {
    products: products.length,
    variants: products.reduce((n, p) => n + p.variants.length, 0),
    errors: plan.filter((row) => row.product.errors.length).length,
    skipped: plan.filter((row) => row.skip).length,
    noCategory: plan.filter((row) => !row.categoryId).length,
  };

  async function copyImage(url: string): Promise<string> {
    if (!copyImages) return url;
    try {
      const response = await fetch(url);
      if (!response.ok) return url;
      const blob = await response.blob();
      const ext = (blob.type.split("/")[1] || "jpg").replace("jpeg", "jpg").slice(0, 5);
      const path = shopId + "/shopee-" + crypto.randomUUID() + "." + ext;
      const client = createClient();
      const { error: uploadError } = await client.storage
        .from("product-images")
        .upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
      if (uploadError) return url;
      return client.storage.from("product-images").getPublicUrl(path).data.publicUrl;
    } catch {
      return url; // CORS or network: keep the Shopee URL.
    }
  }

  async function runImport() {
    if (!shopId) return setError("Choose a shop first.");
    setRunning(true);
    stopRef.current = false;
    setDone(0);
    setLog([]);
    const client = createClient();

    for (const row of importable) {
      if (stopRef.current) break;
      const { product, brandId, categoryId, newVariants } = row;
      let productId: string | null = null;
      try {
        const images = [];
        for (const url of product.images.slice(0, 9)) images.push(await copyImage(url));

        const { data: created, error: productError } = await client
          .from("products")
          .insert({
            seller_id: shopId,
            category_id: categoryId,
            brand_id: brandId,
            name: product.name.trim(),
            slug: (slugify(product.name) || "product") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            short_description: null,
            description: product.description || null,
            primary_image_url: images[0] || null,
            warranty_months: warrantyMonths,
            variation_1_name: product.variation1Name,
            variation_2_name: product.variation2Name,
            is_universal_fitment: false,
            restricted_shipping_states: [],
            status,
            published_at: status === "active" ? new Date().toISOString() : null,
            created_by: userId,
          })
          .select("id")
          .single();
        if (productError) throw productError;
        productId = created.id;

        const { error: variantError } = await client.from("product_variants").insert(
          newVariants.map((variant, index) => ({
            product_id: created.id,
            seller_id: shopId,
            sort_order: index,
            title: [variant.value1, variant.value2].filter(Boolean).join(" / ") || "Default",
            variation_1_value: variant.value1,
            variation_2_value: variant.value2,
            sku: variant.sku,
            price: variant.price ?? 0,
            compare_at_price: null,
            stock_on_hand: Math.max(0, Math.round(variant.stock ?? 0)),
            stock_reserved: 0,
            low_stock_threshold: 5,
            weight_kg: variant.weight ?? 0,
            length_cm: variant.length ?? 0,
            width_cm: variant.width ?? 0,
            height_cm: variant.height ?? 0,
            variant_image_url: variant.image,
            is_active: true,
          }))
        );
        if (variantError) throw variantError;

        if (images.length) {
          const { error: imageError } = await client.from("product_images").insert(
            images.map((image_url, sort_order) => ({
              product_id: created.id,
              image_url,
              alt_text: product.name,
              sort_order,
            }))
          );
          if (imageError) throw imageError;
        }

        setLog((current) => [
          ...current,
          { name: product.name, ok: true, detail: newVariants.length + " SKU" + (newVariants.length === 1 ? "" : "s") },
        ]);
        setExistingSkus((current) => {
          const next = new Set(current);
          newVariants.forEach((v) => next.add(v.sku));
          return next;
        });
      } catch (caught) {
        // Roll back a half-created product so a re-run starts clean.
        if (productId) await client.from("products").delete().eq("id", productId);
        setLog((current) => [
          ...current,
          { name: product.name, ok: false, detail: describeError(caught) },
        ]);
      }
      setDone((n) => n + 1);
    }
    setRunning(false);
  }

  function downloadLog() {
    const csv = ["status,product,detail", ...log.map((l) => [l.ok ? "imported" : "failed", l.name, l.detail].map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "mivo-shopee-import-log.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const failed = log.filter((l) => !l.ok).length;

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO store control · Catalogue</span>
              <h1>Import from Shopee</h1>
              <p>Upload the product file(s) exported from Shopee Seller Centre. Same SKU in several shops shares one stock.</p>
            </div>
            <a className={styles.adminAction} href="/admin/products">All products</a>
          </header>

          {error ? <p role="alert" className={ui.timestamp}>{error}</p> : null}
          {!ready && !error ? <p>Loading…</p> : null}

          {ready ? (
            <>
              <section className={styles.adminPanel}>
                <h2 className={styles.importStepTitle}>1 · Choose shop and upload Shopee export</h2>
                <div className={ui.toolbar} style={{ alignItems: "end" }}>
                  <label className={styles.adminField}><span>Import into shop</span>
                    <select value={shopId} onChange={(e) => setShopId(e.target.value)} disabled={running}>
                      {shops.map((shop) => <option key={shop.id} value={shop.id}>{shop.name}</option>)}
                    </select>
                  </label>
                  <a className={styles.adminSecondary} href="/admin/shops">Manage shops</a>
                </div>
                <p className={ui.timestamp}>
                  Seller Centre → My Products → Mass Update (or Mass Upload) → download the product file(s).
                  You can select several files at once (e.g. basic info, sales info, media info); rows are joined by Product ID.
                </p>
                <label className={styles.importDrop}>
                  <input type="file" accept=".xlsx,.xls,.csv" multiple onChange={(e) => void readFiles(e.target.files)} disabled={running} />
                  <strong>{files.length ? files.join(", ") : "Choose .xlsx / .csv files"}</strong>
                  <small>Your files stay in this browser until you press Import.</small>
                </label>
                {unrecognised.length ? (
                  <p className={ui.timestamp}>Not a product file (ignored): {unrecognised.join(", ")}</p>
                ) : null}
              </section>

              {products.length ? (
                <section className={styles.adminPanel}>
                  <h2 className={styles.importStepTitle}>2 · Settings</h2>
                  <div className={ui.toolbar} style={{ flexWrap: "wrap", alignItems: "end" }}>
                    <label className={styles.adminField}><span>Status</span>
                      <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "active")} disabled={running}>
                        <option value="draft">Draft (review first)</option>
                        <option value="active">Live immediately</option>
                      </select>
                    </label>
                    <label className={styles.adminField}><span>Category when not detected</span>
                      <select value={defaultCategoryId} onChange={(e) => setDefaultCategoryId(e.target.value)} disabled={running}>
                        <option value="">— Skip products without a category —</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </label>
                    <label className={styles.adminField}><span>Warranty (months)</span>
                      <input type="number" min={0} value={warrantyMonths} onChange={(e) => setWarrantyMonths(Number(e.target.value) || 0)} disabled={running} />
                    </label>
                    <label className={styles.importCheck}>
                      <input type="checkbox" checked={copyImages} onChange={(e) => setCopyImages(e.target.checked)} disabled={running} />
                      Copy images into MIVO storage (keeps them if Shopee removes the listing)
                    </label>
                  </div>
                </section>
              ) : null}

              {products.length ? (
                <section className={styles.adminPanel}>
                  <h2 className={styles.importStepTitle}>3 · Preview</h2>
                  <div className={ui.cards}>
                    <div className={ui.card}><small>Products</small><strong>{summary.products}</strong><span>{summary.variants} SKUs</span></div>
                    <div className={ui.card}><small>Ready to import</small><strong>{importable.length}</strong><span>New to this shop</span></div>
                    <div className={ui.card}><small>Already in shop</small><strong>{summary.skipped}</strong><span>Skipped (same SKU)</span></div>
                    <div className={ui.card}><small>Need attention</small><strong>{summary.errors + summary.noCategory}</strong><span>Errors or no category</span></div>
                  </div>
                  <div className={ui.tableWrap}>
                    <table className={ui.table}>
                      <thead><tr><th>Product</th><th>SKUS</th><th>Price</th><th>Brand</th><th>Category</th><th>Status</th></tr></thead>
                      <tbody>
                        {plan.slice(0, 300).map(({ product, brandId, categoryId, skip }) => (
                          <tr key={product.key}>
                            <td>{product.name || "—"}</td>
                            <td>{product.variants.map((v) => v.sku).join(", ")}</td>
                            <td>{product.variants.map((v) => v.price ?? "?").join(" / ")}</td>
                            <td>{brands.find((b) => b.id === brandId)?.name || "—"}</td>
                            <td>
                              <select
                                className={styles.importRowSelect}
                                value={categoryId}
                                disabled={running}
                                onChange={(e) =>
                                  setCategoryOverride((current) => ({ ...current, [product.key]: e.target.value }))
                                }
                              >
                                <option value="">— Choose —</option>
                                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </td>
                            <td>
                              {product.errors.length
                                ? "❌ " + product.errors.join("; ")
                                : skip
                                  ? "↷ Already in shop"
                                  : !categoryId
                                    ? "⚠ No category"
                                    : product.warnings.length
                                      ? "⚠ " + product.warnings.join("; ")
                                      : "✓ Ready"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {plan.length > 300 ? <p className={ui.timestamp}>Showing first 300 of {plan.length}.</p> : null}
                  </div>
                </section>
              ) : null}

              {products.length ? (
                <section className={styles.adminPanel}>
                  <h2 className={styles.importStepTitle}>4 · Import</h2>
                  <div className={styles.importActions}>
                    <button type="button" className={styles.importPrimary} disabled={running || !importable.length} onClick={() => void runImport()}>
                      {running ? "Importing…" : "Import " + importable.length + " products"}
                    </button>
                    {running ? <button type="button" onClick={() => { stopRef.current = true; }}>Stop</button> : null}
                    {log.length ? <button type="button" onClick={downloadLog}>Download log</button> : null}
                    {!running && log.some((l) => l.ok) ? (
                      <a className={styles.adminAction} href="/admin/products/fitment-suggestions">Review vehicle fitment →</a>
                    ) : null}
                  </div>
                  {!running && !importable.length && summary.noCategory ? (
                    <p className={ui.timestamp}>
                      {summary.noCategory} product(s) have no category. Pick one per row in the preview, or set
                      “Category when not detected” in Settings.
                    </p>
                  ) : null}
                  {running || log.length ? (
                    <>
                      <div className={styles.importProgress}><i style={{ width: (importable.length ? (done / Math.max(1, importable.length)) * 100 : 0) + "%" }} /></div>
                      <p className={ui.timestamp}>{done} / {importable.length} processed · {log.length - failed} imported · {failed} failed</p>
                      {failed ? (
                        <ul className={styles.importErrors}>
                          {log.filter((l) => !l.ok).slice(0, 50).map((l, i) => <li key={i}><b>{l.name}</b> — {l.detail}</li>)}
                        </ul>
                      ) : null}
                    </>
                  ) : null}
                </section>
              ) : null}
            </>
          ) : null}
        </section>
      </div>
    </main>
  );
}
