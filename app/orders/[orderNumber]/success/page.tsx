"use client";

import Link from "next/link";
import CarRecommendations from "@/components/CarRecommendations";
import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import styles from "./Success.module.css";
import { useLanguage } from "@/components/LanguageProvider";
import { intlTag } from "@/lib/i18n/format";
import { trackPurchase } from "@/lib/analytics";

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
  product_id?: string | null;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  line_subtotal: number | string;
};

const paidStatuses = ["paid", "processing", "packed", "shipped", "delivered", "completed"];

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
  const { t, locale } = useLanguage();
  const orderNumber = String(params.orderNumber || "");

  const [order, setOrder] = useState<OrderSummary | null>(null);
  // Card held until shipping (supabase/payment-holds.sql): nothing charged yet.
  const [held, setHeld] = useState(false);
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
            .select("id, product_id, product_name, variant_name, quantity, line_subtotal")
            .eq("order_id", summary.id)
            .order("created_at");
          if (active) setItems((itemData as ReceiptItem[] | null) || []);
        }
        setOrder(summary);
        const { data: capture } = await supabase
          .from("orders")
          .select("payment_capture_status")
          .eq("id", summary.id)
          .maybeSingle();
        if (active) setHeld((capture as { payment_capture_status?: string } | null)?.payment_capture_status === "authorized");
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
  useEffect(() => {
    if (!confirmed || !order || !items.length) return;
    trackPurchase(
      {
        number: order.order_number,
        total: Number(order.total_amount) || 0,
        shipping: Number(order.shipping_amount) || 0,
        coupon: order.voucher_code || null,
      },
      items.map((item) => ({
        id: item.product_id || item.id,
        name: item.product_name,
        price: (Number(item.line_subtotal) || 0) / Math.max(1, Number(item.quantity) || 1),
        quantity: Number(item.quantity) || 1,
        variant: item.variant_name || null,
      }))
    );
  }, [confirmed, order, items]);
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

        <p className={styles.kicker}>{t("account.success.kicker")}</p>
        <h1 className={styles.title}>
          {confirmed ? t(held ? "account.success.titleHeld" : "account.success.title") : t("account.success.confirming")}
        </h1>
        <p className={styles.lead}>
          {confirmed
            ? t(held ? "account.success.leadHeld" : "account.success.lead")
            : timedOut
              ? t("account.success.slow")
              : t("account.success.wait")}
        </p>

        <div className={styles.printer}>
          <div className={styles.slot} aria-hidden="true" />
          <article className={styles.paper} aria-label={t("account.success.receipt")}>
            <header className={styles.paperHead} style={nextRow()}>
              <strong>MIVO</strong>
              <span>{t("account.receipt.official")}</span>
            </header>

            <div className={styles.meta} style={nextRow()}>
              <div>
                <span>{t("account.orders.order")}</span>
                <strong>{order?.order_number || orderNumber}</strong>
              </div>
              <div>
                <span>{t("account.receipt.date")}</span>
                <strong>
                  {paidAt.toLocaleString(intlTag(locale), {
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
                  <span>{t("account.orders.moreItems", { n: items.length - 6 })}</span>
                  <strong />
                </li>
              ) : null}
            </ul>

            <hr className={styles.rule} style={nextRow()} />

            <dl className={styles.sums}>
              <div style={nextRow()}>
                <dt>{t("account.common.subtotal")}</dt>
                <dd>{formatPrice(Number(order?.subtotal || 0))}</dd>
              </div>
              <div style={nextRow()}>
                <dt>{t("account.common.shipping")}</dt>
                <dd>{shipping ? formatPrice(shipping) : t("account.receipt.free")}</dd>
              </div>
              {discount > 0 ? (
                <div style={nextRow()} className={styles.discount}>
                  <dt>{t("account.common.voucher")}{order?.voucher_code ? " · " + order.voucher_code : ""}</dt>
                  <dd>− {formatPrice(discount)}</dd>
                </div>
              ) : null}
              <div style={nextRow()} className={styles.total}>
                <dt>{t(held ? "account.success.totalHeld" : "account.receipt.totalPaid")}</dt>
                <dd>{formatPrice(confirmed ? shown : total)}</dd>
              </div>
            </dl>

            <div className={styles.stamp} style={nextRow()}>
              <span>{t(held ? "account.success.stampHeld" : "account.success.stamp")}</span>
              <small>
                {order?.stripe_payment_method
                  ? order.stripe_payment_method.toUpperCase()
                  : t("account.success.cardFpx")}
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
            {t("account.success.track")}
          </Link>
          <Link
            className={styles.secondary}
            href={"/orders/" + encodeURIComponent(orderNumber) + "/receipt"}
          >
            {t("account.success.download")}
          </Link>
          <Link className={styles.link} href="/products">
            {t("account.common.continueShopping")} ›
          </Link>
        </div>

        {!loading ? (
          <div className={styles.recommendations}>
            <CarRecommendations
              title="mayNeed"
              exclude={items.map((item) => item.product_id || "").filter(Boolean)}
              limit={4}
            />
          </div>
        ) : null}

        {loading ? <span className={styles.srOnly}>{t("account.detail.loading")}</span>
 : null}
      </section>
    </main>
  );
}
