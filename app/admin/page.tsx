"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./Admin.module.css";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  created_at: string;
  paid_at: string | null;
  shipping_address: Record<string, string> | null;
};

type VariantRow = {
  stock_on_hand: number;
  stock_reserved: number;
  low_stock_threshold: number;
};

type DashboardStats = {
  todaySales: number;
  ordersToday: number;
  pendingPayment: number;
  toShip: number;
  lowStock: number;
  activeProducts: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function statusLabel(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    ordersToday: 0,
    pendingPayment: 0,
    toShip: 0,
    lowStock: 0,
    activeProducts: 0,
  });
  const [recentOrders, setRecentOrders] = useState<OrderRow[]>([]);
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

        const { data: isAdmin, error: adminError } = await supabase.rpc(
          "is_admin"
        );

        if (adminError) throw adminError;

        if (!isAdmin) {
          window.location.href = "/";
          return;
        }

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const startIso = start.toISOString();

        const [
          { data: orderData, error: orderError },
          { data: variantData, error: variantError },
          { count: activeProducts, error: productError },
        ] = await Promise.all([
          supabase
            .from("orders")
            .select(
              "id, order_number, status, payment_status, total_amount, created_at, paid_at, shipping_address"
            )
            .order("created_at", { ascending: false }),
          supabase
            .from("product_variants")
            .select(
              "stock_on_hand, stock_reserved, low_stock_threshold"
            )
            .eq("is_active", true),
          supabase
            .from("products")
            .select("*", { count: "exact", head: true })
            .eq("status", "active"),
        ]);

        if (orderError || variantError || productError) {
          throw orderError || variantError || productError;
        }

        const orders = (orderData as OrderRow[] | null) || [];
        const variants = (variantData as VariantRow[] | null) || [];

        const todaySales = orders
          .filter(
            (order) =>
              order.payment_status === "paid" &&
              order.paid_at &&
              order.paid_at >= startIso
          )
          .reduce(
            (sum, order) => sum + Number(order.total_amount || 0),
            0
          );

        const ordersToday = orders.filter(
          (order) => order.created_at >= startIso
        ).length;

        const pendingPayment = orders.filter(
          (order) => order.status === "pending_payment"
        ).length;

        const toShip = orders.filter((order) =>
          ["paid", "processing", "packed"].includes(order.status)
        ).length;

        const lowStock = variants.filter((variant) => {
          const available =
            Number(variant.stock_on_hand || 0) -
            Number(variant.stock_reserved || 0);
          return available <= Number(variant.low_stock_threshold || 0);
        }).length;

        setStats({
          todaySales,
          ordersToday,
          pendingPayment,
          toShip,
          lowStock,
          activeProducts: activeProducts || 0,
        });
        setRecentOrders(orders.slice(0, 6));
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load admin data."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  const alertCount = useMemo(
    () => stats.pendingPayment + stats.toShip + stats.lowStock,
    [stats]
  );

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <aside className={styles.adminSidebar}>
          <Link href="/admin" className={styles.adminBrand}>
            <span>MIVO</span>
            <small>STORE CONTROL</small>
          </Link>

          <nav className={styles.adminSideNav}>
            <Link href="/admin" className={styles.active}>
              <span>01</span>
              Dashboard
            </Link>
            <Link href="/admin/orders">
              <span>02</span>
              Orders
            </Link>
            <Link href="/admin/products">
              <span>03</span>
              Products
            </Link>
            <Link href="/admin/products/new">
              <span>04</span>
              Add Product
            </Link>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>STORE MODE</span>
            <strong>MIVO DIRECT</strong>
            <Link href="/">OPEN STOREFRONT ↗</Link>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO STORE CONTROL CENTER</span>
              <h1>Dashboard</h1>
              <p>Orders, sales and stock that need attention today.</p>
            </div>

            <div className={styles.adminHeaderActions}>
              <div className={styles.adminAttention}>
                <span>NEEDS ATTENTION</span>
                <strong>{loading ? "—" : alertCount}</strong>
              </div>
              <Link href="/admin/products/new" className={styles.adminAction}>
                + ADD PRODUCT
              </Link>
            </div>
          </header>

          {error ? <p className={styles.adminError}>{error}</p> : null}

          <div className={styles.dashboardStats}>
            <article className={styles.dashboardStatPrimary}>
              <span>TODAY SALES</span>
              <strong>{loading ? "—" : money(stats.todaySales)}</strong>
              <small>Paid orders today</small>
            </article>

            <article className={styles.dashboardStat}>
              <span>ORDERS TODAY</span>
              <strong>{loading ? "—" : stats.ordersToday}</strong>
              <small>New orders</small>
            </article>

            <article className={styles.dashboardStat}>
              <span>PENDING PAYMENT</span>
              <strong>{loading ? "—" : stats.pendingPayment}</strong>
              <small>Auto-cancel after 24h</small>
            </article>

            <article className={styles.dashboardStat}>
              <span>TO SHIP</span>
              <strong>{loading ? "—" : stats.toShip}</strong>
              <small>Paid / processing / packed</small>
            </article>

            <article className={styles.dashboardStat}>
              <span>LOW STOCK</span>
              <strong>{loading ? "—" : stats.lowStock}</strong>
              <small>At or below threshold</small>
            </article>

            <article className={styles.dashboardStat}>
              <span>ACTIVE PRODUCTS</span>
              <strong>{loading ? "—" : stats.activeProducts}</strong>
              <small>Live catalogue</small>
            </article>
          </div>

          <div className={styles.adminDashboardGrid}>
            <section className={styles.adminPanel}>
              <div className={styles.adminPanelHead}>
                <div>
                  <span className={styles.adminPanelKicker}>LIVE OPERATIONS</span>
                  <h2>Recent Orders</h2>
                  <p>Latest customer activity across MIVO.</p>
                </div>
                <Link href="/admin/orders" className={styles.adminTextLink}>
                  VIEW ALL ORDERS →
                </Link>
              </div>

              {loading ? (
                <p className={styles.adminNotice}>Loading orders...</p>
              ) : recentOrders.length === 0 ? (
                <p className={styles.adminNotice}>No orders yet.</p>
              ) : (
                <div className={styles.recentOrders}>
                  {recentOrders.map((order) => {
                    const address = order.shipping_address || {};
                    return (
                      <Link
                        href={"/admin/orders?order=" + encodeURIComponent(order.order_number)}
                        className={styles.recentOrder}
                        key={order.id}
                      >
                        <div>
                          <span>{order.order_number}</span>
                          <strong>
                            {address.full_name || "MIVO CUSTOMER"}
                          </strong>
                          <small>
                            {new Date(order.created_at).toLocaleString("en-MY", {
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </small>
                        </div>

                        <div className={styles.recentOrderRight}>
                          <span
                            className={
                              styles.adminStatus +
                              " " +
                              styles["status_" + order.status]
                            }
                          >
                            {statusLabel(order.status)}
                          </span>
                          <strong>{money(Number(order.total_amount))}</strong>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <aside className={styles.operationsPanel}>
              <span className={styles.adminPanelKicker}>QUICK ACTIONS</span>
              <h2>Store Operations</h2>

              <Link href="/admin/orders">
                <span>ORDERS</span>
                <strong>Process & ship →</strong>
              </Link>
              <Link href="/admin/products">
                <span>CATALOGUE</span>
                <strong>Open products →</strong>
              </Link>
              <Link href="/admin/products/new">
                <span>NEW LISTING</span>
                <strong>Add product →</strong>
              </Link>
            </aside>
          </div>
        </section>
      </div>
    </main>
  );
}
