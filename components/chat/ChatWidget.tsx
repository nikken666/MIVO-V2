"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useT } from "../LanguageProvider";
import ChatThread from "./ChatThread";
import { friendlyError } from "@/lib/i18n/errors";

export const OPEN_CHAT_EVENT = "mivo:open-chat";

export type OpenChatDetail = {
  sellerId?: string;
  productId?: string;
  orderNumber?: string;
};

/** Open the chat window from anywhere, optionally with a shop, product or order. */
export function openChat(detail: OpenChatDetail = {}) {
  window.dispatchEvent(new CustomEvent<OpenChatDetail>(OPEN_CHAT_EVENT, { detail }));
}

type Conversation = {
  id: string;
  seller_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  customer_unread: number;
  shop?: { shop_name: string; logo_url: string | null; slug: string | null };
};

export default function ChatWidget() {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pending, setPending] = useState<{ productId?: string; orderNumber?: string }>({});
  const [error, setError] = useState("");

  const loadConversations = useCallback(async () => {
    const supabase = createClient();
    const { data, error: listError } = await supabase
      .from("chat_conversations")
      .select("id, seller_id, last_message_at, last_message_preview, customer_unread")
      .order("last_message_at", { ascending: false })
      .limit(50);
    if (listError) {
      // Table missing until supabase/chat.sql has run.
      if (/chat_conversations/.test(listError.message)) setError(t("chat.setupNeeded"));
      return [];
    }
    const rows = (data || []) as Conversation[];
    const sellerIds = Array.from(new Set(rows.map((row) => row.seller_id)));
    if (sellerIds.length) {
      const { data: shops } = await supabase
        .from("sellers")
        .select("id, shop_name, logo_url, slug")
        .in("id", sellerIds);
      const byId = new Map(
        ((shops || []) as Array<{ id: string; shop_name: string; logo_url: string | null; slug: string | null }>).map(
          (shop) => [shop.id, shop]
        )
      );
      rows.forEach((row) => (row.shop = byId.get(row.seller_id)));
    }
    setConversations(rows);
    return rows;
  }, [t]);

  // Who is signed in; keep the unread badge live.
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data }) => {
      const id = data.user?.id || null;
      setUserId(id);
      if (!id) return;
      void loadConversations();
      channel = supabase
        .channel("chat-list:" + id)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "chat_conversations", filter: "customer_id=eq." + id },
          () => void loadConversations()
        )
        .subscribe();
    });

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [loadConversations]);

  // "Chat now" buttons elsewhere on the site.
  useEffect(() => {
    async function handle(event: Event) {
      const detail = (event as CustomEvent<OpenChatDetail>).detail || {};
      setOpen(true);
      setError("");
      if (!detail.sellerId) return;
      const supabase = createClient();
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;
      const { data: id, error: startError } = await supabase.rpc("chat_start", {
        p_seller_id: detail.sellerId,
      });
      if (startError) {
        setError(/chat_start/.test(startError.message) ? t("chat.setupNeeded") : friendlyError(startError, t));
        return;
      }
      setPending({ productId: detail.productId, orderNumber: detail.orderNumber });
      setActiveId(String(id));
      void loadConversations();
    }
    window.addEventListener(OPEN_CHAT_EVENT, handle);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, handle);
  }, [loadConversations, t]);

  const unread = conversations.reduce((sum, c) => sum + (c.customer_unread || 0), 0);
  // No floating button while paying: it covered the order total. Chat still opens from "Chat now".
  const pathname = usePathname() || "";
  const hideLauncher = !open && (pathname === "/checkout" || pathname === "/cart" || pathname.includes("/success"));
  const active = conversations.find((c) => c.id === activeId) || null;

  return (
    <>
      <button
        type="button"
        className={"chatLauncher" + (hideLauncher ? " chatLauncherHidden" : "")}
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A2.5 2.5 0 0 1 4 13.5z" />
        </svg>
        <span>{t("chat.chat")}</span>
        {unread ? <b>{unread > 99 ? "99+" : unread}</b> : null}
      </button>

      {open ? (
        <section className={"chatPanel" + (activeId ? " hasActive" : "")} role="dialog" aria-label={t("chat.title")}>
          <header className="chatPanelHead">
            {activeId ? (
              <button type="button" className="chatBack" onClick={() => setActiveId(null)} aria-label={t("chat.back")}>
                ‹
              </button>
            ) : null}
            <strong>{active?.shop?.shop_name || t("chat.title")}</strong>
            {active?.shop?.slug ? (
              <Link href={"/shops/" + active.shop.slug} className="chatShopLink">
                {t("shop.visit")}
              </Link>
            ) : null}
            <button type="button" className="chatClose" onClick={() => setOpen(false)} aria-label={t("chat.close")}>
              ×
            </button>
          </header>

          {userId === null ? (
            <div className="chatEmpty">
              <strong>{t("chat.signIn")}</strong>
              <Link
                href={"/login?next=" + encodeURIComponent(typeof window !== "undefined" ? window.location.pathname : "/")}
                className="chatPrimary"
              >
                {t("chat.signInButton")}
              </Link>
            </div>
          ) : error ? (
            <div className="chatEmpty">
              <strong>{error}</strong>
            </div>
          ) : (
            <div className="chatBody">
              <ul className="chatList">
                {conversations.length === 0 ? (
                  <li className="chatEmpty">
                    <strong>{t("chat.empty")}</strong>
                    <span>{t("chat.emptyHint")}</span>
                  </li>
                ) : (
                  conversations.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className={c.id === activeId ? "active" : ""}
                        onClick={() => {
                          setPending({});
                          setActiveId(c.id);
                        }}
                      >
                        <span className="chatAvatar">
                          {c.shop?.logo_url ? <img src={c.shop.logo_url} alt="" /> : (c.shop?.shop_name || "M").slice(0, 1)}
                        </span>
                        <span className="chatListText">
                          <strong>{c.shop?.shop_name || "MIVO"}</strong>
                          <small>{c.last_message_preview || ""}</small>
                        </span>
                        {c.customer_unread ? <b>{c.customer_unread}</b> : null}
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <div className="chatMain">
                {activeId ? (
                  <ChatThread
                    key={activeId}
                    conversationId={activeId}
                    side="customer"
                    t={t}
                    pendingProductId={pending.productId}
                    pendingOrderNumber={pending.orderNumber}
                    quickReplies={[t("chat.quick1"), t("chat.quick2"), t("chat.quick3")]}
                    onSent={() => {
                      setPending({});
                      void loadConversations();
                    }}
                  />
                ) : (
                  <div className="chatEmpty">
                    <strong>{t("chat.pick")}</strong>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
