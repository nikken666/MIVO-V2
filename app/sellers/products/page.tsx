"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Seller.module.css";

type SellerProduct = {
  id: string;
  name: string;
  slug: string;
  status: string;
  primary_image_url: string | null;
  created_at: string;
  product_variants:
    | Array<{
        sku: string;
        price: number;
        stock_on_hand: number;
        stock_reserved: number;
      }>
    | null;
};

export default function SellerProductsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<SellerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?next=/sellers/products";
        return;
      }

      const { data: seller } = await supabase
        .from("sellers")
        .select("id, status")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (!seller || seller.status !== "approved") {
        window.location.href = "/sellers";
        return;
      }

      const { data, error: productError } = await supabase
        .from("products")
        .select(
          "id, name, slug, status, primary_image_url, created_at, product_variants(sku, price, stock_on_hand, stock_reserved)"
        )
        .eq("seller_id", seller.id)
        .order("created_at", { ascending: false });

      if (productError) setError(productError.message);
      setProducts((data as SellerProduct[] | null) || []);
      setLoading(false);
    }

    void load();
  }, [supabase]);

  return (
    <main className="container pageShell">
      <section className={styles.panel}>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.eyebrow}>SELLER PRODUCTS</span>
            <h1>Manage products</h1>
            <p>New products remain pending until MIVO approves them.</p>
          </div>
          <Link href="/sellers/products/new" className="redButton">
            + Upload product
          </Link>
        </div>

        {error && <p className={styles.error}>{error}</p>}
        {loading && <p>Loading products...</p>}

        {!loading && products.length === 0 && (
          <p className={styles.notice}>
            No products yet. Use “Upload product” to create the first listing.
          </p>
        )}

        {products.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Price</th>
                  <th>Available stock</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => {
                  const variant = product.product_variants?.[0];
                  const available =
                    (variant?.stock_on_hand || 0) -
                    (variant?.stock_reserved || 0);

                  return (
                    <tr key={product.id}>
                      <td>{product.name}</td>
                      <td>{variant?.sku || "—"}</td>
                      <td>
                        {variant
                          ? `RM ${Number(variant.price).toFixed(2)}`
                          : "—"}
                      </td>
                      <td>{available}</td>
                      <td>
                        <span className={styles.status}>{product.status}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.actions} style={{ marginTop: 20 }}>
          <Link href="/sellers" className={styles.secondaryButton}>
            ← Seller dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}
