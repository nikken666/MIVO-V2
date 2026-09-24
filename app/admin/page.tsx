"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./Admin.module.css";

type DashboardStats = {
  products: number;
  activeProducts: number;
  pendingProducts: number;
};

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats>({
    products: 0,
    activeProducts: 0,
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
          { count: pendingCount },
        ] = await Promise.all([
          supabase.from("products").select("*", { count: "exact", head: true }),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "pending_review"),
        ]);

        setStats({
          products: productCount || 0,
          activeProducts: activeCount || 0,
          pendingProducts: pendingCount || 0,
        });
      } catch (caught) {
        setError(
          caught instanceof Error ? caught.message : "Unable to load admin data."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const statCards = [
    ["TOTAL PRODUCTS", loading ? "—" : stats.products],
    ["ACTIVE PRODUCTS", loading ? "—" : stats.activeProducts],
    ["STORE MODE", "MIVO DIRECT"],
    ["PENDING REVIEW", loading ? "—" : stats.pendingProducts],
  ] as const;

  return (
    <main className={styles.adminShell}>
      <div className="container">
        <div className={styles.adminTop}>
          <div>
            <span className={styles.adminEyebrow}>MIVO CONTROL CENTER</span>
            <h1>Admin Console</h1>
            <p>Manage your MIVO catalogue, fitment, stock and customer orders.</p>
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
        </nav>

        {error ? <p className={styles.adminError}>{error}</p> : null}

        <div className={styles.adminStats}>
          {statCards.map(([label, value]) => (
            <article className={styles.adminStat} key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>

        <section className={styles.adminPanel}>
          <div className={styles.adminPanelHead}>
            <div>
              <h2>Store Operations</h2>
              <p>MIVO is configured as a self-operated automotive parts store.</p>
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
              <p>Create products directly under MIVO Direct Store.</p>
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
              <p>Manage customer orders and fulfilment from one place.</p>
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
