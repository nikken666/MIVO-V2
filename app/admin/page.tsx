"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./Admin.module.css";

type DashboardStats = {
  products: number;
  activeProducts: number;
  sellers: number;
  pendingProducts: number;
};

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats>({
    products: 0,
    activeProducts: 0,
    sellers: 0,
    pendingProducts: 0,
  });
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
          window.location.href = "/login?next=/admin";
          return;
        }

        const { data: isAdmin, error: adminError } = await supabase.rpc("is_admin");
        if (adminError) throw adminError;

        if (!isAdmin) {
          window.location.href = "/";
          return;
        }

        const [
          { count: productCount },
          { count: activeCount },
          { count: sellerCount },
          { count: pendingCount },
        ] = await Promise.all([
          supabase.from("products").select("*", { count: "exact", head: true }),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase.from("sellers").select("*", { count: "exact", head: true }),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending_review"),
        ]);

        setStats({
          products: productCount || 0,
          activeProducts: activeCount || 0,
          sellers: sellerCount || 0,
          pendingProducts: pendingCount || 0,
        });
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to load admin data.");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const statCards = [
    ["TOTAL PRODUCTS", stats.products],
    ["ACTIVE PRODUCTS", stats.activeProducts],
    ["SELLERS", stats.sellers],
    ["PENDING REVIEW", stats.pendingProducts],
  ] as const;

  return (
    <main className={styles.adminShell}>
      <div className="container">
        <div className={styles.adminTop}>
          <div>
            <span className={styles.adminEyebrow}>MIVO CONTROL CENTER</span>
            <h1>Admin Console</h1>
            <p>Manage catalogue, fitment, stock and marketplace operations.</p>
          </div>
          <Link href="/admin/products/new" className={styles.adminAction}>
            + ADD PRODUCT
          </Link>
        </div>

        <nav className={styles.adminNav}>
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/products">Products</Link>
          <Link href="/admin/products/new">Add Product</Link>
          <Link href="/admin/fitment">Fitment</Link>
          <Link href="/admin/orders">Orders</Link>
          <Link href="/admin/sellers">Sellers</Link>
        </nav>

        {error ? <p className={styles.adminError}>{error}</p> : null}
        {loading ? <p className={styles.adminNotice}>Loading MIVO admin data...</p> : null}

        <div className={styles.adminStats}>
          {statCards.map(([label, value]) => (
            <article className={styles.adminStat} key={label}>
              <span>{label}</span>
              <strong>{loading ? "—" : value}</strong>
            </article>
          ))}
        </div>

        <section className={styles.adminPanel}>
          <div className={styles.adminPanelHead}>
            <div>
              <h2>Catalogue Operations</h2>
              <p>Start with products, inventory and vehicle fitment.</p>
            </div>
          </div>

          <div className={styles.adminStats}>
            <article className={styles.adminStat}>
              <span>PRODUCT CATALOGUE</span>
              <strong>Manage</strong>
              <p>Review products, stock, price and listing status.</p>
              <Link href="/admin/products" className={styles.adminSecondary}>
                OPEN PRODUCTS
              </Link>
            </article>

            <article className={styles.adminStat}>
              <span>NEW LISTING</span>
              <strong>Upload</strong>
              <p>Create a product with images, SKU, price and inventory.</p>
              <Link href="/admin/products/new" className={styles.adminSecondary}>
                ADD PRODUCT
              </Link>
            </article>

            <article className={styles.adminStat}>
              <span>VEHICLE FITMENT</span>
              <strong>Match</strong>
              <p>Connect products to exact MIVO vehicle applications.</p>
              <Link href="/admin/fitment" className={styles.adminSecondary}>
                FITMENT MANAGER
              </Link>
            </article>

            <article className={styles.adminStat}>
              <span>ORDERS</span>
              <strong>Operate</strong>
              <p>Order workflow will be connected after catalogue setup.</p>
              <Link href="/admin/orders" className={styles.adminSecondary}>
                VIEW ORDERS
              </Link>
            </article>
          </div>
        </section>
      </div>
    </main>
  );
}
