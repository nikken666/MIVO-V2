"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import styles from "./Success.module.css";

type OrderSummary = {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  subtotal: number | string;
  shipping_amount: number | string | null;
  discount_amount: number | string | null;
  voucher_code: string | null;
  total_amount: number | string;
  paid_at: string | null;
  stripe_payment_method: string | null;
};

type ReceiptItem = {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  line_subtotal: number | string;
};

const paidStatuses = ["paid", "processing", "packed", "shipped", "delivered"];

function isPaid(order: OrderSummary | null) {
  return Boolean(
    order && (order.payment_status === "paid" || paidStatuses.includes(order.status))
  );
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

/** Counts up to the paid total once the receipt has printed. */
function useCountUp(target: number, start: boolean, duration = 900) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (prefersReducedMotion()) {
      setValue(target);
      return;
    }
    let frame = 0;
    const began = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(target * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, start, duration]);
  return value;
}

const burstDots = Array.from({ length: 14 }, (_, i) => i);

export default function PaymentSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<OrderSummary | null>(null);
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const itemsLoaded = useRef(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;
    const sessionId =
      new URLSearchParams(window.location.search).get("session_id") || "";

    async function loadOrder() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace(
          "/login?next=/orders/" + encodeURIComponent(orderNumber) + "/success"
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
        .select(
          "id, order_number, status, payment_status, subtotal, shipping_amount, discount_amount, voucher_code, total_amount, paid_at, stripe_payment_method"
        )
        .eq("order_number", orderNumber)
        .eq("user_id", user.id)
        .maybeSingle();

      if (!active) return;

      if (data) {
        const summary = data as OrderSummary;
        if (!itemsLoaded.current) {
          itemsLoaded.current = true;
          const { data: itemData } = await supabase
            .from("order_items")
            .select("id, product_name, variant_name, quantity, line_subtotal")
            .eq("order_id", summary.id)
            .order("created_at");
          if (active) setItems((itemData as ReceiptItem[] | null) || []);
        }
        setOrder(summary);
        if (isPaid(summary) && timer) clearInterval(timer);
      }

      setLoading(false);
    }

    void loadOrder();
    timer = setInterval(() => void loadOrder(), 2000);
    const stop = setTimeout(() => {
      if (timer) clearInterval(timer);
      if (active) setTimedOut(true);
    }, 20000);

    return () => {
      active = false;
      if (timer) clearInterval(timer);
      clearTimeout(stop);
    };
  }, [orderNumber, router]);

  const confirmed = isPaid(order);
  const total = Number(order?.total_amount || 0);
  const shown = useCountUp(total, confirmed);
  const shipping = Number(order?.shipping_amount || 0);
  const discount = Number(order?.discount_amount || 0);
  const paidAt = order?.paid_at ? new Date(order.paid_at) : new Date();

  // Rows appear one after another as the paper prints.
  let row = 0;
  const nextRow = () => ({ ["--row" as string]: row++ }) as React.CSSProperties;

  return (
    <main className={styles.page}>
      <section
        className={styles.stage + (confirmed ? " " + styles.done : "")}
        aria-live="polite"
      >
        <div className={styles.badge} aria-hidden="true">
          <span className={styles.ring} />
          <span className={styles.pulse} />
          <svg viewBox="0 0 52 52" className={styles.check}>
            <circle cx="26" cy="26" r="24" />
            <path d="M15 27.5l7 7 15-16" />
          </svg>
          <span className={styles.burst}>
            {burstDots.map((i) => (
              <i key={i} style={{ ["--i" as string]: i } as React.CSSProperties} />
            ))}
          </span>
        </div>

        <p className={styles.kicker}>MIVO payment</p>
        <h1 className={styles.title}>
          {confirmed ? "Payment successful" : "Confirming payment…"}
        </h1>
        <p className={styles.lead}>
          {confirmed
            ? "Thank you! Your order is confirmed and we're getting it ready."
            : timedOut
              ? "Your payment went through. Confirmation is taking a little longer — your order page will update shortly."
              : "Hang tight, we're confirming your payment with the bank."}
        </p>

        <div className={styles.printer}>
          <div className={styles.slot} aria-hidden="true" />
          <article className={styles.paper} aria-label="Receipt">
            <header className={styles.paperHead} style={nextRow()}>
              <strong>MIVO</strong>
              <span>Official receipt</span>
            </header>

            <div className={styles.meta} style={nextRow()}>
              <div>
                <span>Order</span>
                <strong>{order?.order_number || orderNumber}</strong>
              </div>
              <div>
                <span>Date</span>
                <strong>
                  {paidAt.toLocaleString("en-MY", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </strong>
              </div>
            </div>

            <hr className={styles.rule} style={nextRow()} />

            <ul className={styles.items}>
              {items.slice(0, 6).map((item) => (
                <li key={item.id} style={nextRow()}>
                  <span>
                    <b>{item.quantity}×</b> {item.product_name}
                    {item.variant_name ? <small>{item.variant_name}</small> : null}
                  </span>
                  <strong>{formatPrice(Number(item.line_subtotal))}</strong>
                </li>
              ))}
              {items.length > 6 ? (
                <li style={nextRow()}>
                  <span>+ {items.length - 6} more item(s)</span>
                  <strong />
                </li>
              ) : null}
            </ul>

            <hr className={styles.rule} style={nextRow()} />

            <dl className={styles.sums}>
              <div style={nextRow()}>
                <dt>Subtotal</dt>
                <dd>{formatPrice(Number(order?.subtotal || 0))}</dd>
              </div>
              <div style={nextRow()}>
                <dt>Shipping</dt>
                <dd>{shipping ? formatPrice(shipping) : "Free"}</dd>
              </div>
              {discount > 0 ? (
                <div style={nextRow()} className={styles.discount}>
                  <dt>Voucher{order?.voucher_code ? " · " + order.voucher_code : ""}</dt>
                  <dd>− {formatPrice(discount)}</dd>
                </div>
              ) : null}
              <div style={nextRow()} className={styles.total}>
                <dt>Total paid</dt>
                <dd>{formatPrice(confirmed ? shown : total)}</dd>
              </div>
            </dl>

            <div className={styles.stamp} style={nextRow()}>
              <span>PAID</span>
              <small>
                {order?.stripe_payment_method
                  ? order.stripe_payment_method.toUpperCase()
                  : "CARD / FPX"}
              </small>
            </div>

            <div className={styles.zigzag} aria-hidden="true" />
          </article>
        </div>

        <div className={styles.actions}>
          <Link
            className={styles.primary}
            href={"/orders/" + encodeURIComponent(orderNumber)}
          >
            Track my order
          </Link>
          <Link
            className={styles.secondary}
            href={"/orders/" + encodeURIComponent(orderNumber) + "/receipt"}
          >
            Download receipt
          </Link>
          <Link className={styles.link} href="/products">
            Continue shopping ›
          </Link>
        </div>

        {loading ? <span className={styles.srOnly}>Loading order…</span> : null}
      </section>
    </main>
  );
}
