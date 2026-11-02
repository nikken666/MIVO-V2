"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { getStaffAccess } from "@/lib/staff";
import ChatThread from "@/components/chat/ChatThread";
import { translator } from "@/lib/i18n";
import styles from "../Admin.module.css";

type Conversation = {
  id: string;
  customer_id: string;
  seller_id: string;
  last_message_at: string;
  last_message_preview: string | null;
  seller_unread: number;
};

type Person = { id: string; full_name: string | null; email: string | null; avatar_url?: string | null };
type Shop = { id: string; shop_name: string; logo_url: string | null };

const t = translator("en");

function when(iso: string) {
  const date = new Date(iso);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("en-MY", { day: "2-digit", month: "short" });
}

export default function AdminChatPage() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [people, setPeople] = useState<Map<string, Person>>(new Map());
  const [shops, setShops] = useState<Map<string, Shop>>(new Map());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [shopFilter, setShopFilter] = useState("");
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error: listError } = await supabase
      .from("chat_conversations")
      .select("id, customer_id, seller_id, last_message_at, last_message_preview, seller_unread")
      .order("last_message_at", { ascending: false })
      .limit(300);
    if (listError) {
      setError(
        /chat_conversations/.test(listError.message)
          ? "Run supabase/chat.sql in Supabase to turn on chat."
          : listError.message
      );
      return;
    }
    const rows = (data || []) as Conversation[];
    setConversations(rows);

    const customerIds = Array.from(new Set(rows.map((r) => r.customer_id)));
    const sellerIds = Array.from(new Set(rows.map((r) => r.seller_id)));
    const [profileRes, shopRes] = await Promise.all([
      customerIds.length
        ? supabase.from("profiles").select("id, full_name, email, avatar_url").in("id", customerIds)
        : Promise.resolve({ data: [], error: null }),
      sellerIds.length
        ? supabase.from("sellers").select("id, shop_name, logo_url").in("id", sellerIds)
        : Promise.resolve({ data: [], error: null }),
    ]);
    // avatar_url exists once chat.sql has run; fall back without it.
    let profiles = (profileRes.data || []) as Person[];
    if (profileRes.error && customerIds.length) {
      const { data: fallback } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", customerIds);
      profiles = (fallback || []) as Person[];
    }
    setPeople(new Map(profiles.map((p) => [p.id, p])));
    setShops(new Map(((shopRes.data || []) as Shop[]).map((s) => [s.id, s])));
  }, []);

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
        return;
      }
      const access = await getStaffAccess(supabase);
      if (!access.allowed) {
        window.location.href = "/sell";
        return;
      }
      setReady(true);
      await load();
      const requested = new URLSearchParams(window.location.search).get("c");
      if (requested) setActiveId(requested);
    })();
  }, [load]);

  // Live: new messages bump the list.
  useEffect(() => {
    if (!ready) return;
    const supabase = createClient();
    const channel = supabase
      .channel("admin-chat-list")
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_conversations" }, () => void load())
      .subscribe();
    return () => void supabase.removeChannel(channel);
  }, [ready, load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return conversations.filter((c) => {
      if (shopFilter && c.seller_id !== shopFilter) return false;
      if (unreadOnly && !c.seller_unread) return false;
      if (!q) return true;
      const person = people.get(c.customer_id);
      return [person?.full_name, person?.email, c.last_message_preview]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [conversations, people, shopFilter, unreadOnly, query]);

  const active = conversations.find((c) => c.id === activeId) || null;
  const activePerson = active ? people.get(active.customer_id) : null;
  const activeShop = active ? shops.get(active.seller_id) : null;
  const totalUnread = conversations.reduce((sum, c) => sum + (c.seller_unread || 0), 0);

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <AdminSidebar />
        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>Customer service</span>
              <h1>Chat</h1>
              <p>
                Reply to customers as the shop they messaged.
                {totalUnread ? " " + totalUnread + " unread." : ""}
              </p>
            </div>
          </header>

          {error ? <p className={styles.adminError}>{error}</p> : null}

          <section className={styles.chatInbox + (activeId ? " " + styles.chatInboxActive : "")}>
            <div className={styles.chatInboxList}>
              <div className={styles.chatInboxFilters}>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search customer or message"
                />
                <div>
                  <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)}>
                    <option value="">All shops</option>
                    {Array.from(shops.values()).map((shop) => (
                      <option key={shop.id} value={shop.id}>
                        {shop.shop_name}
                      </option>
                    ))}
                  </select>
                  <label>
                    <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} />
                    Unread
                  </label>
                </div>
              </div>
              <ul>
                {!ready ? (
                  <li className={styles.chatInboxEmpty}>Loading…</li>
                ) : visible.length === 0 ? (
                  <li className={styles.chatInboxEmpty}>No chats yet. They appear here when a customer taps “Chat now”.</li>
                ) : (
                  visible.map((c) => {
                    const person = people.get(c.customer_id);
                    const shop = shops.get(c.seller_id);
                    const name = person?.full_name || person?.email?.split("@")[0] || "Customer";
                    return (
                      <li key={c.id}>
                        <button
                          type="button"
                          className={c.id === activeId ? styles.active : ""}
                          onClick={() => setActiveId(c.id)}
                        >
                          <span className={styles.chatInboxAvatar}>
                            {person?.avatar_url ? <img src={person.avatar_url} alt="" /> : name.slice(0, 1).toUpperCase()}
                          </span>
                          <span className={styles.chatInboxText}>
                            <strong>
                              {name} <time>{when(c.last_message_at)}</time>
                            </strong>
                            <small>{c.last_message_preview || ""}</small>
                            <em>to {shop?.shop_name || "shop"}</em>
                          </span>
                          {c.seller_unread ? <b>{c.seller_unread}</b> : null}
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>

            <div className={styles.chatInboxThread}>
              {active ? (
                <>
                  <header className={styles.chatInboxHead}>
                    <button type="button" className={styles.chatInboxBack} onClick={() => setActiveId(null)}>
                      ‹
                    </button>
                    <span className={styles.chatInboxAvatar}>
                      {activePerson?.avatar_url ? (
                        <img src={activePerson.avatar_url} alt="" />
                      ) : (
                        (activePerson?.full_name || "C").slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span>
                      <strong>{activePerson?.full_name || activePerson?.email || "Customer"}</strong>
                      <small>
                        {activePerson?.email ? activePerson.email + " · " : ""}replying as {activeShop?.shop_name || "shop"}
                      </small>
                    </span>
                  </header>
                  <ChatThread key={active.id} conversationId={active.id} side="seller" t={t} onSent={() => void load()} />
                </>
              ) : (
                <div className={styles.chatInboxEmpty}>Pick a chat on the left.</div>
              )}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
