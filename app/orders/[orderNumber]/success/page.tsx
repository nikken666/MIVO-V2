"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";

type OrderSummary = {
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number | string;
};

export default function PaymentSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = String(params.orderNumber || "");
  const sessionId =
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("session_id") || "";

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function loadOrder() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(
          "/login?next=/orders/" +
            encodeURIComponent(orderNumber) +
            "/success"
        );
        return;
      }

      if (sessionId) {
        await supabase.rpc("sync_stripe_paid_order", {
          p_order_number: orderNumber,
          p_session_id: sessionId,
        });
      }

      const { data } = await supabase
        .from("orders")
        .select("order_number, status, payment_status, total_amount")
        .eq("order_number", orderNumber)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (data) {
        setOrder(data as OrderSummary);

        if (
          data.payment_status === "paid" ||
          data.status === "paid" ||
          data.status === "processing" ||
          data.status === "packed" ||
          data.status === "shipped" ||
          data.status === "delivered"
        ) {
          if (timer) clearInterval(timer);
        }
      }

      setLoading(false);
    }

    void loadOrder();
    timer = setInterval(() => void loadOrder(), 2000);

    const stop = setTimeout(() => {
      if (timer) clearInterval(timer);
    }, 20000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      clearTimeout(stop);
    };
  }, [orderNumber, router, sessionId]);

  const confirmed =
    order?.payment_status === "paid" ||
    ["paid", "processing", "packed", "shipped", "delivered"].includes(
      order?.status || ""
    );

  return (
    <main className="accountDataPage">
      <div
        className="container"
        style={{
          minHeight: "72vh",
          display: "grid",
          placeItems: "center",
          paddingTop: 40,
          paddingBottom: 60,
        }}
      >
        <section
          style={{
            width: "min(720px, 100%)",
            background: "#fff",
            border: "1px solid #e9e9e9",
            borderRadius: 24,
            padding: "52px 34px",
            textAlign: "center",
            boxShadow: "0 18px 60px rgba(0,0,0,.06)",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: 74,
              height: 74,
              margin: "0 auto 24px",
              borderRadius: "50%",
              display: "grid",
              placeItems: "center",
              background: "#111",
              color: "#fff",
              fontSize: 34,
              fontWeight: 700,
            }}
          >
            ✓
          </div>

          <p
            style={{
              margin: "0 0 10px",
              fontSize: 12,
              letterSpacing: ".16em",
              fontWeight: 700,
              color: "#777",
            }}
          >
            MIVO PAYMENT
          </p>

          <h1
            style={{
              margin: 0,
              fontSize: "clamp(30px, 5vw, 48px)",
              lineHeight: 1.05,
              letterSpacing: "-.04em",
            }}
          >
            PAYMENT SUCCESSFUL
          </h1>

          <p
            style={{
              maxWidth: 520,
              margin: "18px auto 0",
              color: "#666",
              lineHeight: 1.7,
            }}
          >
            {confirmed
              ? "Your payment has been confirmed. We are preparing your order."
              : "Your payment was completed successfully. We are confirming the order status now."}
          </p>

          <div
            style={{
              margin: "34px auto 30px",
              maxWidth: 470,
              borderTop: "1px solid #eee",
              borderBottom: "1px solid #eee",
              padding: "20px 0",
              display: "grid",
              gap: 12,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
              }}
            >
              <span style={{ color: "#777" }}>Order ID</span>
              <strong>{order?.order_number || orderNumber}</strong>
            </div>

            {order ? (
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 20,
                }}
              >
                <span style={{ color: "#777" }}>Total paid</span>
                <strong>{formatPrice(Number(order.total_amount))}</strong>
              </div>
            ) : null}

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 20,
              }}
            >
              <span style={{ color: "#777" }}>Payment status</span>
              <strong>
                {loading ? "CHECKING..." : confirmed ? "PAID" : "CONFIRMING"}
              </strong>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
              maxWidth: 470,
              margin: "0 auto",
            }}
          >
            <Link
              className="orderPrimaryButton"
              href={"/orders/" + encodeURIComponent(orderNumber)}
            >
              VIEW ORDER
            </Link>
            <Link className="orderGhostButton" href="/products">
              CONTINUE SHOPPING
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
