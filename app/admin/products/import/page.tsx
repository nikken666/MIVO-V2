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
import { applyPriceList, isPriceTable, parsePriceTables, type PriceList } from "@/lib/bigsellerPrices";
import {
  buildShopIndex,
  matchProducts,
  planPriceListOnly,
  planUpdate,
  productRef,
  variantRef,
  type ShopIndex,
  type ShopProduct,
  type ShopVariant,
  type VariantChange,
} from "@/lib/shopeeSync";
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
  // Pick what to import: unticked products, a search, a Shopee category, stock.
  const [unticked, setUnticked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [shopeeCat, setShopeeCat] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(true);
  const [maxStock, setMaxStock] = useState("");
  // Off (default): import every ticked product with its SKUs exactly as in
  // Shopee, even if the shop already has them (same SKU = shared stock).
  // On: leave out SKUs the shop already has.
  const [skipExisting, setSkipExisting] = useState(false);
  // BigSeller "Online products" file: discount prices (促销价) per Shopee option.
  const [priceList, setPriceList] = useState<PriceList | null>(null);
  const [priceSummary, setPriceSummary] = useState<{ files: string[]; rows: number; matched: number; discounted: number } | null>(null);
  // What the shop already has, so a second import updates instead of copying.
  const [shopIndex, setShopIndex] = useState<ShopIndex | null>(null);
  const [updateExisting, setUpdateExisting] = useState(true);
  const [updateStock, setUpdateStock] = useState(false);

  const [shopId, setShopId] = useState("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [defaultCategoryId, setDefaultCategoryId] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState(0);
  const [copyImages, setCopyImages] = useState(true);

  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
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

  // The chosen shop's products and options: SKUs (optional skip) and the
  // index used to update listings that were imported before.
  useEffect(() => {
    if (!shopId) return;
    let cancelled = false;
    setShopIndex(null);
    (async () => {
      const client = createClient();
      async function pages<T>(table: string, columns: string, fallback: string): Promise<T[]> {
        const out: T[] = [];
        let cols = columns;
        for (let from = 0; ; from += 1000) {
          const { data, error: pageError } = await client.from(table).select(cols).eq("seller_id", shopId).order("id").range(from, from + 999);
          if (pageError && cols !== fallback) {
            // Database without supabase/shopee-sync.sql: no external_ref column yet.
            cols = fallback;
            from -= 1000;
            continue;
          }
          if (pageError) break;
          out.push(...((data || []) as unknown as T[]));
          if (!data || data.length < 1000) break;
        }
        return out;
      }
      const [shopProducts, shopVariants] = await Promise.all([
        pages<ShopProduct>("products", "id, name, external_ref", "id, name"),
        pages<ShopVariant>(
          "product_variants",
          "id, product_id, sku, variation_1_value, variation_2_value, price, compare_at_price, stock_on_hand, external_ref",
          "id, product_id, sku, variation_1_value, variation_2_value, price, compare_at_price, stock_on_hand"
        ),
      ]);
      if (cancelled) return;
      setExistingSkus(new Set(shopVariants.map((v) => String(v.sku).toUpperCase())));
      setShopIndex(
        buildShopIndex(
          shopProducts.map((p) => ({ ...p, external_ref: p.external_ref ?? null })),
          shopVariants.map((v) => ({ ...v, external_ref: v.external_ref ?? null }))
        )
      );
    })();
    return () => {
      cancelled = true;
    };
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
      if (!tables.length) {
        throw new Error("Couldn't find any sheet in this file. Open it in Excel and Save As → Excel Workbook (.xlsx), or export CSV, then try again.");
      }
      // BigSeller price lists are read separately: they hold the discount price.
      const priceTables = tables.filter(isPriceTable);
      const parsed = parseShopeeTables(tables.filter((t) => !isPriceTable(t)));
      const prices = priceTables.length ? parsePriceTables(priceTables) : null;
      const applied = prices ? applyPriceList(parsed.products, prices) : null;
      setPriceList(prices);
      setPriceSummary(
        prices && applied
          ? { files: [...new Set(priceTables.map((t) => t.name.split(" › ")[0]))], rows: prices.rows, matched: applied.matched, discounted: applied.discounted }
          : null
      );
      setFiles(Array.from(list).map((f) => f.name));
      setProducts(parsed.products);
      setCategoryOverride({});
      setUnticked(new Set());
      setSearch("");
      setShopeeCat("");
      setUnrecognised(parsed.unrecognisedFiles);
      // Copying thousands of images from the browser is slow; keep Shopee's image links for big imports.
      if (parsed.products.length > 300) setCopyImages(false);
      if (!parsed.products.length && !prices) {
        // Show what the file's first rows contain, so the problem is visible.
        const sample = tables
          .map((table) => {
            const row = table.rows.slice(0, 10).find((r) => r.filter((c) => String(c ?? "").trim()).length >= 2) || [];
            const cells = row.map((c) => String(c ?? "").trim()).filter(Boolean).slice(0, 12);
            return table.name + ": " + (cells.length ? cells.join(" | ") : "(empty)");
          })
          .slice(0, 4)
          .join("\n");
        setError(
          "No products found. MIVO needs columns like Product Name, SKU, Price and Stock (Shopee Mass Update / Mass Upload file).\n\nWhat this file starts with:\n" +
            sample
        );
      }
    } catch (caught) {
      setError(describeError(caught) || "Unable to read the file.");
    }
  }

  const matches = useMemo(
    () => (updateExisting && shopIndex ? matchProducts(shopIndex, products) : new Map<string, ShopProduct>()),
    [updateExisting, shopIndex, products]
  );

  const plan = useMemo(
    () =>
      products.map((product) => {
        // Already in the shop (same Shopee Item ID, or same unique name): update it.
        const existing = matches.get(product.key) || null;
        if (existing && shopIndex) {
          const update = planUpdate(shopIndex, existing, product, { stock: updateStock });
          return { product, brandId: null, categoryId: "", skip: false, outOfStock: false, newVariants: [] as ImportProduct["variants"], existing, update };
        }
        const notInShop = skipExisting ? product.variants.filter((v) => !existingSkus.has(v.sku)) : product.variants;
        // Options with no stock aren't listed (stock not given counts as in stock).
        const newVariants = onlyInStock ? notInShop.filter((v) => v.stock == null || v.stock > 0) : notInShop;
        const brandId = guessBrandId(product, brands);
        const categoryId =
          categoryOverride[product.key] || guessCategoryId(product, categories) || defaultCategoryId;
        const skip = product.variants.length > 0 && notInShop.length === 0;
        const outOfStock = !skip && notInShop.length > 0 && newVariants.length === 0;
        return { product, brandId, categoryId, skip, outOfStock, newVariants, existing: null, update: null };
      }),
    [products, existingSkus, brands, categories, defaultCategoryId, categoryOverride, onlyInStock, skipExisting, shopIndex, updateStock, matches]
  );

  // Only a BigSeller file uploaded: update prices of options the shop already has.
  const priceOnly = useMemo(
    () => (!products.length && priceList && shopIndex ? planPriceListOnly(shopIndex, priceList) : null),
    [products.length, priceList, shopIndex]
  );

  const shopeeCategories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) {
      const leaf = (p.shopeeCategory.split("/").pop() || "").trim() || "(none)";
      counts.set(leaf, (counts.get(leaf) || 0) + 1);
    }
    return Array.from(counts).sort((a, b) => b[1] - a[1]);
  }, [products]);

  const shown = useMemo(() => {
    const words = search.toLowerCase().split(/\s+/).filter(Boolean);
    const cap = Number(maxStock);
    return plan.filter(({ product, skip }) => {
      if (skip) return false;
      const leaf = (product.shopeeCategory.split("/").pop() || "").trim() || "(none)";
      if (shopeeCat && leaf !== shopeeCat) return false;
      if (Number.isFinite(cap) && maxStock !== "" && product.variants.every((v) => (v.stock ?? 0) > cap)) return false;
      if (!words.length) return true;
      const hay = (product.name + " " + product.parentSku + " " + product.variants.map((v) => v.sku).join(" ")).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [plan, search, shopeeCat, maxStock]);

  const importable = plan.filter(
    (row) => !row.existing && !row.skip && !row.outOfStock && !row.product.errors.length && row.categoryId && !unticked.has(row.product.key)
  );
  const updatable = plan.filter(
    (row) => row.existing && row.update && !unticked.has(row.product.key) && (row.update.changes.length || row.update.productRef)
  );
  const updateCount = updatable.reduce((n, row) => n + (row.update?.changes.length || 0), 0);
  const inShopCount = plan.filter((row) => row.existing).length;
  const summary = {
    products: products.length,
    variants: products.reduce((n, p) => n + p.variants.length, 0),
    errors: plan.filter((row) => row.product.errors.length).length,
    skipped: plan.filter((row) => row.skip).length,
    upToDate: plan.filter((row) => row.existing && row.update && !row.update.changes.length && !row.update.productRef).length,
    noCategory: plan.filter((row) => !row.categoryId).length,
    outOfStock: plan.filter((row) => row.outOfStock).length,
    unticked: plan.filter((row) => unticked.has(row.product.key)).length,
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

  // Products already in the shop: price / original price / stock in batches.
  async function sendUpdates(changes: VariantChange[], products: Array<{ id: string; external_ref: string }>, label: string) {
    for (let i = 0; i < Math.max(changes.length, products.length); i += 500) {
      if (stopRef.current) break;
      const variants = changes.slice(i, i + 500);
      const refs = products.slice(i, i + 500);
      try {
        const response = await fetch("/api/admin/products/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId,
            variants: variants.map(({ id, price, compare_at_price, stock, external_ref }) => ({ id, price, compare_at_price, stock, external_ref })),
            products: refs,
          }),
        });
        const result = (await response.json().catch(() => ({}))) as { updated?: number; error?: string };
        if (!response.ok) throw new Error(result.error || "Update failed (" + response.status + ").");
        setLog((current) => [...current, { name: label, ok: true, detail: (result.updated ?? variants.length) + " option(s) updated" }]);
      } catch (caught) {
        setLog((current) => [...current, { name: label, ok: false, detail: describeError(caught) }]);
      }
      setDone((n) => n + Math.max(variants.length, refs.length ? 1 : 0));
    }
  }

  async function runPriceOnly() {
    if (!priceOnly?.changes.length) return;
    setRunning(true);
    stopRef.current = false;
    setDone(0);
    setTotal(priceOnly.changes.length);
    setLog([]);
    await sendUpdates(priceOnly.changes, [], "Prices from BigSeller");
    setRunning(false);
  }

  async function runImport() {
    if (!shopId) return setError("Choose a shop first.");
    setRunning(true);
    stopRef.current = false;
    setDone(0);
    setTotal(importable.length + updateCount);
    setLog([]);

    if (updatable.length) {
      const products = updatable
        .filter((row) => row.update?.productRef && row.existing)
        .map((row) => ({ id: row.existing!.id, external_ref: row.update!.productRef! }));
      await sendUpdates(updatable.flatMap((row) => row.update!.changes), products, "Products already in shop");
    }

    for (const row of importable) {
      if (stopRef.current) break;
      const { product, brandId, categoryId, newVariants } = row;
      try {
        const images = [];
        for (const url of product.images.slice(0, 9)) images.push(await copyImage(url));

        // The server writes the product (see /api/admin/products/import-one).
        const response = await fetch("/api/admin/products/import-one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            shopId,
            skipExisting,
            product: {
              category_id: categoryId,
              brand_id: brandId,
              name: product.name.trim(),
              slug: (slugify(product.name) || "product") + "-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
              description: product.description || null,
              primary_image_url: images[0] || null,
              warranty_months: warrantyMonths,
              variation_1_name: product.variation1Name,
              variation_2_name: product.variation2Name,
              status,
              external_ref: productRef(product.productId),
            },
            variants: newVariants.map((variant) => ({
              title: [variant.value1, variant.value2].filter(Boolean).join(" / ") || "Default",
              variation_1_value: variant.value1,
              variation_2_value: variant.value2,
              sku: variant.sku,
              price: variant.price ?? 0,
              compare_at_price: variant.compareAtPrice,
              external_ref: variantRef(variant.variationId),
              stock_on_hand: Math.max(0, Math.round(variant.stock ?? 0)),
              weight_kg: variant.weight ?? 0,
              length_cm: variant.length ?? 0,
              width_cm: variant.width ?? 0,
              height_cm: variant.height ?? 0,
              variant_image_url: variant.image,
            })),
            images,
          }),
        });
        const result = (await response.json().catch(() => ({}))) as { id?: string; error?: string; skipped?: boolean; reason?: string; leftOut?: number };
        if (response.ok && result.skipped) {
          setLog((current) => [...current, { name: product.name, ok: true, detail: "Skipped: " + (result.reason || "already in this shop") }]);
          setDone((n) => n + 1);
          continue;
        }
        if (!response.ok || !result.id) throw new Error(result.error || "Import failed (" + response.status + ").");

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

          {error ? <p role="alert" className={ui.timestamp} style={{ whiteSpace: "pre-wrap" }}>{error}</p> : null}
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
                <p className={ui.timestamp}>
                  Discount prices: add BigSeller&apos;s <b>Online products</b> export in the same upload. Its 促销价 becomes the
                  price and Shopee&apos;s price is shown struck through.
                </p>
                {priceSummary ? (
                  <p className={styles.importPriceNote}>
                    <b>BigSeller prices</b> · {priceSummary.files.join(", ")} · {priceSummary.rows} options
                    {products.length
                      ? ` · used for ${priceSummary.matched} Shopee options · ${priceSummary.discounted} get the discount price`
                      : ""}
                  </p>
                ) : null}
                {priceOnly ? (
                  <div className={styles.importPriceNote}>
                    <b>Only a BigSeller file:</b> {priceOnly.found} of its options are already in this shop ·{" "}
                    {priceOnly.changes.length} price(s) to change.
                    <div style={{ marginTop: 8 }}>
                      <button type="button" className={styles.importPrimary} disabled={running || !priceOnly.changes.length} onClick={() => void runPriceOnly()}>
                        {running ? "Updating…" : "Update " + priceOnly.changes.length + " prices"}
                      </button>
                    </div>
                    {priceOnly.found === 0 ? (
                      <small>
                        None matched yet. Upload the Shopee files together with this file once, so MIVO learns each
                        option&apos;s Shopee ID; after that a BigSeller file on its own is enough.
                      </small>
                    ) : null}
                  </div>
                ) : null}
                {priceOnly && (running || log.length) ? (
                  <p className={ui.timestamp}>{log.filter((l) => l.ok).map((l) => l.detail).join(" · ") || "Working…"}</p>
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
                    <div className={ui.card}>
                      <small>Already in shop</small>
                      <strong>{inShopCount}</strong>
                      <span>{updateExisting ? updateCount + " option price(s) to update · " + summary.upToDate + " up to date" : "Not updated"}</span>
                    </div>
                    <div className={ui.card}><small>Need attention</small><strong>{summary.errors + summary.noCategory}</strong><span>Errors or no category</span></div>
                  </div>
                  <div className={ui.toolbar} style={{ flexWrap: "wrap", alignItems: "end", margin: "12px 0" }}>
                    <label className={styles.adminField}><span>Search name or SKU</span>
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. Vios brake" disabled={running} />
                    </label>
                    <label className={styles.adminField}><span>Shopee category</span>
                      <select value={shopeeCat} onChange={(e) => setShopeeCat(e.target.value)} disabled={running}>
                        <option value="">All ({products.length})</option>
                        {shopeeCategories.map(([name, n]) => <option key={name} value={name}>{name} ({n})</option>)}
                      </select>
                    </label>
                    <label className={styles.adminField}><span>Hide stock above</span>
                      <input type="number" min="0" value={maxStock} onChange={(e) => setMaxStock(e.target.value)} placeholder="e.g. 9999" disabled={running} />
                    </label>
                    <label className={styles.importCheck}>
                      <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} disabled={running} />
                      Skip options with 0 stock
                    </label>
                    <label className={styles.importCheck}>
                      <input type="checkbox" checked={updateExisting} onChange={(e) => setUpdateExisting(e.target.checked)} disabled={running} />
                      Update products already in this shop (price{updateStock ? " + stock" : ""})
                    </label>
                    <label className={styles.importCheck}>
                      <input type="checkbox" checked={updateStock} onChange={(e) => setUpdateStock(e.target.checked)} disabled={running || !updateExisting} />
                      Also update their stock
                    </label>
                    <label className={styles.importCheck}>
                      <input type="checkbox" checked={skipExisting} onChange={(e) => setSkipExisting(e.target.checked)} disabled={running} />
                      Skip SKUs already in this shop{skipExisting ? " (" + summary.skipped + " hidden)" : ""}
                    </label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "0 0 10px" }}>
                    <button type="button" disabled={running} onClick={() => setUnticked((c) => { const n = new Set(c); shown.forEach((r) => n.delete(r.product.key)); return n; })}>
                      Tick all shown ({shown.length})
                    </button>
                    <button type="button" disabled={running} onClick={() => setUnticked((c) => { const n = new Set(c); shown.forEach((r) => n.add(r.product.key)); return n; })}>
                      Untick all shown
                    </button>
                    <button type="button" disabled={running} onClick={() => setUnticked(new Set(plan.map((r) => r.product.key)))}>
                      Untick everything
                    </button>
                    <small className={ui.timestamp} style={{ alignSelf: "center" }}>
                      {summary.unticked} unticked · {summary.outOfStock} out of stock
                    </small>
                  </div>
                  <div className={ui.tableWrap}>
                    <table className={ui.table}>
                      <thead><tr><th></th><th>Product</th><th>SKUS</th><th>Price</th><th>Stock</th><th>Brand</th><th>Category</th><th>Status</th></tr></thead>
                      <tbody>
                        {shown.slice(0, 300).map(({ product, brandId, categoryId, skip, outOfStock, existing, update }) => (
                          <tr key={product.key} style={unticked.has(product.key) ? { opacity: 0.5 } : undefined}>
                            <td>
                              {skip ? (
                                <small style={{ color: "#8a9095", whiteSpace: "nowrap" }}>In shop ✓</small>
                              ) : (
                              <input
                                type="checkbox"
                                aria-label={"Import " + product.name}
                                disabled={running}
                                checked={!skip && !unticked.has(product.key)}
                                onChange={(e) =>
                                  setUnticked((c) => {
                                    const n = new Set(c);
                                    if (e.target.checked) n.delete(product.key);
                                    else n.add(product.key);
                                    return n;
                                  })
                                }
                              />
                              )}
                            </td>
                            <td>{product.name || "—"}</td>
                            <td>{product.variants.map((v) => v.sku).join(", ")}</td>
                            <td>
                              {product.variants
                                .map((v) => (v.price ?? "?") + (v.compareAtPrice ? " (was " + v.compareAtPrice + ")" : ""))
                                .join(" / ")}
                            </td>
                            <td>{product.variants.map((v) => v.stock ?? "?").join(" / ")}</td>
                            <td>{brands.find((b) => b.id === brandId)?.name || "—"}</td>
                            <td>
                              {existing ? (
                                <small style={{ color: "#8a9095" }}>In shop</small>
                              ) : (
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
                              )}
                            </td>
                            <td>
                              {existing && update
                                ? update.changes.length
                                  ? "↻ Update " + update.changes.length + " option(s)" + (update.newOptions ? " · " + update.newOptions + " new option(s) not added" : "")
                                  : "✓ Up to date"
                                : product.errors.length
                                ? "❌ " + product.errors.join("; ")
                                : skip
                                  ? "↷ Already in shop"
                                  : outOfStock
                                    ? "⊘ Out of stock (skipped)"
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
                    {shown.length > 300 ? <p className={ui.timestamp}>Showing first 300 of {shown.length}. Use search or category to narrow it down.</p> : null}
                  </div>
                </section>
              ) : null}

              {products.length ? (
                <section className={styles.adminPanel}>
                  <h2 className={styles.importStepTitle}>4 · Import</h2>
                  <div className={styles.importActions}>
                    <button type="button" className={styles.importPrimary} disabled={running || (!importable.length && !updatable.length)} onClick={() => void runImport()}>
                      {running
                        ? "Working…"
                        : "Import " + importable.length + " new" + (updatable.length ? " + update " + updatable.length + " in shop" : "")}
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
                      <div className={styles.importProgress}><i style={{ width: (total ? (done / Math.max(1, total)) * 100 : 0) + "%" }} /></div>
                      <p className={ui.timestamp}>{done} / {total} processed · {log.length - failed} imported · {failed} failed</p>
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
