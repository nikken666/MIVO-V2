"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";

type OrderRow = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
  created_at: string;
  shipping_address: Record<string, string> | null;
};

function formatOrderStatus(value: string) {
  return value.replaceAll("_", " ").toUpperCase();
}

export default function OrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login?next=/orders");
        return;
      }

      const { data, error: orderError } = await supabase
        .from("orders")
        .select(
          "id, order_number, status, payment_status, total_amount, created_at, shipping_address"
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (orderError) {
        setError(orderError.message);
        setLoading(false);
        return;
      }

      setOrders((data as OrderRow[] | null) || []);
      setLoading(false);
    }

    void load();
  }, [router]);

  return (
    <main className="accountDataPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>MIVO ACCOUNT</span>
            <h1>My Orders</h1>
            <p>View every order placed with your MIVO account.</p>
          </div>

          <Link href="/account">← ACCOUNT</Link>
        </div>

        <section className="ordersPanel">
          <div className="ordersPanelHead">
            <div>
              <span>ORDER HISTORY</span>
              <strong>
                {loading ? "—" : orders.length}
              </strong>
            </div>
            <Link href="/products">SHOP PARTS →</Link>
          </div>

          {loading ? (
            <p className="accountDataNotice">Loading your orders...</p>
          ) : error ? (
            <p className="accountDataError">{error}</p>
          ) : orders.length === 0 ? (
            <div className="ordersEmpty">
              <strong>No orders yet.</strong>
              <p>Your MIVO orders will appear here after checkout.</p>
              <Link href="/products">BROWSE PARTS →</Link>
            </div>
          ) : (
            <div className="orderList">
              {orders.map((order) => {
                const address = order.shipping_address || {};
                const date = new Date(order.created_at);

                return (
                  <Link
                    href={"/orders/" + encodeURIComponent(order.order_number)}
                    className="orderListCard"
                    key={order.id}
                  >
                    <div className="orderListPrimary">
                      <span>ORDER</span>
                      <strong>{order.order_number}</strong>
                      <small>
                        {date.toLocaleDateString("en-MY", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </small>
                    </div>

                    <div className="orderListMeta">
                      <div>
                        <span>STATUS</span>
                        <strong>{formatOrderStatus(order.status)}</strong>
                      </div>
                      <div>
                        <span>PAYMENT</span>
                        <strong>{formatOrderStatus(order.payment_status)}</strong>
                      </div>
                      <div>
                        <span>DELIVERY</span>
                        <strong>
                          {[address.city, address.state]
                            .filter(Boolean)
                            .join(", ") || "Malaysia"}
                        </strong>
                      </div>
                    </div>

                    <div className="orderListTotal">
                      <span>TOTAL</span>
                      <strong>{formatPrice(Number(order.total_amount))}</strong>
                      <b>VIEW ORDER →</b>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
