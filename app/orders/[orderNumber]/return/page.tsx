"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "@/components/LanguageProvider";
import { friendlyError } from "@/lib/i18n/errors";
import type { Key } from "@/lib/i18n";
import styles from "@/app/account/returns/Returns.module.css";

type Item = {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number | string;
  seller_order_id: string | null;
  seller_id: string | null;
};

type Quote = {
  seller_fault: boolean;
  items_amount: number;
  shipping_refund: number;
  fee_deduction: number;
  refund_amount: number;
};

const RETURN_REASONS = [
  "wrong_item",
  "damaged",
  "defective",
  "not_as_described",
  "missing_parts",
  "does_not_fit",
  "not_received",
  "change_of_mind",
  "no_reason",
] as const;

export default function ReturnRequestPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams();
  const orderNumber = String(params.orderNumber || "");

  const [userId, setUserId] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [shops, setShops] = useState<Map<string, string>>(new Map());
  const [shopKey, setShopKey] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [solution, setSolution] = useState<"return_refund" | "refund_only">("return_refund");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<Array<{ path: string; preview: string }>>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.replace("/login?next=/orders/" + encodeURIComponent(orderNumber) + "/return");
          return;
        }
        setUserId(user.id);
        const { data: order, error: orderError } = await supabase
          .from("orders")
          .select("id, status")
          .eq("order_number", orderNumber)
          .eq("user_id", user.id)
          .maybeSingle();
        if (orderError || !order) throw orderError || new Error("not found");
        setOrderStatus(order.status);
        const { data: rows, error: itemError } = await supabase
          .from("order_items")
          .select("id, product_name, variant_name, quantity, unit_price, seller_order_id, seller_id")
          .eq("order_id", order.id)
          .order("created_at");
        if (itemError) throw itemError;
        const list = (rows || []) as Item[];
        setItems(list);
        const sellerIds = Array.from(new Set(list.map((i) => i.seller_id).filter((v): v is string => Boolean(v))));
        if (sellerIds.length) {
          const { data: shopRows } = await supabase.from("sellers").select("id, shop_name").in("id", sellerIds);
          setShops(new Map(((shopRows || []) as Array<{ id: string; shop_name: string }>).map((s) => [s.id, s.shop_name])));
        }
        const groups = Array.from(new Set(list.map((i) => i.seller_order_id || "x")));
        if (groups.length === 1) setShopKey(groups[0]);
      } catch (caught) {
        setError(friendlyError(caught, t, "ret.loadError"));
      } finally {
        setLoading(false);
      }
    })();
  }, [orderNumber, router, t]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    items.forEach((item) => {
      const key = item.seller_order_id || "x";
      map.set(key, [...(map.get(key) || []), item]);
    });
    return map;
  }, [items]);

  const chosen = useMemo(
    () =>
      (groups.get(shopKey) || [])
        .filter((item) => (qty[item.id] || 0) > 0)
        .map((item) => ({ order_item_id: item.id, quantity: qty[item.id] })),
    [groups, shopKey, qty]
  );

  const allowedReasons = RETURN_REASONS.filter((r) =>
    orderStatus === "shipped" ? r === "not_received" || r === "damaged" : r !== "not_received"
  );
  const refundOnlyAllowed = reason === "not_received" || reason === "missing_parts";

  useEffect(() => {
    if (!refundOnlyAllowed) setSolution("return_refund");
    if (reason === "not_received") setSolution("refund_only");
  }, [reason, refundOnlyAllowed]);

  // Live refund estimate from the server (same rules as the final refund).
  useEffect(() => {
    if (!reason || !chosen.length) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data, error: quoteError } = await supabase.rpc("return_request_preview", {
        p_order_number: orderNumber,
        p_items: chosen,
        p_reason: reason,
      });
      if (!quoteError) setQuote(data as Quote);
    }, 250);
    return () => clearTimeout(timer);
  }, [chosen, reason, orderNumber]);

  async function addPhotos(files: FileList | null) {
    if (!files || !userId) return;
    const supabase = createClient();
    for (const file of Array.from(files).slice(0, 6 - photos.length)) {
      if (file.size > 20 * 1024 * 1024) {
        setError(t("errors.fileTooLarge"));
        continue;
      }
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = userId + "/" + orderNumber + "-" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await supabase.storage
        .from("return-evidence")
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        setError(friendlyError(uploadError, t, "ret.submitError"));
        continue;
      }
      setPhotos((current) => [...current, { path, preview: URL.createObjectURL(file) }]);
    }
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: id, error: submitError } = await supabase.rpc("return_request_create", {
        p_order_number: orderNumber,
        p_items: chosen,
        p_reason: reason,
        p_solution: solution,
        p_description: description,
        p_evidence: photos.map((p) => p.path),
      });
      if (submitError) throw submitError;
      router.push("/account/returns/" + id);
    } catch (caught) {
      setError(friendlyError(caught, t, "ret.submitError"));
      setBusy(false);
    }
  }

  const canSubmit = chosen.length > 0 && reason && description.trim().length >= 5 && !busy;

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href={"/orders/" + encodeURIComponent(orderNumber)} className={styles.back}>
          ‹ {t("ret.order", { n: orderNumber })}
        </Link>
        <h1 className={styles.title}>{t("ret.request")}</h1>
        <p className={styles.sub}>{t("ret.window")}</p>
        <details className={styles.policy}>
          <summary>{t("ret.policyTitle")}</summary>
          <p>
            {t("ret.policyText")}{" "}
            <Link href="/returns-policy">{t("ret.policyLink")} ›</Link>
          </p>
        </details>

        {loading ? <div className={styles.card}>{t("common.loading")}</div> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {!loading && items.length ? (
          <>
            {groups.size > 1 ? (
              <section className={styles.card}>
                <h2>{t("ret.chooseShop")}</h2>
                <div className={styles.choices}>
                  {Array.from(groups.entries()).map(([key, list]) => (
                    <button
                      type="button"
                      key={key}
                      className={key === shopKey ? styles.choiceActive : styles.choice}
                      onClick={() => {
                        setShopKey(key);
                        setQty({});
                      }}
                    >
                      {(list[0].seller_id && shops.get(list[0].seller_id)) || "MIVO"}
                      <small>{list.length} ×</small>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            {shopKey ? (
              <section className={styles.card}>
                <h2>{t("ret.chooseItems")}</h2>
                {(groups.get(shopKey) || []).map((item) => (
                  <label key={item.id} className={styles.itemRow}>
                    <input
                      type="checkbox"
                      checked={(qty[item.id] || 0) > 0}
                      onChange={(e) => setQty((q) => ({ ...q, [item.id]: e.target.checked ? item.quantity : 0 }))}
                    />
                    <span className={styles.itemText}>
                      <strong>{item.product_name}</strong>
                      <small>
                        {item.variant_name ? item.variant_name + " · " : ""}
                        {formatPrice(Number(item.unit_price))}
                      </small>
                    </span>
                    {item.quantity > 1 && (qty[item.id] || 0) > 0 ? (
                      <select
                        value={qty[item.id]}
                        onChange={(e) => setQty((q) => ({ ...q, [item.id]: Number(e.target.value) }))}
                        aria-label={t("ret.qty")}
                      >
                        {Array.from({ length: item.quantity }, (_, i) => i + 1).map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={styles.qty}>× {item.quantity}</span>
                    )}
                  </label>
                ))}
              </section>
            ) : null}

            {chosen.length ? (
              <section className={styles.card}>
                <h2>{t("ret.reason")}</h2>
                <div className={styles.reasons}>
                  {allowedReasons.map((r) => (
                    <button
                      type="button"
                      key={r}
                      className={reason === r ? styles.choiceActive : styles.choice}
                      onClick={() => setReason(r)}
                    >
                      {t(("ret.r." + r) as Key)}
                    </button>
                  ))}
                </div>

                {refundOnlyAllowed ? (
                  <>
                    <h2 className={styles.h2gap}>{t("ret.solution")}</h2>
                    <div className={styles.choices}>
                      {(["return_refund", "refund_only"] as const).map((s) => (
                        <button
                          type="button"
                          key={s}
                          className={solution === s ? styles.choiceActive : styles.choice}
                          onClick={() => setSolution(s)}
                          disabled={reason === "not_received" && s === "return_refund"}
                        >
                          {t(("ret.s." + s) as Key)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}

                <h2 className={styles.h2gap}>{t("ret.describe")}</h2>
                <textarea
                  className={styles.textarea}
                  rows={3}
                  value={description}
                  maxLength={1000}
                  placeholder={t("ret.describeHint")}
                  onChange={(e) => setDescription(e.target.value)}
                />

                <h2 className={styles.h2gap}>{t("ret.photos", { n: photos.length })}</h2>
                <p className={styles.hint}>{t("ret.photosHint")}</p>
                <div className={styles.photos}>
                  {photos.map((p) => (
                    <span key={p.path} className={styles.photo}>
                      <img src={p.preview} alt="" />
                    </span>
                  ))}
                  {photos.length < 6 ? (
                    <button type="button" className={styles.addPhoto} onClick={() => fileRef.current?.click()}>
                      {t("ret.addPhoto")}
                    </button>
                  ) : null}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    hidden
                    onChange={(e) => void addPhotos(e.target.files)}
                  />
                </div>
              </section>
            ) : null}

            {quote ? (
              <section className={styles.card}>
                <h2>{t("ret.estimate")}</h2>
                <div className={styles.sums}>
                  <div>
                    <span>{t("ret.itemsAmount")}</span>
                    <strong>{formatPrice(Number(quote.items_amount))}</strong>
                  </div>
                  {Number(quote.shipping_refund) > 0 ? (
                    <div>
                      <span>{t("ret.shippingRefund")}</span>
                      <strong>+ {formatPrice(Number(quote.shipping_refund))}</strong>
                    </div>
                  ) : null}
                  {Number(quote.fee_deduction) > 0 ? (
                    <div>
                      <span>{t("ret.feeDeduction")}</span>
                      <strong>− {formatPrice(Number(quote.fee_deduction))}</strong>
                    </div>
                  ) : null}
                  <div className={styles.total}>
                    <span>{t("ret.estimate")}</span>
                    <strong>{formatPrice(Number(quote.refund_amount))}</strong>
                  </div>
                </div>
                <p className={quote.seller_fault ? styles.noteGood : styles.noteWarn}>
                  {quote.seller_fault
                    ? t("ret.faultNote")
                    : reason === "does_not_fit"
                      ? t("ret.fitNote") + " " + t("ret.mindNote")
                      : t("ret.mindNote")}
                </p>
              </section>
            ) : null}

            <button type="button" className={styles.primary} disabled={!canSubmit} onClick={() => void submit()}>
              {busy ? t("ret.submitting") : t("ret.submit")}
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}
