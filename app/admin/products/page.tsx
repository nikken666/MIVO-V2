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

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const [quickEditId, setQuickEditId] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [quickStock, setQuickStock] = useState("");
  const [savingVariantId, setSavingVariantId] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requestedStatus = params.get("status");
    const requestedStock = params.get("stock");

    if (
      requestedStatus &&
      ["all", "active", "draft", "pending_review", "inactive"].includes(
        requestedStatus
      )
    ) {
      setStatus(requestedStatus);
    }

    if (requestedStock === "low") {
      setStockFilter("low");
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

      const matchesStatus = status === "all" || product.status === status;
      const matchesStock =
        stockFilter !== "low" ||
        variants.some(
          (item) =>
            availableStock(item) <= Number(item.low_stock_threshold || 0)
        );

      return matchesQuery && matchesStatus && matchesStock;
    });
  }, [products, query, status, stockFilter]);

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

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <aside className={styles.adminSidebar}>
          <a href="/admin" className={styles.adminBrand}>
            <span>MIVO</span>
            <small>STORE CONTROL</small>
          </a>

          <nav className={styles.adminSideNav}>
            <a href="/admin">
              <span>01</span>
              Dashboard
            </a>
            <a href="/admin/orders">
              <span>02</span>
              Orders
            </a>
            <a href="/admin/products" className={styles.active}>
              <span>03</span>
              Products
            </a>
            <a href="/admin/products/new">
              <span>04</span>
              Add Product
            </a>
            <a href="/admin/shipping">
              <span>05</span>
              Shipping
            </a>
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
                Shopee-style catalogue management with quick price and stock
                editing.
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
                  Edit full listings or update price and stock directly from
                  this page.
                </p>
              </div>
            </div>

            <div
              className={styles.adminFormGrid}
              style={{ marginBottom: 18 }}
            >
              <label className={styles.adminField}>
                <span>SEARCH</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Product name, SKU, variation or brand"
                />
              </label>

              <label className={styles.adminField}>
                <span>STATUS</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="all">All status</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="pending_review">Pending review</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>

              <label className={styles.adminField}>
                <span>STOCK</span>
                <select
                  value={stockFilter}
                  onChange={(event) => setStockFilter(event.target.value)}
                >
                  <option value="all">All stock</option>
                  <option value="low">Low stock only</option>
                </select>
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
                                <a
                                  href={"/products/" + product.slug}
                                  className={styles.adminTextAction}
                                  target="_blank"
                                >
                                  VIEW
                                </a>
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
