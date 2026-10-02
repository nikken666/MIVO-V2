"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";

type ProductVariantRow = {
  id: string;
  title: string | null;
  variation_1_value: string | null;
  variation_2_value: string | null;
  sku: string;
  price: number | string;
  stock_on_hand: number;
  stock_reserved: number;
  low_stock_threshold: number;
};

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  primary_image_url: string | null;
  created_at: string;
  brands: { name: string } | Array<{ name: string }> | null;
  product_variants: ProductVariantRow[] | null;
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

function storagePathFromUrl(url: string) {
  const marker = "/storage/v1/object/public/product-images/";
  const index = url.indexOf(marker);
  if (index < 0) return "";
  return decodeURIComponent(url.slice(index + marker.length));
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [catalogTab, setCatalogTab] = useState<"live" | "unpublished">("live");
  const [liveTab, setLiveTab] = useState<"all" | "restock">("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [quickEditId, setQuickEditId] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [quickStock, setQuickStock] = useState("");
  const [savingVariantId, setSavingVariantId] = useState("");
  const [productActionId, setProductActionId] = useState("");
  const [deleteConfirmId, setDeleteConfirmId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStatus = params.get("status");
    const requestedStock = params.get("stock");

    if (requestedStatus && requestedStatus !== "active") {
      setCatalogTab("unpublished");
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
          window.location.href = "/";
          return;
        }

        const { data, error: productError } = await supabase
          .from("products")
          .select(
            "id, name, slug, status, primary_image_url, created_at, brands(name), product_variants(id, title, variation_1_value, variation_2_value, sku, price, stock_on_hand, stock_reserved, low_stock_threshold)"
          )
          .order("created_at", { ascending: false });

        if (productError) throw productError;

        const rows = (data as ProductRow[] | null) || [];
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

  const liveCount = useMemo(
    () => products.filter((product) => product.status === "active").length,
    [products]
  );

  const unpublishedCount = useMemo(
    () => products.filter((product) => product.status !== "active").length,
    [products]
  );

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((product) => {
      const variants = product.product_variants || [];
      const matchesQuery =
        !q ||
        [
          product.name,
          relationName(product.brands),
          ...variants.flatMap((variant) => [
            variant.sku,
            variantLabel(variant),
          ]),
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesMainTab =
        catalogTab === "live"
          ? product.status === "active"
          : product.status !== "active";

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
  }, [products, query, catalogTab, liveTab]);

  function toggleProduct(productId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
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
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("products")
        .update({
          status: nextStatus,
          ...(nextStatus === "active"
            ? { published_at: new Date().toISOString() }
            : {}),
        })
        .eq("id", product.id);

      if (updateError) throw updateError;

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
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from("products")
        .update({
          status: "active",
          published_at: new Date().toISOString(),
        })
        .eq("id", product.id)
        .eq("status", "draft");

      if (updateError) throw updateError;

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
        <aside className={styles.adminSidebar}>
          <a href="/admin" className={styles.adminBrand}>
            <span>MIVO</span>
            <small>STORE CONTROL</small>
          </a>

          <nav className={styles.adminSideNav}>
            <a href="/admin"><span>01</span>Dashboard</a>
            <a href="/admin/orders"><span>02</span>Orders</a>
            <a href="/admin/arrange-shipment"><span>03</span>Arrange Shipment</a>
            <a href="/admin/claims"><span>04</span>Claims</a>
            <a href="/admin/marketing"><span>05</span>Marketing Centre</a>
            <a href="/admin/products" className={styles.active}><span>06</span>Products</a>
            <a href="/admin/products/new"><span>07</span>Add Product</a>
            <a href="/admin/shipping"><span>08</span>Shipping</a>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>STORE MODE</span>
            <strong>MIVO DIRECT</strong>
            <a href="/">OPEN STOREFRONT ↗</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MIVO STORE CONTROL · CATALOGUE
              </span>
              <h1>Products</h1>
              <p>
                Shopee-style catalogue management with quick edit, copy and delist controls.
              </p>
            </div>

            <div className={styles.adminHeaderActions}>
              <div className={styles.adminAttention}>
                <span>PRODUCTS SHOWN</span>
                <strong>{loading ? "—" : filtered.length}</strong>
              </div>
              <a href="/admin/products/new" className={styles.adminAction}>
                + ADD PRODUCT
              </a>
            </div>
          </header>

          <section className={styles.adminPanel}>
            <div className={styles.adminPanelHead}>
              <div>
                <span className={styles.adminPanelKicker}>
                  CATALOGUE MANAGEMENT
                </span>
                <h2>Product Catalogue</h2>
                <p>
                  Manage live listings, restock items and unpublished products.
                </p>
              </div>
            </div>

            <div className={styles.productStatusTabs}>
              <button
                type="button"
                className={catalogTab === "live" ? styles.active : ""}
                onClick={() => {
                  setCatalogTab("live");
                  setLiveTab("all");
                }}
              >
                <span>Live</span>
                <b>({liveCount})</b>
              </button>
              <button
                type="button"
                className={catalogTab === "unpublished" ? styles.active : ""}
                onClick={() => setCatalogTab("unpublished")}
              >
                <span>Unpublished</span>
                <b>({unpublishedCount})</b>
              </button>
            </div>

            {catalogTab === "live" ? (
              <div className={styles.productLiveSubTabs}>
                <button
                  type="button"
                  className={liveTab === "all" ? styles.active : ""}
                  onClick={() => setLiveTab("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={liveTab === "restock" ? styles.active : ""}
                  onClick={() => setLiveTab("restock")}
                >
                  Restock ({restockCount})
                </button>
              </div>
            ) : null}

            <div className={styles.productCatalogueSearch}>
              <label className={styles.adminField}>
                <span>SEARCH</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Product name, SKU, variation or brand"
                />
              </label>
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
                      <th>PRODUCT / VARIATION</th>
                      <th>BRAND</th>
                      <th>SKU</th>
                      <th>PRICE</th>
                      <th>STOCK</th>
                      <th>STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filtered.map((product) => {
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
                                {product.primary_image_url ? (
                                  <img
                                    className={styles.adminProductThumb}
                                    src={product.primary_image_url}
                                    alt={product.name}
                                  />
                                ) : (
                                  <div
                                    className={styles.adminProductThumb}
                                  />
                                )}

                                <div>
                                  <strong>{product.name}</strong>
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
                                      ? "HIDE"
                                      : "SHOW"}{" "}
                                    VARIATIONS
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
                                  EDIT
                                </a>

                                <button
                                  type="button"
                                  className={styles.productActionButton}
                                  disabled={productActionId === product.id}
                                  onClick={() => copyProduct(product)}
                                >
                                  {productActionId === product.id
                                    ? "WORKING..."
                                    : "COPY"}
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
                                    DELIST
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
                                    LIST
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
                                        ? "PUBLISHING..."
                                        : "PUBLISH"}
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
                                        ? "WORKING..."
                                        : deleteConfirmId === product.id
                                          ? "CONFIRM DELETE"
                                          : "DELETE"}
                                    </button>
                                  </>
                                ) : null}

                                {product.status === "active" ? (
                                  <a
                                    href={"/products/" + product.slug}
                                    className={styles.adminTextAction}
                                    target="_blank"
                                  >
                                    VIEW
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
                                    className={styles.productVariantRow}
                                    key={variant.id}
                                  >
                                    <td>
                                      <div
                                        className={
                                          styles.productVariantIdentity
                                        }
                                      >
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
                                          LOW STOCK
                                        </span>
                                      ) : (
                                        <span
                                          className={
                                            styles.quickStockOkay
                                          }
                                        >
                                          IN STOCK
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
                                              ? "SAVING..."
                                              : "SAVE"}
                                          </button>
                                          <button
                                            type="button"
                                            className={
                                              styles.quickCancelButton
                                            }
                                            onClick={cancelQuickEdit}
                                          >
                                            CANCEL
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
                                          QUICK EDIT
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
          </section>
        </section>
      </div>
    </main>
  );
}
