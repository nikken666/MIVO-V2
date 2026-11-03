"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import type { Translate } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_role: "customer" | "seller";
  body: string | null;
  product_id: string | null;
  order_number: string | null;
  image_path?: string | null;
  created_at: string;
};

// Signed links for chat photos (private bucket), cached for this visit.
const photoCache = new Map<string, string>();

async function loadPhotos(paths: string[]) {
  const missing = Array.from(new Set(paths.filter((p) => p && !photoCache.has(p))));
  if (!missing.length) return;
  const { data } = await createClient().storage.from("chat-images").createSignedUrls(missing, 60 * 60 * 6);
  for (const row of data || []) if (row.path && row.signedUrl) photoCache.set(row.path, row.signedUrl);
}

const SELLER_REPLIES_KEY = "mivo:sellerQuickReplies";
const defaultSellerReplies = [
  "Hi! Thanks for your message. How can we help?",
  "Yes, this part fits your car.",
  "It's in stock and ships within 1-2 working days.",
  "Your parcel has shipped. The tracking number is on your order page.",
  "Could you send a photo of the old part or your car's grant/VIN?",
];

function readSellerReplies(): string[] {
  try {
    const saved = JSON.parse(window.localStorage.getItem(SELLER_REPLIES_KEY) || "null");
    return Array.isArray(saved) && saved.length ? saved.map(String) : defaultSellerReplies;
  } catch {
    return defaultSellerReplies;
  }
}

type ProductPreview = {
  id: string;
  name: string;
  slug: string;
  primary_image_url: string | null;
  price: number | null;
};

const productCache = new Map<string, ProductPreview>();

async function loadProducts(ids: string[]) {
  const missing = ids.filter((id) => !productCache.has(id));
  if (!missing.length) return;
  const supabase = createClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, slug, primary_image_url, product_variants(price)")
    .in("id", missing);
  for (const row of (data || []) as Array<{
    id: string;
    name: string;
    slug: string;
    primary_image_url: string | null;
    product_variants: Array<{ price: number | string }> | null;
  }>) {
    const prices = (row.product_variants || []).map((v) => Number(v.price)).filter(Number.isFinite);
    productCache.set(row.id, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      primary_image_url: row.primary_image_url,
      price: prices.length ? Math.min(...prices) : null,
    });
  }
}

function timeLabel(iso: string) {
  const date = new Date(iso);
  const today = new Date();
  const time = date.toLocaleTimeString(intlTag(), { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === today.toDateString()
    ? time
    : date.toLocaleDateString(intlTag(), { day: "2-digit", month: "short" }) + " " + time;
}

/**
 * Messages of one conversation with a composer. `side` is who is typing:
 * the customer (storefront) or the shop (admin inbox).
 */
export default function ChatThread({
  conversationId,
  side,
  t,
  pendingProductId,
  pendingOrderNumber,
  onSent,
  quickReplies = [],
}: {
  conversationId: string;
  side: "customer" | "seller";
  t: Translate;
  pendingProductId?: string | null;
  pendingOrderNumber?: string | null;
  onSent?: () => void;
  quickReplies?: string[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [attachProduct, setAttachProduct] = useState<string | null>(pendingProductId || null);
  const [attachOrder, setAttachOrder] = useState<string | null>(pendingOrderNumber || null);
  const [, setProductsVersion] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [, setPhotosVersion] = useState(0);
  const [sellerReplies, setSellerReplies] = useState<string[]>([]);
  const [showReplies, setShowReplies] = useState(false);
  const [editingReplies, setEditingReplies] = useState(false);
  const [newReply, setNewReply] = useState("");
  const inSellerCentre = typeof window !== "undefined" && window.location.pathname.startsWith("/seller");

  useEffect(() => {
    if (side === "seller") setSellerReplies(readSellerReplies());
  }, [side]);

  function saveSellerReplies(next: string[]) {
    setSellerReplies(next);
    try {
      window.localStorage.setItem(SELLER_REPLIES_KEY, JSON.stringify(next));
    } catch {}
  }

  useEffect(() => {
    setAttachProduct(pendingProductId || null);
    setAttachOrder(pendingOrderNumber || null);
  }, [conversationId, pendingProductId, pendingOrderNumber]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const query = (columns: string) =>
        supabase
          .from("chat_messages")
          .select(columns)
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(300);
      let { data, error: loadError } = await query(
        "id, conversation_id, sender_role, body, product_id, order_number, image_path, created_at"
      );
      // Photos need supabase/chat-images.sql; without it, load the rest.
      if (loadError) ({ data } = await query("id, conversation_id, sender_role, body, product_id, order_number, created_at"));
      if (!active) return;
      const rows = (data || []) as unknown as ChatMessage[];
      await loadPhotos(rows.map((m) => m.image_path || "").filter(Boolean));
      if (!active) return;
      setMessages(rows);
      await loadProducts(
        [...rows.map((m) => m.product_id), pendingProductId].filter((id): id is string => Boolean(id))
      );
      if (active) setProductsVersion((n) => n + 1);
      void supabase.rpc("chat_mark_read", { p_conversation_id: conversationId });
    }
    void load();

    const channel = supabase
      .channel("chat:" + conversationId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: "conversation_id=eq." + conversationId,
        },
        async (payload) => {
          const message = payload.new as ChatMessage;
          if (message.product_id) await loadProducts([message.product_id]);
          if (message.image_path) await loadPhotos([message.image_path]);
          setMessages((current) =>
            current.some((m) => m.id === message.id) ? current : [...current, message]
          );
          void supabase.rpc("chat_mark_read", { p_conversation_id: conversationId });
        }
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [conversationId, pendingProductId]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  async function sendPhoto(file: File) {
    if (!file.type.startsWith("image/")) return;
    if (file.size > 5 * 1024 * 1024) {
      setError(t("errors.fileTooLarge"));
      return;
    }
    setUploading(true);
    setError("");
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
      const path = conversationId + "/" + crypto.randomUUID() + "." + ext;
      const { error: uploadError } = await supabase.storage
        .from("chat-images")
        .upload(path, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      photoCache.set(path, URL.createObjectURL(file));
      const { data: id, error: sendError } = await supabase.rpc("chat_send", {
        p_conversation_id: conversationId,
        p_body: null,
        p_product_id: null,
        p_order_number: null,
        p_image_path: path,
      });
      if (sendError) throw sendError;
      setMessages((current) =>
        current.some((m) => m.id === id)
          ? current
          : [
              ...current,
              {
                id: String(id),
                conversation_id: conversationId,
                sender_role: side,
                body: null,
                product_id: null,
                order_number: null,
                image_path: path,
                created_at: new Date().toISOString(),
              },
            ]
      );
      setPhotosVersion((n) => n + 1);
      onSent?.();
    } catch (caught) {
      setError(friendlyError(caught, t, "common.error"));
    } finally {
      setUploading(false);
    }
  }

  async function send(text?: string) {
    const body = (text ?? draft).trim();
    if (!body && !attachProduct && !attachOrder) return;
    setSending(true);
    setError("");
    try {
      const supabase = createClient();
      const { data: id, error: sendError } = await supabase.rpc("chat_send", {
        p_conversation_id: conversationId,
        p_body: body || null,
        p_product_id: attachProduct,
        p_order_number: attachOrder,
      });
      if (sendError) throw sendError;
      // Show it immediately; the realtime echo is de-duplicated by id.
      setMessages((current) =>
        current.some((m) => m.id === id)
          ? current
          : [
              ...current,
              {
                id: String(id),
                conversation_id: conversationId,
                sender_role: side,
                body: body || null,
                product_id: attachProduct,
                order_number: attachOrder,
                created_at: new Date().toISOString(),
              },
            ]
      );
      setDraft("");
      setAttachProduct(null);
      setAttachOrder(null);
      onSent?.();
    } catch (caught) {
      setError(friendlyError(caught, t, "common.error"));
    } finally {
      setSending(false);
    }
  }

  const pendingProduct = attachProduct ? productCache.get(attachProduct) : null;

  return (
    <div className="chatThread">
      <div className="chatMessages" ref={listRef}>
        {messages.map((message) => {
          const mine = message.sender_role === side;
          const product = message.product_id ? productCache.get(message.product_id) : null;
          return (
            <div key={message.id} className={"chatBubbleRow" + (mine ? " mine" : "")}>
              <div className="chatBubble">
                {product ? (
                  <Link href={"/products/" + product.slug} className="chatProductCard">
                    {product.primary_image_url ? <img src={product.primary_image_url} alt="" /> : <span />}
                    <span>
                      <strong>{product.name}</strong>
                      {product.price != null ? <small>{formatPrice(product.price)}</small> : null}
                    </span>
                  </Link>
                ) : null}
                {message.order_number ? (
                  <Link
                    href={(side === "seller" ? (inSellerCentre ? "/seller/orders?order=" : "/admin/orders?order=") : "/orders/") + encodeURIComponent(message.order_number)}
                    className="chatOrderCard"
                  >
                    {t("chat.order", { n: message.order_number })} ›
                  </Link>
                ) : null}
                {message.image_path && photoCache.get(message.image_path) ? (
                  <a href={photoCache.get(message.image_path)} target="_blank" rel="noreferrer" className="chatPhoto">
                    <img src={photoCache.get(message.image_path)} alt="" />
                  </a>
                ) : null}
                {message.body ? <p>{message.body}</p> : null}
                <time>{timeLabel(message.created_at)}</time>
              </div>
            </div>
          );
        })}
      </div>

      {quickReplies.length && !messages.length ? (
        <div className="chatQuick">
          {quickReplies.map((reply) => (
            <button type="button" key={reply} onClick={() => void send(reply)} disabled={sending}>
              {reply}
            </button>
          ))}
        </div>
      ) : null}

      {pendingProduct || attachOrder ? (
        <div className="chatAttach">
          {pendingProduct ? (
            <>
              {pendingProduct.primary_image_url ? <img src={pendingProduct.primary_image_url} alt="" /> : null}
              <span>
                <small>{t("chat.askAbout")}</small>
                <strong>{pendingProduct.name}</strong>
              </span>
            </>
          ) : (
            <span>
              <small>{t("chat.askOrder")}</small>
              <strong>{attachOrder}</strong>
            </span>
          )}
          <button
            type="button"
            aria-label={t("chat.close")}
            onClick={() => {
              setAttachProduct(null);
              setAttachOrder(null);
            }}
          >
            ×
          </button>
        </div>
      ) : null}

      {error ? <p className="chatError">{error}</p> : null}

      {side === "seller" && showReplies ? (
        <div className="chatReplyBank">
          <div className="chatReplyBankHead">
            <strong>{t("chat.quickReplies")}</strong>
            <button type="button" onClick={() => setEditingReplies((v) => !v)}>
              {editingReplies ? t("chat.done") : t("chat.edit")}
            </button>
          </div>
          <ul>
            {sellerReplies.map((reply, index) => (
              <li key={reply + index}>
                <button
                  type="button"
                  disabled={sending || editingReplies}
                  onClick={() => {
                    setShowReplies(false);
                    void send(reply);
                  }}
                >
                  {reply}
                </button>
                {editingReplies ? (
                  <button
                    type="button"
                    className="chatReplyRemove"
                    aria-label={t("chat.close")}
                    onClick={() => saveSellerReplies(sellerReplies.filter((_, i) => i !== index))}
                  >
                    ×
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {editingReplies ? (
            <form
              className="chatReplyAdd"
              onSubmit={(event) => {
                event.preventDefault();
                const text = newReply.trim();
                if (!text) return;
                saveSellerReplies([...sellerReplies, text.slice(0, 500)]);
                setNewReply("");
              }}
            >
              <input value={newReply} onChange={(e) => setNewReply(e.target.value)} placeholder={t("chat.addReply")} />
              <button type="submit">+</button>
            </form>
          ) : null}
        </div>
      ) : null}

      <form
        className="chatComposer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void sendPhoto(file);
            event.target.value = "";
          }}
        />
        <button
          type="button"
          className="chatTool"
          onClick={() => photoInput.current?.click()}
          disabled={uploading}
          aria-label={t("chat.sendPhoto")}
          title={t("chat.sendPhoto")}
        >
          {uploading ? "…" : (
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h2l1.2-1.6A1 1 0 0 1 10.5 3h3a1 1 0 0 1 .8.4L15.5 5h2A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><circle cx="12" cy="12" r="3.2" /></svg>
          )}
        </button>
        {side === "seller" ? (
          <button
            type="button"
            className={"chatTool" + (showReplies ? " active" : "")}
            onClick={() => setShowReplies((v) => !v)}
            aria-label={t("chat.quickReplies")}
            title={t("chat.quickReplies")}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3 5 14h6l-1 7 8-11h-6z" /></svg>
          </button>
        ) : null}
        <textarea
          value={draft}
          rows={1}
          maxLength={2000}
          placeholder={t("chat.placeholder")}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" disabled={sending || (!draft.trim() && !attachProduct && !attachOrder)}>
          {t("chat.send")}
        </button>
      </form>
    </div>
  );
}
