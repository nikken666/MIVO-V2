"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  primary_image_url: string | null;
  created_at: string;
  brands: { name: string } | Array<{ name: string }> | null;
  product_variants:
    | Array<{
        sku: string;
        price: number | string;
        stock_on_hand: number;
        stock_reserved: number;
      }>
    | null;
};

function relationName(
  value: { name?: string; shop_name?: string } | Array<{ name?: string; shop_name?: string }> | null
) {
  const row = Array.isArray(value) ? value[0] : value;
  return row?.name || row?.shop_name || "—";
}

export default function AdminProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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

        const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
        if (adminError) throw adminError;
        if (!isAdmin) {
          window.location.href = "/";
          return;
        }

        const { data, error: productError } = await supabase
          .from("products")
          .select(
            "id, name, slug, status, primary_image_url, created_at, brands(name), product_variants(sku, price, stock_on_hand, stock_reserved)"
          )
          .order("created_at", { ascending: false });

        if (productError) throw productError;
        setProducts((data as ProductRow[] | null) || []);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load products.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((product) => {
      const firstVariant = product.product_variants?.[0];
      const matchesQuery =
        !q ||
        [
          product.name,
          relationName(product.brands),
          firstVariant?.sku || "",
        ]
          .join(" ")
          .toLowerCase()
          .includes(q);

      const matchesStatus = status === "all" || product.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [products, query, status]);

  return (
    <main className={styles.adminShell}>
      <div className="container">
        <div className={styles.adminTop}>
          <div>
            <span className={styles.adminEyebrow}>MIVO ADMIN · CATALOGUE</span>
            <h1>Products</h1>
            <p>Manage listings, SKU, price, stock, status and fitment.</p>
          </div>
          <Link href="/admin/products/new" className={styles.adminAction}>
            + ADD PRODUCT
          </Link>
        </div>

        <nav className={styles.adminNav}>
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/products/new">Add Product</Link>
          
          <Link href="/admin/orders">Orders</Link>
        </nav>

        <section className={styles.adminPanel}>
          <div className={styles.adminPanelHead}>
            <div>
              <h2>Product Catalogue</h2>
              <p>{loading ? "Loading..." : filtered.length + " products shown"}</p>
            </div>
          </div>

          <div className={styles.adminFormGrid} style={{ marginBottom: 18 }}>
            <label className={styles.adminField}>
              <span>SEARCH</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Product name, SKU or brand"
              />
            </label>

            <label className={styles.adminField}>
              <span>STATUS</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="all">All status</option>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="pending_review">Pending review</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          {error ? <p className={styles.adminError}>{error}</p> : null}
          {loading ? <p className={styles.adminNotice}>Loading products...</p> : null}

          {!loading && !error && (
            <div className={styles.adminTableWrap}>
              <table className={styles.adminTable}>
                <thead>
                  <tr>
                    <th>PRODUCT</th>
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
                    const first = variants[0];
                    const stock = variants.reduce(
                      (sum, item) =>
                        sum + Math.max(0, Number(item.stock_on_hand || 0) - Number(item.stock_reserved || 0)),
                      0
                    );
                    const minPrice = variants.length
                      ? Math.min(...variants.map((item) => Number(item.price)))
                      : null;

                    return (
                      <tr key={product.id}>
                        <td>
                          <div className={styles.adminProductCell}>
                            {product.primary_image_url ? (
                              <img
                                className={styles.adminProductThumb}
                                src={product.primary_image_url}
                                alt={product.name}
                              />
                            ) : (
                              <div className={styles.adminProductThumb} />
                            )}
                            <div>
                              <strong>{product.name}</strong>
                              <div style={{ color: "#8b9094", marginTop: 4 }}>
                                {variants.length} SKU{variants.length === 1 ? "" : "s"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{relationName(product.brands)}</td>
                        <td>{first?.sku || "—"}</td>
                        <td>{minPrice === null ? "—" : "RM " + minPrice.toFixed(2)}</td>
                        <td>{stock}</td>
                        <td>
                          <span className={styles.adminStatus}>{product.status}</span>
                        </td>
                        <td>
                          <Link
                            href={"/products/" + product.slug}
                            className={styles.adminSecondary}
                            target="_blank"
                          >
                            VIEW
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
