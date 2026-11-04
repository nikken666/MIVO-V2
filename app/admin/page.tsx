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

        // Exact counts from the database (a plain select stops at 1,000 rows).
        const count = async (query: PromiseLike<{ count: number | null; error: unknown }>) => {
          const { count: n, error: countError } = await query;
          if (countError) throw countError;
          return n || 0;
        };
        const [
          { data: recentData, error: recentError },
          { data: todayData, error: todayError },
          ordersToday,
          pendingPayment,
          toShip,
          activeProducts,
          openClaims,
          lowStock,
        ] = await Promise.all([
          supabase
            .from("orders")
            .select("id, order_number, status, payment_status, total_amount, created_at, paid_at, shipping_address")
            .order("created_at", { ascending: false })
            .limit(6),
          // Money taken today: orders paid today that weren't cancelled (shipped and delivered count too).
          supabase
            .from("orders")
            .select("total_amount, payment_status, status")
            .gte("paid_at", startIso)
            .in("payment_status", ["paid", "partially_refunded"])
            .not("status", "in", "(cancelled,refunded)"),
          count(supabase.from("orders").select("id", { count: "exact", head: true }).gte("created_at", startIso)),
          count(supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "pending_payment")),
          count(supabase.from("orders").select("id", { count: "exact", head: true }).in("status", ["paid", "processing", "packed"])),
          count(supabase.from("products").select("*", { count: "exact", head: true }).eq("status", "active")),
          count(supabase.from("warranty_claims").select("*", { count: "exact", head: true }).in("status", ["new", "reviewing", "approved"])),
          // Low stock compares two columns, so read every active option in pages.
          (async () => {
            let low = 0;
            for (let from = 0; from < 200000; from += 1000) {
              const { data, error: pageError } = await supabase
                .from("product_variants")
                .select("stock_on_hand, stock_reserved, low_stock_threshold")
                .eq("is_active", true)
                .order("id")
                .range(from, from + 999);
              if (pageError) throw pageError;
              for (const variant of (data || []) as VariantRow[]) {
                const available = Number(variant.stock_on_hand || 0) - Number(variant.stock_reserved || 0);
                if (available <= Number(variant.low_stock_threshold || 0)) low++;
              }
              if (!data || data.length < 1000) break;
            }
            return low;
          })(),
        ]);

        if (recentError || todayError) throw recentError || todayError;

        const orders = (recentData as OrderRow[] | null) || [];
        const todaySales = ((todayData || []) as Array<{ total_amount: number }>).reduce(
          (sum, order) => sum + Number(order.total_amount || 0),
          0
        );

        setStats({
          todaySales,
          ordersToday,
          pendingPayment,
          toShip,
          lowStock,
          activeProducts,
          openClaims,
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
