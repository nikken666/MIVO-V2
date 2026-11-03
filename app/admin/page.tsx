"use client";

import { useEffect, useState } from "react";
import { leaveBackOffice } from "@/lib/leaveBackOffice";
import { createClient } from "@/lib/supabase/client";
import styles from "./Admin.module.css";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTodo from "@/components/admin/AdminTodo";

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
  openClaims: number;
};

function money(value: number) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(value);
}

function statusLabel(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export default function AdminPage() {
  const [stats, setStats] = useState<DashboardStats>({
    todaySales: 0,
    ordersToday: 0,
    pendingPayment: 0,
    toShip: 0,
    lowStock: 0,
    activeProducts: 0,
    openClaims: 0,
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
          leaveBackOffice();
          return;
        }

        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const startIso = start.toISOString();

        const [
          { data: orderData, error: orderError },
          { data: variantData, error: variantError },
          { count: activeProducts, error: productError },
          { count: openClaims, error: claimsError },
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
          supabase
            .from("warranty_claims")
            .select("*", { count: "exact", head: true })
            .in("status", ["new", "reviewing", "approved"]),
        ]);

        if (orderError || variantError || productError || claimsError) {
          throw orderError || variantError || productError || claimsError;
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
          openClaims: openClaims || 0,
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


  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>MIVO control centre</span>
              <h1>Dashboard</h1>
              <p>What needs you first, then today&rsquo;s sales.</p>
            </div>

            <div className={styles.adminHeaderActions}>
              <a href="/admin/products/new" className={styles.adminAction}>
                + Add product
              </a>
            </div>
          </header>

          {error ? <p className={styles.adminError}>{error}</p> : null}

          <AdminTodo />

          <div className={styles.dashboardStats}>
            <a href="/admin/orders?tab=all" className={styles.dashboardStatPrimary}>
              <span>Today sales</span>
              <strong>{loading ? "—" : money(stats.todaySales)}</strong>
              <small>Paid orders today · View</small>
            </a>

            <a href="/admin/orders?tab=all" className={styles.dashboardStat}>
              <span>Orders today</span>
              <strong>{loading ? "—" : stats.ordersToday}</strong>
              <small>New orders · View</small>
            </a>

            <a href="/admin/orders?tab=to_pay" className={styles.dashboardStat}>
              <span>Pending payment</span>
              <strong>{loading ? "—" : stats.pendingPayment}</strong>
              <small>Auto-cancel after 24h · View</small>
            </a>


            <a href="/admin/products?stock=low" className={styles.dashboardStat}>
              <span>Low stock</span>
              <strong>{loading ? "—" : stats.lowStock}</strong>
              <small>At or below threshold · View</small>
            </a>


            <a href="/admin/products?status=active" className={styles.dashboardStat}>
              <span>Active products</span>
              <strong>{loading ? "—" : stats.activeProducts}</strong>
              <small>Live catalogue · View</small>
            </a>
          </div>

          <div>
            <section className={styles.adminPanel}>
              <div className={styles.adminPanelHead}>
                <div>
                  <span className={styles.adminPanelKicker}>Live operations</span>
                  <h2>Recent Orders</h2>
                  <p>Latest customer activity across MIVO.</p>
                </div>
                <a href="/admin/orders" className={styles.adminTextLink}>
                  View all orders
                </a>
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
                      <a
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
                      </a>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        </section>
      </div>
    </main>
  );
}
