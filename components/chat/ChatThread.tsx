"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import type { Translate } from "@/lib/i18n";

export type ChatMessage = {
  id: string;
  conversation_id: string;
  sender_role: "customer" | "seller";
  body: string | null;
  product_id: string | null;
  order_number: string | null;
  created_at: string;
};

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
  const time = date.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" });
  return date.toDateString() === today.toDateString()
    ? time
    : date.toLocaleDateString("en-MY", { day: "2-digit", month: "short" }) + " " + time;
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

  useEffect(() => {
    setAttachProduct(pendingProductId || null);
    setAttachOrder(pendingOrderNumber || null);
  }, [conversationId, pendingProductId, pendingOrderNumber]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const { data } = await supabase
        .from("chat_messages")
        .select("id, conversation_id, sender_role, body, product_id, order_number, created_at")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true })
        .limit(300);
      if (!active) return;
      const rows = (data || []) as ChatMessage[];
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
      setError((caught as { message?: string })?.message || t("common.error"));
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
                    href={(side === "seller" ? "/admin/orders?order=" : "/orders/") + encodeURIComponent(message.order_number)}
                    className="chatOrderCard"
                  >
                    {t("chat.order", { n: message.order_number })} ›
                  </Link>
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

      <form
        className="chatComposer"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
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
