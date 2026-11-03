"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { leaveBackOffice } from "@/lib/leaveBackOffice";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";

type ProductVariantRow = {
  id: string;
  sort_order: number;
  title: string | null;
  variation_1_value: string | null;
  variation_2_value: string | null;
  sku: string;
  price: number | string;
  stock_on_hand: number;
  stock_reserved: number;
  low_stock_threshold: number;
  weight_kg: number | string | null;
  length_cm: number | string | null;
  width_cm: number | string | null;
  height_cm: number | string | null;
  discount_enabled?: boolean | null;
  discount_percent?: number | string | null;
  discount_starts_at?: string | null;
  discount_ends_at?: string | null;
};

type ProductImageRow = {
  id: string;
  image_url: string;
  sort_order: number;
};

type ProductRow = {
  id: string;
  seller_id: string;
  name: string;
  slug: string;
  status: string;
  short_description: string | null;
  description: string | null;
  primary_image_url: string | null;
  created_at: string;
  brands: { name: string } | Array<{ name: string }> | null;
  product_images: ProductImageRow[] | null;
  product_variants: ProductVariantRow[] | null;
};

type BulkImageDraft = {
  key: string;
  id: string | null;
  url: string;
  file: File | null;
};

type BulkVariantDraft = {
  id: string;
  label: string;
  sku: string;
  price: string;
  stock: string;
  stockReserved: number;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

type BulkEditRow = {
  productId: string;
  sellerId: string;
  name: string;
  shortDescription: string;
  description: string;
  images: BulkImageDraft[];
  originalImageIds: string[];
  variants: BulkVariantDraft[];
};

function relationName(
  value:
    | { name?: string; shop_name?: string }
    | Array<{ name?: string; shop_name?: string }>
    | null
) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name || row?.shop_name || "—";
}

type CatalogTab = "live" | "soldout" | "draft" | "delisted";

/** Which status tab a product belongs to (BigSeller-style: on sale / sold out / draft / delisted). */
function tabOf(product: { status: string; product_variants: ProductVariantRow[] | null }): CatalogTab {
  if (product.status === "active") {
    const stock = (product.product_variants || []).reduce((sum, v) => sum + availableStock(v), 0);
    return stock > 0 ? "live" : "soldout";
  }
  return product.status === "draft" ? "draft" : "delisted";
}

function onPromotion(variant: ProductVariantRow) {
  if (!variant.discount_enabled || !Number(variant.discount_percent)) return false;
  const now = Date.now();
  if (variant.discount_starts_at && new Date(variant.discount_starts_at).getTime() > now) return false;
  if (variant.discount_ends_at && new Date(variant.discount_ends_at).getTime() < now) return false;
  return true;
}

function availableStock(variant: ProductVariantRow) {
  return Math.max(
    0,
    Number(variant.stock_on_hand || 0) - Number(variant.stock_reserved || 0)
  );
}

function variantLabel(variant: ProductVariantRow) {
  return (
    variant.title?.trim() ||
    [variant.variation_1_value, variant.variation_2_value]
      .filter(Boolean)
      .join(" / ") ||
    "Default"
  );
}

function priceSummary(variants: ProductVariantRow[]) {
  if (variants.length === 0) return "—";

  const prices = variants.map((item) => Number(item.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);

  return min === max
    ? "RM " + min.toFixed(2)
    : "RM " + min.toFixed(2) + " – RM " + max.toFixed(2);
}

function safeFileName(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return cleaned || "product-image";
}

function storagePathFromUrl(url: string) {
  const marker = "/storage/v1/object/public/product-images/";
  const index = url.indexOf(marker);
  if (index < 0) return "";
  return decodeURIComponent(url.slice(index + marker.length));
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("live");
  // BigSeller-style filters.
  const [searchField, setSearchField] = useState<"all" | "name" | "sku">("all");
  const [dateRange, setDateRange] = useState<"all" | "today" | "yesterday" | "7" | "30">("all");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [promoFilter, setPromoFilter] = useState<"all" | "yes" | "no">("all");
  const [sortBy, setSortBy] = useState<"new" | "old" | "priceAsc" | "priceDesc" | "stockAsc" | "stockDesc" | "name">("new");
  // MIVO's own shops only (sellers' products live in their Seller Centre).
  const [myShops, setMyShops] = useState<Array<{ id: string; name: string; tier: string | null }>>([]);
  const [shopFilter, setShopFilter] = useState("all");
  const [bulkStatusBusy, setBulkStatusBusy] = useState(false);
  // Pagination (big catalogues).
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [pageInput, setPageInput] = useState("1");
  const [liveTab, setLiveTab] = useState<"all" | "restock">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [quickEditId, setQuickEditId] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [quickStock, setQuickStock] = useState("");
  const [savingVariantId, setSavingVariantId] = useState("");
  const [productActionId, setProductActionId] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState("");
  const [draggedVariant, setDraggedVariant] = useState<{
    productId: string;
    variantId: string;
  } | null>(null);
  const [savingVariantOrderProductId, setSavingVariantOrderProductId] =
    useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(
    new Set()
  );
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkEditRows, setBulkEditRows] = useState<BulkEditRow[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkImageEditorId, setBulkImageEditorId] = useState("");
  const [bulkDescriptionEditorId, setBulkDescriptionEditorId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStatus = params.get("status");
    const requestedStock = params.get("stock");

    if (requestedStatus === "draft") {
      setCatalogTab("draft");
    } else if (requestedStatus && requestedStatus !== "active") {
      setCatalogTab("delisted");
    } else if (requestedStatus === "active") {
      setCatalogTab("live");
    }

    if (requestedStock === "low") {
      setCatalogTab("live");
      setLiveTab("restock");
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login?next=/admin/products";
          return;
        }

        const { data: isAdmin, error: adminError } =
          await supabase.rpc("is_admin");

        if (adminError) throw adminError;

        if (!isAdmin) {
          leaveBackOffice();
          return;
        }

        // MIVO's shops: the ones this account owns, plus MIVO Direct.
        const [{ data: owned }, { data: direct }] = await Promise.all([
          supabase.rpc("seller_my_shops"),
          supabase.from("sellers").select("id, shop_name, tier").eq("tier", "direct"),
        ]);
        const shopMap = new Map<string, { id: string; name: string; tier: string | null }>();
        for (const row of [
          ...(((direct as Array<{ id: string; shop_name: string; tier: string | null }> | null) || [])),
          ...(((owned as Array<{ id: string; shop_name: string; tier: string | null }> | null) || [])),
        ]) {
          shopMap.set(row.id, { id: row.id, name: row.shop_name, tier: row.tier });
        }
        const shopList = Array.from(shopMap.values()).sort(
          (a, b) => Number(b.tier === "direct") - Number(a.tier === "direct") || a.name.localeCompare(b.name)
        );
        setMyShops(shopList);
        const shopIds = shopList.map((shop) => shop.id);

        // Supabase returns at most 1000 rows per request: page through them,
        // otherwise big catalogues (e.g. a Shopee import) look incomplete.
        const all: unknown[] = [];
        let productError: { message: string } | null = null;
        for (let from = 0; shopIds.length && from < 50000; from += 1000) {
          const page = await supabase
            .from("products")
            .select(
              "id, seller_id, name, slug, status, short_description, description, primary_image_url, created_at, brands(name), product_images(id, image_url, sort_order), product_variants(id, sort_order, title, variation_1_value, variation_2_value, sku, price, stock_on_hand, stock_reserved, low_stock_threshold, weight_kg, length_cm, width_cm, height_cm, discount_enabled, discount_percent, discount_starts_at, discount_ends_at)"
            )
            .in("seller_id", shopIds)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, from + 999);
          if (page.error) {
            productError = page.error;
            break;
          }
          all.push(...(page.data || []));
          if (!page.data || page.data.length < 1000) break;
        }
        const data = all;

        if (productError) throw productError;

        const rows = ((data as ProductRow[] | null) || []).map(
          (product) => ({
            ...product,
            product_images: (product.product_images || [])
              .slice()
              .sort(
                (a, b) =>
                  Number(a.sort_order || 0) -
                  Number(b.sort_order || 0)
              ),
            product_variants: (product.product_variants || [])
              .slice()
              .sort(
                (a, b) =>
                  Number(a.sort_order || 0) -
                  Number(b.sort_order || 0)
              ),
          })
        );
        setProducts(rows);
        setExpanded(
          new Set(
            rows
              .filter((product) => (product.product_variants || []).length <= 8)
              .map((product) => product.id)
          )
        );
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load products."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const restockCount = useMemo(
    () =>
      products.filter((product) => {
        if (product.status !== "active") return false;
        const variants = product.product_variants || [];
        return variants.some(
          (variant) =>
            availableStock(variant) <=
            Number(variant.low_stock_threshold || 0)
        );
      }).length,
    [products]
  );

  const tabCounts = useMemo(() => {
    const counts: Record<CatalogTab, number> = { live: 0, soldout: 0, draft: 0, delisted: 0 };
    for (const product of products) {
      if (shopFilter !== "all" && product.seller_id !== shopFilter) continue;
      counts[tabOf(product)] += 1;
    }
    return counts;
  }, [products, shopFilter]);

  const shopCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const product of products) {
      if (tabOf(product) === catalogTab) counts.set(product.seller_id, (counts.get(product.seller_id) || 0) + 1);
    }
    return counts;
  }, [products, catalogTab]);
  const shopName = (id: string) => myShops.find((shop) => shop.id === id)?.name || "";

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const from =
      dateRange === "today"
        ? dayStart.getTime()
        : dateRange === "yesterday"
          ? dayStart.getTime() - 86400000
          : dateRange === "7"
            ? Date.now() - 7 * 86400000
            : dateRange === "30"
              ? Date.now() - 30 * 86400000
              : 0;
    const to = dateRange === "yesterday" ? dayStart.getTime() : Infinity;
    const min = priceMin === "" ? -Infinity : Number(priceMin);
    const max = priceMax === "" ? Infinity : Number(priceMax);

    const list = products.filter((product) => {
      if (shopFilter !== "all" && product.seller_id !== shopFilter) return false;
      const variants = product.product_variants || [];
      const created = new Date(product.created_at).getTime();
      if (created < from || created >= to) return false;
      if ((priceMin !== "" || priceMax !== "") && !variants.some((v) => Number(v.price) >= min && Number(v.price) <= max)) return false;
      const promo = variants.some(onPromotion);
      if (promoFilter === "yes" && !promo) return false;
      if (promoFilter === "no" && promo) return false;
      const haystack =
        searchField === "name"
          ? [product.name]
          : searchField === "sku"
            ? variants.map((variant) => variant.sku)
            : [product.name, relationName(product.brands), ...variants.flatMap((variant) => [variant.sku, variantLabel(variant)])];
      const matchesQuery = !q || haystack.join(" ").toLowerCase().includes(q);

      const matchesMainTab = tabOf(product) === catalogTab;

      const matchesLiveTab =
        catalogTab !== "live" ||
        liveTab !== "restock" ||
        variants.some(
          (variant) =>
            availableStock(variant) <=
            Number(variant.low_stock_threshold || 0)
        );

      return matchesQuery && matchesMainTab && matchesLiveTab;
    });

    const minPrice = (p: ProductRow) => Math.min(...(p.product_variants || []).map((v) => Number(v.price) || 0), Infinity);
    const totalStock = (p: ProductRow) => (p.product_variants || []).reduce((sum, v) => sum + availableStock(v), 0);
    const sorted = list.slice();
    if (sortBy === "old") sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    else if (sortBy === "priceAsc") sorted.sort((a, b) => minPrice(a) - minPrice(b));
    else if (sortBy === "priceDesc") sorted.sort((a, b) => minPrice(b) - minPrice(a));
    else if (sortBy === "stockAsc") sorted.sort((a, b) => totalStock(a) - totalStock(b));
    else if (sortBy === "stockDesc") sorted.sort((a, b) => totalStock(b) - totalStock(a));
    else if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, query, catalogTab, liveTab, shopFilter, searchField, dateRange, priceMin, priceMax, promoFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize]
  );
  // Back to page 1 whenever the filters change.
  useEffect(() => {
    setPage(1);
  }, [query, catalogTab, liveTab, shopFilter, searchField, dateRange, priceMin, priceMax, promoFilter, sortBy, pageSize]);
  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  // Delete ticked drafts (only drafts; the server double-checks).
  async function bulkDeleteDrafts() {
    const ids = filtered.filter((p) => selectedProductIds.has(p.id) && p.status === "draft").map((p) => p.id);
    if (!ids.length) return;
    if (!window.confirm("Delete " + ids.length + " draft product(s)? This can't be undone.")) return;
    setBulkStatusBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/products/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      const result = (await response.json().catch(() => ({}))) as { deleted?: number; kept?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not delete products.");
      if ((result.deleted || 0) > 0) {
        // Reload what's left, so anything kept by the server stays visible.
        const idSet = new Set(ids);
        const { data: still } = await createClient().from("products").select("id").in("id", ids.slice(0, 300));
        const remaining = new Set(((still || []) as Array<{ id: string }>).map((r) => r.id));
        setProducts((current) => current.filter((item) => !idSet.has(item.id) || remaining.has(item.id)));
      }
      setSelectedProductIds(new Set());
      setMessage(
        (result.deleted || 0) + " draft product(s) deleted." + (result.kept ? " " + result.kept + " kept (not a draft, or already ordered)." : "")
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete products.");
    } finally {
      setBulkStatusBusy(false);
    }
  }

  // Publish / delist many at once (the server checks the shops are yours).
  async function bulkSetStatus(nextStatus: "active" | "inactive") {
    const ids = filtered.filter((p) => selectedProductIds.has(p.id)).map((p) => p.id);
    if (!ids.length) return;
    if (
      !window.confirm(
        nextStatus === "active"
          ? "Publish " + ids.length + " product(s)? Buyers will see them right away."
          : "Unpublish " + ids.length + " product(s)? Buyers will no longer see them."
      )
    ) return;
    setBulkStatusBusy(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/products/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, status: nextStatus }),
      });
      const result = (await response.json().catch(() => ({}))) as { changed?: number; error?: string };
      if (!response.ok) throw new Error(result.error || "Could not update products.");
      const idSet = new Set(ids);
      setProducts((current) => current.map((item) => (idSet.has(item.id) ? { ...item, status: nextStatus } : item)));
      setSelectedProductIds(new Set());
      setMessage(
        (result.changed ?? ids.length) + " product(s) " + (nextStatus === "active" ? "published." : "unpublished.")
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update products.");
    } finally {
      setBulkStatusBusy(false);
    }
  }

  function toggleProductSelection(productId: string) {
    setSelectedProductIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleVisibleSelection() {
    const visibleIds = paged.map((product) => product.id);
    const allSelected =
      visibleIds.length > 0 &&
      visibleIds.every((id) => selectedProductIds.has(id));

    setSelectedProductIds((current) => {
      const next = new Set(current);

      for (const id of visibleIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }

      return next;
    });
  }

  function openBulkImageEditor(productId: string) {
    setBulkDescriptionEditorId("");
    setBulkImageEditorId(productId);
  }

  function openBulkDescriptionEditor(productId: string) {
    setBulkImageEditorId("");
    setBulkDescriptionEditorId(productId);
  }

  function openBulkEditor() {
    const rows = products
      .filter((product) => selectedProductIds.has(product.id))
      .map<BulkEditRow>((product) => {
        const gallery = (product.product_images || []).length
          ? (product.product_images || [])
          : product.primary_image_url
            ? [
                {
                  id: "primary-fallback",
                  image_url: product.primary_image_url,
                  sort_order: 0,
                },
              ]
            : [];

        return {
          productId: product.id,
          sellerId: product.seller_id,
          name: product.name,
          shortDescription: product.short_description || "",
          description: product.description || "",
          images: gallery.map((image) => ({
            key: image.id || crypto.randomUUID(),
            id: image.id === "primary-fallback" ? null : image.id,
            url: image.image_url,
            file: null,
          })),
          originalImageIds: (product.product_images || []).map(
            (image) => image.id
          ),
          variants: (product.product_variants || []).map((variant) => ({
            id: variant.id,
            label: variantLabel(variant),
            sku: variant.sku,
            price: String(Number(variant.price || 0)),
            stock: String(availableStock(variant)),
            stockReserved: Number(variant.stock_reserved || 0),
            weightKg: String(Number(variant.weight_kg || 0)),
            lengthCm: String(Number(variant.length_cm || 0)),
            widthCm: String(Number(variant.width_cm || 0)),
            heightCm: String(Number(variant.height_cm || 0)),
          })),
        };
      });

    setBulkEditRows(rows);
    setBulkImageEditorId("");
    setBulkDescriptionEditorId("");
    setBulkEditOpen(true);
    setError("");
    setMessage("");
  }

  function revokeBulkObjectUrls(rows: BulkEditRow[]) {
    for (const row of rows) {
      for (const image of row.images) {
        if (image.file && image.url.startsWith("blob:")) {
          URL.revokeObjectURL(image.url);
        }
      }
    }
  }

  function closeBulkEditor() {
    revokeBulkObjectUrls(bulkEditRows);
    setBulkEditOpen(false);
    setBulkImageEditorId("");
    setBulkDescriptionEditorId("");
    setBulkEditRows([]);
  }

  function updateBulkField(
    productId: string,
    field: "name" | "shortDescription" | "description",
    value: string
  ) {
    setBulkEditRows((current) =>
      current.map((row) =>
        row.productId === productId ? { ...row, [field]: value } : row
      )
    );
  }

  function updateBulkVariant(
    productId: string,
    variantId: string,
    field:
      | "sku"
      | "price"
      | "stock"
      | "weightKg"
      | "lengthCm"
      | "widthCm"
      | "heightCm",
    value: string
  ) {
    setBulkEditRows((current) =>
      current.map((row) =>
        row.productId !== productId
          ? row
          : {
              ...row,
              variants: row.variants.map((variant) =>
                variant.id === variantId
                  ? { ...variant, [field]: value }
                  : variant
              ),
            }
      )
    );
  }

  function addBulkImages(productId: string, files: FileList | null) {
    if (!files?.length) return;

    const accepted = Array.from(files).filter(
      (file) =>
        ["image/jpeg", "image/png", "image/webp"].includes(file.type) &&
        file.size <= 5 * 1024 * 1024
    );

    if (accepted.length !== files.length) {
      setError("Images must be JPG, PNG or WEBP and below 5MB each.");
    }

    setBulkEditRows((current) =>
      current.map((row) => {
        if (row.productId !== productId) return row;

        const remaining = Math.max(0, 8 - row.images.length);
        const nextImages = accepted.slice(0, remaining).map((file) => ({
          key: "new-" + crypto.randomUUID(),
          id: null,
          url: URL.createObjectURL(file),
          file,
        }));

        return {
          ...row,
          images: [...row.images, ...nextImages],
        };
      })
    );
  }

  function removeBulkImage(productId: string, imageKey: string) {
    setBulkEditRows((current) =>
      current.map((row) => {
        if (row.productId !== productId) return row;

        const removed = row.images.find((image) => image.key === imageKey);
        if (removed?.file && removed.url.startsWith("blob:")) {
          URL.revokeObjectURL(removed.url);
        }

        return {
          ...row,
          images: row.images.filter((image) => image.key !== imageKey),
        };
      })
    );
  }

  function moveBulkImage(
    productId: string,
    imageIndex: number,
    direction: -1 | 1
  ) {
    setBulkEditRows((current) =>
      current.map((row) => {
        if (row.productId !== productId) return row;

        const target = imageIndex + direction;
        if (target < 0 || target >= row.images.length) return row;

        const next = [...row.images];
        [next[imageIndex], next[target]] = [
          next[target],
          next[imageIndex],
        ];

        return { ...row, images: next };
      })
    );
  }

  function makeBulkImageMain(productId: string, imageIndex: number) {
    if (imageIndex <= 0) return;

    setBulkEditRows((current) =>
      current.map((row) => {
        if (row.productId !== productId) return row;

        const next = [...row.images];
        const [image] = next.splice(imageIndex, 1);
        next.unshift(image);

        return { ...row, images: next };
      })
    );
  }

  function applyFirstSkuParcelToProduct(productId: string) {
    setBulkEditRows((current) =>
      current.map((row) => {
        if (row.productId !== productId || row.variants.length < 2) {
          return row;
        }

        const source = row.variants[0];

        return {
          ...row,
          variants: row.variants.map((variant, index) =>
            index === 0
              ? variant
              : {
                  ...variant,
                  weightKg: source.weightKg,
                  lengthCm: source.lengthCm,
                  widthCm: source.widthCm,
                  heightCm: source.heightCm,
                }
          ),
        };
      })
    );
  }

  async function saveBulkEditor() {
    if (bulkEditRows.length === 0) return;

    for (const row of bulkEditRows) {
      if (!row.name.trim()) {
        setError("Product name cannot be empty.");
        return;
      }

      if (row.images.length === 0) {
        setError(row.name + " needs at least one product image.");
        return;
      }

      for (const variant of row.variants) {
        const price = Number(variant.price);
        const stock = Number(variant.stock);
        const dimensions = [
          Number(variant.weightKg),
          Number(variant.lengthCm),
          Number(variant.widthCm),
          Number(variant.heightCm),
        ];

        if (!variant.sku.trim()) {
          setError("Every variation needs a SKU.");
          return;
        }
        if (!Number.isFinite(price) || price < 0) {
          setError("Invalid price for " + variant.sku);
          return;
        }
        if (!Number.isInteger(stock) || stock < 0) {
          setError("Invalid stock for " + variant.sku);
          return;
        }
        if (
          dimensions.some(
            (value) => !Number.isFinite(value) || value < 0
          )
        ) {
          setError(
            "Invalid weight or parcel size for " +
              (variant.sku || variant.label)
          );
          return;
        }
      }
    }

    setBulkSaving(true);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const updatedPrimaryImages = new Map<string, string>();
      const finalImageRows = new Map<string, ProductImageRow[]>();

      for (const row of bulkEditRows) {
        const { error: productUpdateError } = await supabase
          .from("products")
          .update({
            name: row.name.trim(),
            short_description: row.shortDescription.trim() || null,
            description: row.description.trim() || null,
          })
          .eq("id", row.productId);

        if (productUpdateError) throw productUpdateError;

        for (const variant of row.variants) {
          const { error: variantUpdateError } = await supabase
            .from("product_variants")
            .update({
              sku: variant.sku.trim().toUpperCase(),
              price: Number(variant.price),
              stock_on_hand:
                Number(variant.stock) + Number(variant.stockReserved || 0),
              weight_kg: Number(variant.weightKg),
              length_cm: Number(variant.lengthCm),
              width_cm: Number(variant.widthCm),
              height_cm: Number(variant.heightCm),
            })
            .eq("id", variant.id);

          if (variantUpdateError) throw variantUpdateError;
        }

        const resolvedImages: Array<{
          key: string;
          id: string | null;
          url: string;
        }> = [];

        for (const image of row.images) {
          if (!image.file) {
            resolvedImages.push({
              key: image.key,
              id: image.id,
              url: image.url,
            });
            continue;
          }

          const path =
            row.sellerId +
            "/bulk-gallery-" +
            crypto.randomUUID() +
            "-" +
            safeFileName(image.file.name);

          const { error: uploadError } = await supabase.storage
            .from("product-images")
            .upload(path, image.file, {
              cacheControl: "3600",
              upsert: false,
              contentType: image.file.type,
            });

          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage
            .from("product-images")
            .getPublicUrl(path);

          resolvedImages.push({
            key: image.key,
            id: null,
            url: publicData.publicUrl,
          });
        }

        const keptExistingIds = new Set(
          resolvedImages
            .map((image) => image.id)
            .filter((id): id is string => Boolean(id))
        );
        const removedImageIds = row.originalImageIds.filter(
          (id) => !keptExistingIds.has(id)
        );

        if (removedImageIds.length > 0) {
          const { data: removedRows, error: removedLookupError } =
            await supabase
              .from("product_images")
              .select("image_url")
              .in("id", removedImageIds);

          if (removedLookupError) throw removedLookupError;

          const { error: deleteRowsError } = await supabase
            .from("product_images")
            .delete()
            .in("id", removedImageIds);

          if (deleteRowsError) throw deleteRowsError;

          const storagePaths = (removedRows || [])
            .map((image) => storagePathFromUrl(image.image_url))
            .filter(Boolean);

          if (storagePaths.length > 0) {
            await supabase.storage
              .from("product-images")
              .remove(storagePaths);
          }
        }

        const savedImageRows: ProductImageRow[] = [];

        for (const [index, image] of resolvedImages.entries()) {
          if (image.id) {
            const { error: reorderError } = await supabase
              .from("product_images")
              .update({
                sort_order: index,
                alt_text: row.name.trim(),
              })
              .eq("id", image.id);

            if (reorderError) throw reorderError;

            savedImageRows.push({
              id: image.id,
              image_url: image.url,
              sort_order: index,
            });
          } else {
            const { data: insertedImage, error: insertImageError } =
              await supabase
                .from("product_images")
                .insert({
                  product_id: row.productId,
                  image_url: image.url,
                  alt_text: row.name.trim(),
                  sort_order: index,
                })
                .select("id, image_url, sort_order")
                .single();

            if (insertImageError) throw insertImageError;
            savedImageRows.push(insertedImage as ProductImageRow);
          }
        }

        const primaryImage = resolvedImages[0]?.url || null;

        const { error: primaryImageError } = await supabase
          .from("products")
          .update({ primary_image_url: primaryImage })
          .eq("id", row.productId);

        if (primaryImageError) throw primaryImageError;

        if (primaryImage) {
          updatedPrimaryImages.set(row.productId, primaryImage);
        }
        finalImageRows.set(row.productId, savedImageRows);
      }

      const rowByProduct = new Map(
        bulkEditRows.map((row) => [row.productId, row])
      );

      setProducts((current) =>
        current.map((product) => {
          const row = rowByProduct.get(product.id);
          if (!row) return product;

          const draftVariants = new Map(
            row.variants.map((variant) => [variant.id, variant])
          );

          return {
            ...product,
            name: row.name.trim(),
            short_description: row.shortDescription.trim() || null,
            description: row.description.trim() || null,
            primary_image_url:
              updatedPrimaryImages.get(product.id) ||
              product.primary_image_url,
            product_images:
              finalImageRows.get(product.id) || product.product_images,
            product_variants: (product.product_variants || []).map(
              (variant) => {
                const draft = draftVariants.get(variant.id);
                if (!draft) return variant;

                return {
                  ...variant,
                  sku: draft.sku.trim().toUpperCase(),
                  price: Number(draft.price),
                  stock_on_hand:
                    Number(draft.stock) +
                    Number(draft.stockReserved || 0),
                  weight_kg: Number(draft.weightKg),
                  length_cm: Number(draft.lengthCm),
                  width_cm: Number(draft.widthCm),
                  height_cm: Number(draft.heightCm),
                };
              }
            ),
          };
        })
      );

      setMessage(
        bulkEditRows.length +
          " product" +
          (bulkEditRows.length === 1 ? "" : "s") +
          " updated."
      );
      setSelectedProductIds(new Set());
      closeBulkEditor();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save mass product changes."
      );
    } finally {
      setBulkSaving(false);
    }
  }

  function toggleProduct(productId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  async function dropVariant(
    productId: string,
    targetVariantId: string
  ) {
    if (
      !draggedVariant ||
      draggedVariant.productId !== productId ||
      draggedVariant.variantId === targetVariantId
    ) {
      setDraggedVariant(null);
      return;
    }

    const product = products.find((item) => item.id === productId);
    if (!product) {
      setDraggedVariant(null);
      return;
    }

    const current = (product.product_variants || [])
      .slice()
      .sort(
        (a, b) =>
          Number(a.sort_order || 0) - Number(b.sort_order || 0)
      );
    const from = current.findIndex(
      (item) => item.id === draggedVariant.variantId
    );
    const to = current.findIndex(
      (item) => item.id === targetVariantId
    );

    if (from < 0 || to < 0) {
      setDraggedVariant(null);
      return;
    }

    const next = [...current];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);

    const reordered = next.map((item, index) => ({
      ...item,
      sort_order: index,
    }));

    setProducts((all) =>
      all.map((item) =>
        item.id === productId
          ? { ...item, product_variants: reordered }
          : item
      )
    );
    setDraggedVariant(null);
    setSavingVariantOrderProductId(productId);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      for (const [index, variant] of reordered.entries()) {
        const { error: updateError } = await supabase
          .from("product_variants")
          .update({ sort_order: index })
          .eq("id", variant.id);

        if (updateError) throw updateError;
      }

      setMessage("Variation order updated.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update variation order."
      );
    } finally {
      setSavingVariantOrderProductId("");
    }
  }

  function beginQuickEdit(variant: ProductVariantRow) {
    setQuickEditId(variant.id);
    setQuickPrice(Number(variant.price).toFixed(2));
    setQuickStock(String(availableStock(variant)));
    setError("");
    setMessage("");
  }

  function cancelQuickEdit() {
    setQuickEditId("");
    setQuickPrice("");
    setQuickStock("");
  }

  async function saveQuickEdit(variant: ProductVariantRow) {
    const price = Number(quickPrice);
    const stock = Number(quickStock);

    if (!Number.isFinite(price) || price < 0) {
      setError("Please enter a valid price.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("Stock must be a whole number.");
      return;
    }

    setSavingVariantId(variant.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();
      const stockOnHand = stock + Number(variant.stock_reserved || 0);

      const { error: updateError } = await supabase
        .from("product_variants")
        .update({
          price,
          stock_on_hand: stockOnHand,
        })
        .eq("id", variant.id);

      if (updateError) throw updateError;

      setProducts((current) =>
        current.map((product) => ({
          ...product,
          product_variants: (product.product_variants || []).map((item) =>
            item.id === variant.id
              ? {
                  ...item,
                  price,
                  stock_on_hand: stockOnHand,
                }
              : item
          ),
        }))
      );

      setMessage("Price and stock updated.");
      cancelQuickEdit();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update price and stock."
      );
    } finally {
      setSavingVariantId("");
    }
  }

  async function setListingStatus(
    product: ProductRow,
    nextStatus: "active" | "inactive"
  ) {
    const verb = nextStatus === "inactive" ? "delist" : "list";
    if (
      !window.confirm(
        nextStatus === "inactive"
          ? "Delist this product? Buyers will no longer see or purchase it."
          : "List this product again? It will become visible to buyers."
      )
    ) {
      return;
    }

    setProductActionId(product.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/products/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [product.id], status: nextStatus }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to " + verb + " product.");

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, status: nextStatus }
            : item
        )
      );
      setMessage(
        nextStatus === "inactive"
          ? "Product delisted."
          : "Product listed again."
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to " + verb + " product."
      );
    } finally {
      setProductActionId("");
    }
  }

  async function publishDraftProduct(product: ProductRow) {
    if (product.status !== "draft") return;

    setProductActionId(product.id);
    setDeleteConfirmId("");
    setError("");
    setMessage("");

    try {
      const response = await fetch("/api/admin/products/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [product.id], status: "active" }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to publish draft product.");

      setProducts((current) =>
        current.map((item) =>
          item.id === product.id
            ? { ...item, status: "active" }
            : item
        )
      );
      setMessage("Product published.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to publish draft product."
      );
    } finally {
      setProductActionId("");
    }
  }

  async function deleteDraftProduct(product: ProductRow) {
    if (product.status !== "draft") return;

    if (deleteConfirmId !== product.id) {
      setDeleteConfirmId(product.id);
      setMessage("");
      setError("");
      return;
    }

    setProductActionId(product.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const [imagesResult, variantsResult] = await Promise.all([
        supabase
          .from("product_images")
          .select("image_url")
          .eq("product_id", product.id),
        supabase
          .from("product_variants")
          .select("variant_image_url")
          .eq("product_id", product.id),
      ]);

      if (imagesResult.error || variantsResult.error) {
        throw imagesResult.error || variantsResult.error;
      }

      const { error: deleteError } = await supabase
        .from("products")
        .delete()
        .eq("id", product.id)
        .eq("status", "draft");

      if (deleteError) throw deleteError;

      const storagePaths = Array.from(
        new Set(
          [
            ...(imagesResult.data || []).map((row) =>
              storagePathFromUrl(row.image_url)
            ),
            ...(variantsResult.data || []).map((row) =>
              row.variant_image_url
                ? storagePathFromUrl(row.variant_image_url)
                : ""
            ),
          ].filter(Boolean)
        )
      );

      if (storagePaths.length > 0) {
        await supabase.storage
          .from("product-images")
          .remove(storagePaths);
      }

      setProducts((current) =>
        current.filter((item) => item.id !== product.id)
      );
      setExpanded((current) => {
        const next = new Set(current);
        next.delete(product.id);
        return next;
      });
      setDeleteConfirmId("");
      setMessage("Draft product deleted.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete draft product."
      );
    } finally {
      setProductActionId("");
    }
  }

  function copyProduct(product: ProductRow) {
    window.location.assign(
      "/admin/products/new?copyFrom=" + encodeURIComponent(product.id)
    );
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MIVO store control · Catalogue
              </span>
              <h1>Products</h1>
              <p>
                Shopee-style catalogue management with quick edit, copy and delist controls.
              </p>
            </div>

            <div className={styles.adminHeaderActions}>
              <div className={styles.adminAttention}>
                <span>Products shown</span>
                <strong>{loading ? "—" : filtered.length}</strong>
              </div>
              <a href="/admin/products/unmatched" className={styles.adminAction}>Unmatched SKU</a>
              <a href="/admin/products/new" className={styles.adminAction}>
                + ADD PRODUCT
              </a>
            </div>
          </header>

          <section className={styles.adminPanel}>
            <div className={styles.adminPanelHead}>
              <div>
                <span className={styles.adminPanelKicker}>
                  Catalogue management
                </span>
                <h2>Product Catalogue</h2>
                <p>
                  Manage live listings, restock items and unpublished products.
                </p>
              </div>
            </div>

            <div className={styles.bsFilter}>
              {myShops.length > 1 ? (
                <div className={styles.bsRow}>
                  <span className={styles.bsLabel}>Shop</span>
                  <div className={styles.bsChips}>
                    <button type="button" className={shopFilter === "all" ? styles.bsOn : ""} onClick={() => setShopFilter("all")}>
                      All ({Array.from(shopCounts.values()).reduce((x, y) => x + y, 0)})
                    </button>
                    {myShops.map((shop) => (
                      <button
                        type="button"
                        key={shop.id}
                        className={shopFilter === shop.id ? styles.bsOn : ""}
                        onClick={() => setShopFilter(shop.id)}
                      >
                        {shop.name} ({shopCounts.get(shop.id) || 0})
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className={styles.bsRow}>
                <span className={styles.bsLabel}>Search</span>
                <div className={styles.bsSearch}>
                  <select value={searchField} onChange={(e) => setSearchField(e.target.value as typeof searchField)}>
                    <option value="all">All fields</option>
                    <option value="name">Product name</option>
                    <option value="sku">SKU</option>
                  </select>
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search…" />
                </div>
              </div>
              <div className={styles.bsRow}>
                <span className={styles.bsLabel}>Created</span>
                <div className={styles.bsChips}>
                  {(
                    [
                      ["all", "All"],
                      ["today", "Today"],
                      ["yesterday", "Yesterday"],
                      ["7", "7 days"],
                      ["30", "30 days"],
                    ] as Array<[typeof dateRange, string]>
                  ).map(([key, label]) => (
                    <button type="button" key={key} className={dateRange === key ? styles.bsOn : ""} onClick={() => setDateRange(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className={styles.bsRow}>
                <span className={styles.bsLabel}>Other</span>
                <div className={styles.bsChips}>
                  <span className={styles.bsRange}>
                    <input type="number" min="0" placeholder="Price from" value={priceMin} onChange={(e) => setPriceMin(e.target.value)} />
                    –
                    <input type="number" min="0" placeholder="to" value={priceMax} onChange={(e) => setPriceMax(e.target.value)} />
                  </span>
                  <select className={styles.bsSelect} value={promoFilter} onChange={(e) => setPromoFilter(e.target.value as typeof promoFilter)}>
                    <option value="all">Promotion: all</option>
                    <option value="yes">On promotion</option>
                    <option value="no">No promotion</option>
                  </select>
                  {catalogTab === "live" ? (
                    <button type="button" className={liveTab === "restock" ? styles.bsOn : ""} onClick={() => setLiveTab(liveTab === "restock" ? "all" : "restock")}>
                      Low stock ({restockCount})
                    </button>
                  ) : null}
                </div>
              </div>
              <div className={styles.bsRow}>
                <span className={styles.bsLabel}>Sort</span>
                <div className={styles.bsChips}>
                  {(
                    [
                      ["new", "Newest"],
                      ["old", "Oldest"],
                      ["priceAsc", "Price ↑"],
                      ["priceDesc", "Price ↓"],
                      ["stockAsc", "Stock ↑"],
                      ["stockDesc", "Stock ↓"],
                      ["name", "Name A–Z"],
                    ] as Array<[typeof sortBy, string]>
                  ).map(([key, label]) => (
                    <button type="button" key={key} className={sortBy === key ? styles.bsOn : ""} onClick={() => setSortBy(key)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.productStatusTabs}>
              {(
                [
                  ["live", "On sale"],
                  ["soldout", "Sold out"],
                  ["draft", "Draft"],
                  ["delisted", "Delisted"],
                ] as Array<[CatalogTab, string]>
              ).map(([key, label]) => (
                <button
                  type="button"
                  key={key}
                  className={catalogTab === key ? styles.active : ""}
                  onClick={() => {
                    setCatalogTab(key);
                    setLiveTab("all");
                    setSelectedProductIds(new Set());
                  }}
                >
                  <span>{label}</span>
                  <b>({tabCounts[key]})</b>
                </button>
              ))}
            </div>

            <div className={styles.productBulkToolbar}>
              <button
                type="button"
                className={styles.productBulkSecondary}
                onClick={toggleVisibleSelection}
              >
                {paged.length > 0 &&
                paged.every((product) =>
                  selectedProductIds.has(product.id)
                )
                  ? "Clear visible"
                  : "Select visible"}
              </button>

              <span>
                {selectedProductIds.size} PRODUCT
                {selectedProductIds.size === 1 ? "" : "S"} SELECTED
              </span>

              {catalogTab === "draft" ? (
                <button
                  type="button"
                  className={styles.productBulkDanger}
                  disabled={selectedProductIds.size === 0 || bulkStatusBusy}
                  onClick={() => void bulkDeleteDrafts()}
                >
                  Delete selected
                </button>
              ) : null}

              {catalogTab === "draft" || catalogTab === "delisted" ? (
                <button
                  type="button"
                  className={styles.productBulkPrimary}
                  disabled={selectedProductIds.size === 0 || bulkStatusBusy}
                  onClick={() => void bulkSetStatus("active")}
                >
                  {bulkStatusBusy ? "Publishing…" : "Publish selected"}
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.productBulkSecondary}
                  disabled={selectedProductIds.size === 0 || bulkStatusBusy}
                  onClick={() => void bulkSetStatus("inactive")}
                >
                  {bulkStatusBusy ? "Saving…" : "Unpublish selected"}
                </button>
              )}

              <button
                type="button"
                className={styles.productBulkPrimary}
                disabled={selectedProductIds.size === 0}
                onClick={openBulkEditor}
              >
                Mass edit products
              </button>
            </div>

            {message ? (
              <p className={styles.adminSuccess}>{message}</p>
            ) : null}
            {error ? <p className={styles.adminError}>{error}</p> : null}
            {loading ? (
              <p className={styles.adminNotice}>Loading products...</p>
            ) : null}

            {!loading && !error && (
              <div className={styles.adminTableWrap}>
                <table
                  className={
                    styles.adminTable + " " + styles.catalogueQuickEditTable
                  }
                >
                  <thead>
                    <tr>
                      <th>Product / variation</th>
                      <th>Brand</th>
                      <th>SKU</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paged.map((product) => {
                      const variants = product.product_variants || [];
                      const stock = variants.reduce(
                        (sum, item) => sum + availableStock(item),
                        0
                      );

                      return (
                        <Fragment key={product.id}>
                          <tr className={styles.productParentRow}>
                            <td>
                              <div className={styles.adminProductCell}>
                                <label
                                  className={styles.productBulkCheckbox}
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedProductIds.has(product.id)}
                                    onChange={() =>
                                      toggleProductSelection(product.id)
                                    }
                                  />
                                  <span />
                                </label>

                                {product.primary_image_url ? (
                                  <img
                                    className={styles.adminProductThumb}
                                    src={product.primary_image_url}
                                    alt={product.name}
                                    onError={(event) => {
                                      const image = event.currentTarget;
                                      image.onerror = null;
                                      image.src = product.name.toUpperCase().startsWith("GSP ") ? "/brands/gsp-logo.svg" : "/mivo-logo.png";
                                      image.title = "Product photo unavailable";
                                    }}
                                  />
                                ) : (
                                  <div
                                    className={styles.adminProductThumb}
                                  />
                                )}

                                <div>
                                  <strong>{product.name}</strong>
                                  {myShops.length > 1 ? (
                                    <small style={{ display: "block", color: "#0a6cdf", fontSize: 12, fontWeight: 600 }}>
                                      {shopName(product.seller_id)}
                                    </small>
                                  ) : null}
                                  <button
                                    type="button"
                                    className={styles.variantExpandButton}
                                    onClick={() =>
                                      toggleProduct(product.id)
                                    }
                                  >
                                    {variants.length} SKU
                                    {variants.length === 1 ? "" : "s"} ·{" "}
                                    {expanded.has(product.id)
                                      ? "Hide"
                                      : "SHOW"}{" "}
                                    Variations
                                  </button>
                                </div>
                              </div>
                            </td>

                            <td>{relationName(product.brands)}</td>
                            <td>
                              {variants.length === 1
                                ? variants[0]?.sku || "—"
                                : "MULTI-SKU"}
                            </td>
                            <td>{priceSummary(variants)}</td>
                            <td>{stock}</td>
                            <td>
                              <span className={styles.adminStatus}>
                                {product.status}
                              </span>
                            </td>
                            <td>
                              <div className={styles.productActionStack}>
                                <a
                                  href={
                                    "/admin/products/" +
                                    product.id +
                                    "/edit"
                                  }
                                  className={styles.adminActionLink}
                                >
                                  Edit
                                </a>

                                <button
                                  type="button"
                                  className={styles.productActionButton}
                                  disabled={productActionId === product.id}
                                  onClick={() => copyProduct(product)}
                                >
                                  {productActionId === product.id
                                    ? "Working…"
                                    : "Copy"}
                                </button>

                                {product.status === "active" ? (
                                  <button
                                    type="button"
                                    className={
                                      styles.productActionButton +
                                      " " +
                                      styles.productActionDanger
                                    }
                                    disabled={productActionId === product.id}
                                    onClick={() =>
                                      setListingStatus(product, "inactive")
                                    }
                                  >
                                    Delist
                                  </button>
                                ) : product.status === "inactive" ? (
                                  <button
                                    type="button"
                                    className={
                                      styles.productActionButton +
                                      " " +
                                      styles.productActionPositive
                                    }
                                    disabled={productActionId === product.id}
                                    onClick={() =>
                                      setListingStatus(product, "active")
                                    }
                                  >
                                    List
                                  </button>
                                ) : product.status === "draft" ? (
                                  <>
                                    <button
                                      type="button"
                                      className={
                                        styles.productActionButton +
                                        " " +
                                        styles.productActionPositive
                                      }
                                      disabled={productActionId === product.id}
                                      onClick={() => publishDraftProduct(product)}
                                    >
                                      {productActionId === product.id
                                        ? "Publishing…"
                                        : "Publish"}
                                    </button>
                                    <button
                                      type="button"
                                      className={
                                        styles.productActionButton +
                                        " " +
                                        styles.productActionDanger
                                      }
                                      disabled={productActionId === product.id}
                                      onClick={() => deleteDraftProduct(product)}
                                    >
                                      {productActionId === product.id
                                        ? "Working…"
                                        : deleteConfirmId === product.id
                                          ? "Confirm delete"
                                          : "Delete"}
                                    </button>
                                  </>
                                ) : null}

                                {product.status === "active" ? (
                                  <a
                                    href={"/products/" + product.slug}
                                    className={styles.adminTextAction}
                                    target="_blank"
                                  >
                                    View
                                  </a>
                                ) : null}
                              </div>
                            </td>
                          </tr>

                          {expanded.has(product.id)
                            ? variants.map((variant, index) => {
                                const editing =
                                  quickEditId === variant.id;

                                return (
                                  <tr
                                    className={
                                      styles.productVariantRow +
                                      (draggedVariant?.variantId === variant.id
                                        ? " " + styles.productVariantDragging
                                        : "")
                                    }
                                    key={variant.id}
                                    draggable={
                                      !editing &&
                                      savingVariantOrderProductId !== product.id
                                    }
                                    onDragStart={(event) => {
                                      event.dataTransfer.effectAllowed = "move";
                                      event.dataTransfer.setData(
                                        "text/plain",
                                        variant.id
                                      );
                                      setDraggedVariant({
                                        productId: product.id,
                                        variantId: variant.id,
                                      });
                                    }}
                                    onDragOver={(event) => {
                                      if (
                                        draggedVariant?.productId ===
                                        product.id
                                      ) {
                                        event.preventDefault();
                                        event.dataTransfer.dropEffect = "move";
                                      }
                                    }}
                                    onDrop={(event) => {
                                      event.preventDefault();
                                      void dropVariant(
                                        product.id,
                                        variant.id
                                      );
                                    }}
                                    onDragEnd={() =>
                                      setDraggedVariant(null)
                                    }
                                  >
                                    <td>
                                      <div
                                        className={
                                          styles.productVariantIdentity
                                        }
                                      >
                                        <span
                                          className={
                                            styles.productVariantDragHandle
                                          }
                                          title="Drag to reorder"
                                        >
                                          ⋮⋮
                                        </span>
                                        <span>
                                          {String(index + 1).padStart(
                                            2,
                                            "0"
                                          )}
                                        </span>
                                        <div>
                                          <strong>
                                            {variantLabel(variant)}
                                          </strong>
                                          <small>Variation SKU</small>
                                        </div>
                                      </div>
                                    </td>

                                    <td>—</td>
                                    <td>
                                      <strong>{variant.sku}</strong>
                                    </td>

                                    <td>
                                      {editing ? (
                                        <div
                                          className={
                                            styles.quickEditField
                                          }
                                        >
                                          <span>RM</span>
                                          <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={quickPrice}
                                            onChange={(event) =>
                                              setQuickPrice(
                                                event.target.value
                                              )
                                            }
                                          />
                                        </div>
                                      ) : (
                                        <span
                                          className={
                                            styles.quickEditableValue
                                          }
                                        >
                                          RM{" "}
                                          {Number(
                                            variant.price
                                          ).toFixed(2)}
                                          <b>✎</b>
                                        </span>
                                      )}
                                    </td>

                                    <td>
                                      {editing ? (
                                        <div
                                          className={
                                            styles.quickEditField
                                          }
                                        >
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            value={quickStock}
                                            onChange={(event) =>
                                              setQuickStock(
                                                event.target.value
                                              )
                                            }
                                          />
                                        </div>
                                      ) : (
                                        <span
                                          className={
                                            styles.quickEditableValue
                                          }
                                        >
                                          {availableStock(variant)}
                                          <b>✎</b>
                                        </span>
                                      )}
                                    </td>

                                    <td>
                                      {availableStock(variant) <=
                                      Number(
                                        variant.low_stock_threshold || 0
                                      ) ? (
                                        <span
                                          className={
                                            styles.quickStockWarning
                                          }
                                        >
                                          Low stock
                                        </span>
                                      ) : (
                                        <span
                                          className={
                                            styles.quickStockOkay
                                          }
                                        >
                                          In stock
                                        </span>
                                      )}
                                    </td>

                                    <td>
                                      {editing ? (
                                        <div
                                          className={
                                            styles.quickEditActions
                                          }
                                        >
                                          <button
                                            type="button"
                                            className={
                                              styles.quickSaveButton
                                            }
                                            disabled={
                                              savingVariantId ===
                                              variant.id
                                            }
                                            onClick={() =>
                                              saveQuickEdit(variant)
                                            }
                                          >
                                            {savingVariantId ===
                                            variant.id
                                              ? "Saving…"
                                              : "Save"}
                                          </button>
                                          <button
                                            type="button"
                                            className={
                                              styles.quickCancelButton
                                            }
                                            onClick={cancelQuickEdit}
                                          >
                                            Cancel
                                          </button>
                                        </div>
                                      ) : (
                                        <button
                                          type="button"
                                          className={
                                            styles.quickEditButton
                                          }
                                          onClick={() =>
                                            beginQuickEdit(variant)
                                          }
                                        >
                                          Quick edit
                                        </button>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && filtered.length > 0 ? (
              <nav className={styles.pager} aria-label="Pages">
                <span className={styles.pagerInfo}>
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} of {filtered.length}
                </span>
                <div className={styles.pagerControls}>
                  <button type="button" onClick={() => setPage(1)} disabled={currentPage === 1} aria-label="First page">«</button>
                  <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page">‹</button>
                  <form
                    className={styles.pagerJump}
                    onSubmit={(e) => {
                      e.preventDefault();
                      const n = Math.round(Number(pageInput));
                      if (Number.isFinite(n)) setPage(Math.min(pageCount, Math.max(1, n)));
                    }}
                  >
                    <input
                      value={pageInput}
                      inputMode="numeric"
                      aria-label="Page"
                      onChange={(e) => setPageInput(e.target.value.replace(/[^0-9]/g, ""))}
                      onBlur={() => {
                        const n = Math.round(Number(pageInput));
                        if (Number.isFinite(n) && n > 0) setPage(Math.min(pageCount, n));
                        else setPageInput(String(currentPage));
                      }}
                    />
                    <span>/ {pageCount}</span>
                  </form>
                  <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount} aria-label="Next page">›</button>
                  <button type="button" onClick={() => setPage(pageCount)} disabled={currentPage === pageCount} aria-label="Last page">»</button>
                </div>
                <select className={styles.pagerSize} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} aria-label="Products per page">
                  {[10, 50, 100, 200, 300].map((n) => (
                    <option key={n} value={n}>
                      {n} / page
                    </option>
                  ))}
                </select>
              </nav>
            ) : null}

            {bulkEditOpen ? (
              <div
                className={styles.productBulkModalBackdrop}
                onMouseDown={(event) => {
                  if (
                    event.target === event.currentTarget &&
                    !bulkSaving
                  ) {
                    closeBulkEditor();
                  }
                }}
              >
                <div
                  className={styles.productBulkModal + " " + styles.productBulkModalWide}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="mass-edit-products-title"
                >
                  <div className={styles.productBulkModalHead}>
                    <div>
                      <span>Mass edit</span>
                      <h3 id="mass-edit-products-title">
                        Product Information
                      </h3>
                      <p>
                        Shopee-style mass editing for images, product name,
                        description, SKU, price, stock, parcel size and weight.
                      </p>
                    </div>
                    <div className={styles.productBulkHeadActions}>
                      <button
                        type="button"
                        onClick={closeBulkEditor}
                        disabled={bulkSaving}
                      >
                        Close
                      </button>
                    </div>
                  </div>

                  <div className={styles.productBulkTableWrap}>
                    <table className={styles.productBulkTable}>
                      <thead>
                        <tr>
                          <th>Image</th>
                          <th>Product name</th>
                          <th>Description</th>
                          <th>Variation / SKU</th>
                          <th>Price</th>
                          <th>Stock</th>
                          <th>Parcel size (cm)</th>
                          <th>Weight (kg)</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkEditRows.map((row) => (
                          <tr key={row.productId}>
                            <td>
                              <button
                                type="button"
                                className={styles.productBulkImageButton}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openBulkImageEditor(row.productId);
                                }}
                              >
                                <div>
                                  {row.images[0]?.url ? (
                                    <img
                                      src={row.images[0].url}
                                      alt={row.name}
                                    />
                                  ) : (
                                    <span>No image</span>
                                  )}
                                  {row.images.length > 0 ? (
                                    <b>{row.images.length}/8</b>
                                  ) : null}
                                </div>
                                <small>Edit images</small>
                              </button>
                            </td>

                            <td>
                              <textarea
                                className={styles.productBulkNameInput}
                                rows={4}
                                value={row.name}
                                onChange={(event) =>
                                  updateBulkField(
                                    row.productId,
                                    "name",
                                    event.target.value
                                  )
                                }
                              />
                            </td>

                            <td>
                              <button
                                type="button"
                                className={styles.productBulkDescriptionButton}
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  openBulkDescriptionEditor(row.productId);
                                }}
                              >
                                <strong>
                                  {row.description.trim()
                                    ? "Description added"
                                    : "Add description"}
                                </strong>
                                <span>
                                  {row.shortDescription.trim()
                                    ? row.shortDescription
                                    : row.description.trim()
                                      ? row.description.slice(0, 90)
                                      : "Edit short and full description"}
                                </span>
                              </button>
                            </td>

                            <td>
                              <div className={styles.productBulkVariantStack}>
                                {row.variants.map((variant) => (
                                  <label key={variant.id}>
                                    <span>{variant.label}</span>
                                    <input
                                      value={variant.sku}
                                      onChange={(event) =>
                                        updateBulkVariant(
                                          row.productId,
                                          variant.id,
                                          "sku",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </label>
                                ))}
                              </div>
                            </td>

                            <td>
                              <div className={styles.productBulkVariantStack}>
                                {row.variants.map((variant) => (
                                  <label key={variant.id}>
                                    <span>{variant.label}</span>
                                    <div className={styles.productBulkMoneyInput}>
                                      <b>RM</b>
                                      <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={variant.price}
                                        onChange={(event) =>
                                          updateBulkVariant(
                                            row.productId,
                                            variant.id,
                                            "price",
                                            event.target.value
                                          )
                                        }
                                      />
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </td>

                            <td>
                              <div className={styles.productBulkVariantStack}>
                                {row.variants.map((variant) => (
                                  <label key={variant.id}>
                                    <span>{variant.label}</span>
                                    <input
                                      type="number"
                                      min="0"
                                      step="1"
                                      value={variant.stock}
                                      onChange={(event) =>
                                        updateBulkVariant(
                                          row.productId,
                                          variant.id,
                                          "stock",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </label>
                                ))}
                              </div>
                            </td>

                            <td>
                              <div className={styles.productBulkVariantStack}>
                                {row.variants.map((variant) => (
                                  <div
                                    className={styles.productBulkSkuParcel}
                                    key={variant.id}
                                  >
                                    <span>{variant.label}</span>
                                    <div className={styles.productBulkParcelInputs}>
                                      <label>
                                        <span>L</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={variant.lengthCm}
                                          onChange={(event) =>
                                            updateBulkVariant(
                                              row.productId,
                                              variant.id,
                                              "lengthCm",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </label>
                                      <label>
                                        <span>W</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={variant.widthCm}
                                          onChange={(event) =>
                                            updateBulkVariant(
                                              row.productId,
                                              variant.id,
                                              "widthCm",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </label>
                                      <label>
                                        <span>H</span>
                                        <input
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={variant.heightCm}
                                          onChange={(event) =>
                                            updateBulkVariant(
                                              row.productId,
                                              variant.id,
                                              "heightCm",
                                              event.target.value
                                            )
                                          }
                                        />
                                      </label>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </td>

                            <td>
                              <div className={styles.productBulkVariantStack}>
                                {row.variants.map((variant) => (
                                  <label key={variant.id}>
                                    <span>{variant.label}</span>
                                    <input
                                      className={styles.productBulkWeightInput}
                                      type="number"
                                      min="0"
                                      step="0.001"
                                      value={variant.weightKg}
                                      onChange={(event) =>
                                        updateBulkVariant(
                                          row.productId,
                                          variant.id,
                                          "weightKg",
                                          event.target.value
                                        )
                                      }
                                    />
                                  </label>
                                ))}
                              </div>
                            </td>

                            <td>
                              <div className={styles.productBulkRowActions}>
                                {row.variants.length > 1 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      applyFirstSkuParcelToProduct(row.productId)
                                    }
                                  >
                                    Copy 1st SKU size
                                  </button>
                                ) : null}
                                <a
                                  className={styles.productBulkFullEdit}
                                href={
                                  "/admin/products/" +
                                  row.productId +
                                  "/edit"
                                }
                                target="_blank"
                                >
                                  Full edit
                                </a>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className={styles.productBulkModalFoot}>
                    <span>
                      {bulkEditRows.length} PRODUCT
                      {bulkEditRows.length === 1 ? "" : "S"}
                    </span>
                    <button
                      type="button"
                      className={styles.productBulkSecondary}
                      disabled={bulkSaving}
                      onClick={closeBulkEditor}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className={styles.productBulkPrimary}
                      disabled={bulkSaving}
                      onClick={() => void saveBulkEditor()}
                    >
                      {bulkSaving ? "Saving…" : "Save all changes"}
                    </button>
                  </div>
                </div>

                {bulkImageEditorId
                  ? (() => {
                      const row = bulkEditRows.find(
                        (item) => item.productId === bulkImageEditorId
                      );
                      if (!row) return null;

                      return createPortal(
                        <div
                          className={styles.productBulkSubModalBackdrop}
                          onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                              setBulkImageEditorId("");
                            }
                          }}
                        >
                          <div className={styles.productBulkImageManager}>
                            <div className={styles.productBulkSubModalHead}>
                              <div>
                                <span>Edit images</span>
                                <h4>{row.name}</h4>
                                <p>
                                  First image is the main image. Add, remove or
                                  reorder up to 8 product photos.
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => setBulkImageEditorId("")}
                              >
                                Close
                              </button>
                            </div>

                            <div className={styles.productBulkImageGrid}>
                              {row.images.map((image, index) => (
                                <div
                                  className={styles.productBulkGalleryCard}
                                  key={image.key}
                                >
                                  <img
                                    src={image.url}
                                    alt={row.name + " " + (index + 1)}
                                  />
                                  {index === 0 ? (
                                    <b>Main image</b>
                                  ) : null}
                                  <div>
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() =>
                                        makeBulkImageMain(
                                          row.productId,
                                          index
                                        )
                                      }
                                    >
                                      Main
                                    </button>
                                    <button
                                      type="button"
                                      disabled={index === 0}
                                      onClick={() =>
                                        moveBulkImage(
                                          row.productId,
                                          index,
                                          -1
                                        )
                                      }
                                    >
                                      ←
                                    </button>
                                    <button
                                      type="button"
                                      disabled={
                                        index === row.images.length - 1
                                      }
                                      onClick={() =>
                                        moveBulkImage(
                                          row.productId,
                                          index,
                                          1
                                        )
                                      }
                                    >
                                      →
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        removeBulkImage(
                                          row.productId,
                                          image.key
                                        )
                                      }
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ))}

                              {row.images.length < 8 ? (
                                <label className={styles.productBulkGalleryAdd}>
                                  <input
                                    type="file"
                                    multiple
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={(event) => {
                                      addBulkImages(
                                        row.productId,
                                        event.target.files
                                      );
                                      event.target.value = "";
                                    }}
                                  />
                                  <strong>+</strong>
                                  <span>Add images</span>
                                  <small>
                                    {row.images.length}/8
                                  </small>
                                </label>
                              ) : null}
                            </div>

                            <div className={styles.productBulkSubModalFoot}>
                              <button
                                type="button"
                                className={styles.productBulkPrimary}
                                onClick={() => setBulkImageEditorId("")}
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>,
                        document.body
                      );
                    })()
                  : null}

                {bulkDescriptionEditorId
                  ? (() => {
                      const row = bulkEditRows.find(
                        (item) =>
                          item.productId === bulkDescriptionEditorId
                      );
                      if (!row) return null;

                      return createPortal(
                        <div
                          className={styles.productBulkSubModalBackdrop}
                          onMouseDown={(event) => {
                            if (event.target === event.currentTarget) {
                              setBulkDescriptionEditorId("");
                            }
                          }}
                        >
                          <div className={styles.productBulkDescriptionModal}>
                            <div className={styles.productBulkSubModalHead}>
                              <div>
                                <span>Edit description</span>
                                <h4>{row.name}</h4>
                              </div>
                              <button
                                type="button"
                                onClick={() =>
                                  setBulkDescriptionEditorId("")
                                }
                              >
                                Close
                              </button>
                            </div>

                            <div className={styles.productBulkDescriptionFields}>
                              <label>
                                <span>Short description</span>
                                <input
                                  maxLength={240}
                                  value={row.shortDescription}
                                  onChange={(event) =>
                                    updateBulkField(
                                      row.productId,
                                      "shortDescription",
                                      event.target.value
                                    )
                                  }
                                />
                              </label>
                              <label>
                                <span>Description</span>
                                <textarea
                                  rows={14}
                                  value={row.description}
                                  onChange={(event) =>
                                    updateBulkField(
                                      row.productId,
                                      "description",
                                      event.target.value
                                    )
                                  }
                                />
                              </label>
                            </div>

                            <div className={styles.productBulkSubModalFoot}>
                              <button
                                type="button"
                                className={styles.productBulkPrimary}
                                onClick={() =>
                                  setBulkDescriptionEditorId("")
                                }
                              >
                                Done
                              </button>
                            </div>
                          </div>
                        </div>,
                        document.body
                      );
                    })()
                  : null}
              </div>
            ) : null}
          </section>
        </section>
      </div>
    </main>
  );
}
