"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "@/components/LanguageProvider";
import ChatNowButton from "@/components/chat/ChatNowButton";
import { friendlyError } from "@/lib/i18n/errors";
import { intlTag } from "@/lib/i18n/format";
import type { Key } from "@/lib/i18n";
import styles from "../Returns.module.css";

type Request = {
  id: string;
  request_number: string;
  order_id: string;
  seller_id: string | null;
  items: Array<{ order_item_id: string; quantity: number }>;
  reason: string;
  solution: string;
  description: string | null;
  evidence_paths: string[];
  seller_fault: boolean;
  items_amount: number | string;
  shipping_refund: number | string;
  fee_deduction: number | string;
  requested_amount: number | string;
  seller_amount: number | string | null;
  final_amount: number | string | null;
  status: string;
  return_courier: string | null;
  return_tracking: string | null;
  seller_note: string | null;
  mivo_note: string | null;
  respond_by: string | null;
  ship_back_by: string | null;
  inspect_by?: string | null;
  created_at: string;
};
type Event = { id: string; actor: string; action: string; note: string | null; amount: number | string | null; created_at: string };

const when = (iso: string) =>
  new Date(iso).toLocaleString(intlTag(), { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function ReturnDetailPage() {
  const t = useT();
  const id = String(useParams().id || "");
  const [req, setReq] = useState<Request | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [items, setItems] = useState<Map<string, string>>(new Map());
  const [events, setEvents] = useState<Event[]>([]);
  const [photos, setPhotos] = useState<string[]>([]);
  const [returnTo, setReturnTo] = useState<{ shop?: string; name?: string; phone?: string; address?: string } | null>(null);
  const [courier, setCourier] = useState("");
  const [tracking, setTracking] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error: loadError } = await supabase.from("return_requests").select("*").eq("id", id).maybeSingle();
      if (loadError || !data) throw loadError || new Error("not found");
      const r = data as Request;
      setReq(r);
      const [{ data: order }, { data: itemRows }, { data: eventRows }] = await Promise.all([
        supabase.from("orders").select("order_number").eq("id", r.order_id).maybeSingle(),
        supabase.from("order_items").select("id, product_name, variant_name").in("id", r.items.map((i) => i.order_item_id)),
        supabase.from("return_request_events").select("*").eq("request_id", r.id).order("created_at", { ascending: false }),
      ]);
      setOrderNumber((order as { order_number?: string } | null)?.order_number || "");
      setItems(
        new Map(
          ((itemRows || []) as Array<{ id: string; product_name: string; variant_name: string | null }>).map((i) => [
            i.id,
            i.product_name + (i.variant_name ? " · " + i.variant_name : ""),
          ])
        )
      );
      setEvents((eventRows || []) as Event[]);
      if (r.status === "approved_return" || r.status === "returning") {
        const { data: address } = await supabase.rpc("return_request_return_address", { p_request_id: r.id });
        setReturnTo((address as typeof returnTo) || null);
      }
      if (r.evidence_paths?.length) {
        const { data: signed } = await supabase.storage.from("return-evidence").createSignedUrls(r.evidence_paths, 3600);
        setPhotos((signed || []).map((s) => s.signedUrl).filter(Boolean) as string[]);
      }
    } catch (caught) {
      setError(friendlyError(caught, t, "ret.loadError"));
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: string, extra: { courier?: string; tracking?: string; note?: string } = {}) {
    setBusy(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: actError } = await supabase.rpc("return_request_customer_action", {
        p_id: id,
        p_action: action,
        p_courier: extra.courier ?? null,
        p_tracking: extra.tracking ?? null,
        p_note: extra.note ?? null,
      });
      if (actError) throw actError;
      setRejecting(false);
      await load();
    } catch (caught) {
      setError(friendlyError(caught, t, "ret.actionError"));
    } finally {
      setBusy(false);
    }
  }

  if (!req) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>{error ? <p className={styles.error}>{error}</p> : <div className={styles.card}>{t("common.loading")}</div>}</div>
      </main>
    );
  }

  const amount = Number(req.final_amount ?? req.requested_amount);
  const cancellable = ["requested", "seller_offer", "mivo_review", "approved_return"].includes(req.status);

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <Link href="/account/returns" className={styles.back}>
          ‹ {t("ret.myReturns")}
        </Link>
        <h1 className={styles.title}>{t("ret.title")}</h1>
        <p className={styles.sub}>
          {req.request_number} · {t("ret.order", { n: orderNumber })}
        </p>
        {error ? <p className={styles.error}>{error}</p> : null}

        <section className={styles.banner}>
          <strong>{t(("ret.st." + req.status) as Key)}</strong>
          {req.status === "requested" && req.respond_by ? <p>{t("ret.respondBy", { date: when(req.respond_by) })}</p> : null}
          {req.status === "approved_return" && req.ship_back_by ? <p>{t("ret.shipBy", { date: when(req.ship_back_by) })}</p> : null}
          {req.status === "returning" ? <p>{t("ret.returningNote")}</p> : null}
          {req.status === "received" && req.inspect_by ? <p>{t("ret.inspectBy", { date: when(req.inspect_by) })}</p> : null}
          {req.status === "refunded" || req.status === "refunding" ? <p>{t("ret.refundTime")}</p> : null}
        </section>

        {req.status === "seller_offer" ? (
          <section className={styles.card}>
            <h2>{t("ret.offer")}</h2>
            <p>{t("ret.offerText", { amount: formatPrice(Number(req.seller_amount)) })}</p>
            {req.seller_note ? <p className={styles.hint}>“{req.seller_note}”</p> : null}
            {rejecting ? (
              <>
                <textarea className={styles.textarea} rows={2} placeholder={t("ret.rejectWhy")} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} />
                <div className={styles.actions}>
                  <button type="button" className={styles.primary} disabled={busy || rejectNote.trim().length < 3} onClick={() => void act("reject_offer", { note: rejectNote })}>
                    {t("ret.rejectOffer")}
                  </button>
                  <button type="button" className={styles.ghost} onClick={() => setRejecting(false)}>
                    {t("me.cancel")}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={busy} onClick={() => void act("accept_offer")}>
                  {t("ret.acceptOffer")}
                </button>
                <button type="button" className={styles.secondary} disabled={busy} onClick={() => setRejecting(true)}>
                  {t("ret.rejectOffer")}
                </button>
              </div>
            )}
          </section>
        ) : null}

        {req.status === "approved_return" ? (
          <section className={styles.card}>
            <h2>{t("ret.shipBack")}</h2>
            {returnTo?.address ? (
              <div className={styles.noteGood}>
                <strong>{t("ret.sendTo")}</strong>
                <br />
                {returnTo.name || returnTo.shop}
                {returnTo.phone ? " · " + returnTo.phone : ""}
                <br />
                {returnTo.address}
              </div>
            ) : (
              <p className={styles.hint}>{t("ret.returnAddress")}</p>
            )}
            <div className={styles.formRow}>
              <input className={styles.input} placeholder={t("ret.courier")} value={courier} onChange={(e) => setCourier(e.target.value)} />
              <input className={styles.input} placeholder={t("ret.tracking")} value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} disabled={busy || !courier.trim() || !tracking.trim()} onClick={() => void act("ship_back", { courier, tracking })}>
                {t("ret.shipBack")}
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.card}>
          <h2>{t(("ret.r." + req.reason) as Key)}</h2>
          {req.items.map((item) => (
            <p key={item.order_item_id} className={styles.hint}>
              {items.get(item.order_item_id) || "—"} × {item.quantity}
            </p>
          ))}
          {req.description ? <p>{req.description}</p> : null}
          {photos.length ? (
            <div className={styles.photos}>
              {photos.map((url) => (
                <a key={url} href={url} target="_blank" rel="noreferrer" className={styles.photo}>
                  <img src={url} alt="" />
                </a>
              ))}
            </div>
          ) : null}
          {req.return_tracking ? (
            <p className={styles.hint}>
              {t("ret.courier")}: {req.return_courier} · {t("ret.tracking")}: {req.return_tracking}
            </p>
          ) : null}
        </section>

        <section className={styles.card}>
          <div className={styles.sums}>
            <div>
              <span>{t("ret.itemsAmount")}</span>
              <strong>{formatPrice(Number(req.items_amount))}</strong>
            </div>
            {Number(req.shipping_refund) > 0 ? (
              <div>
                <span>{t("ret.shippingRefund")}</span>
                <strong>+ {formatPrice(Number(req.shipping_refund))}</strong>
              </div>
            ) : null}
            {Number(req.fee_deduction) > 0 ? (
              <div>
                <span>{t("ret.feeDeduction")}</span>
                <strong>− {formatPrice(Number(req.fee_deduction))}</strong>
              </div>
            ) : null}
            <div className={styles.total}>
              <span>{req.final_amount != null ? t("ret.final") : t("ret.requested")}</span>
              <strong>{formatPrice(amount)}</strong>
            </div>
          </div>
          {req.mivo_note ? (
            <p className={styles.noteGood}>
              {t("ret.mivoNote")}: {req.mivo_note}
            </p>
          ) : null}
        </section>

        <section className={styles.card}>
          <h2>{t("ret.timeline")}</h2>
          <ul className={styles.timeline}>
            {events.map((e) => (
              <li key={e.id}>
                {t(("ret.ev." + e.action) as Key)}
                {e.amount != null ? " · " + formatPrice(Number(e.amount)) : ""}
                {e.note && e.actor !== "system" ? <em>“{e.note}”</em> : null}
                <time>{when(e.created_at)}</time>
              </li>
            ))}
          </ul>
        </section>

        <div className={styles.actions}>
          {req.seller_id ? <ChatNowButton sellerId={req.seller_id} orderNumber={orderNumber || undefined} /> : null}
          {cancellable ? (
            <button
              type="button"
              className={styles.ghost}
              disabled={busy}
              onClick={() => {
                if (window.confirm(t("ret.cancelConfirm"))) void act("cancel");
              }}
            >
              {t("ret.cancel")}
            </button>
          ) : null}
        </div>
      </div>
    </main>
  );
}
