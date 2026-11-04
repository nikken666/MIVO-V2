"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { openChat } from "@/components/chat/ChatWidget";
import { localeNames, locales, type Locale } from "@/lib/i18n";
import styles from "./Me.module.css";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";
import MarketingOptIn from "@/components/MarketingOptIn";

type Profile = {
  fullName: string;
  username: string;
  phone: string;
  avatarUrl: string;
  email: string;
  createdAt: string;
};

type Counts = { toPay: number; toShip: number; toReceive: number; toRate: number };

const icons = {
  toPay: "M3 7h18v10H3zM3 10h18M7 14h3",
  toShip: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  toReceive: "M3 7h11v8H3zM14 10h4l3 3v2h-7M6.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zM17.5 18a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z",
  toRate: "M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z",
  garage: "M5 16h14M6.5 16l1.6-5.2A2 2 0 0 1 10 9.4h4a2 2 0 0 1 1.9 1.4L17.5 16M4 16v2.5M20 16v2.5",
  voucher: "M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4zM10 7v10",
  address: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z",
  claim: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6zM9 12l2 2 4-4",
  chat: "M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5z",
  returns: "M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3",
  help: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6V14M12 17h.01",
  language: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
};

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export default function MePage() {
  const { t, locale, setLocale } = useLanguage();
  const [userId, setUserId] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [counts, setCounts] = useState<Counts>({ toPay: 0, toShip: 0, toReceive: 0, toRate: 0 });
  const [cars, setCars] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login?next=/account";
        return;
      }
      setUserId(user.id);

      // avatar_url / username exist once supabase/chat.sql has run.
      let row: Record<string, unknown> | null = null;
      const full = await supabase
        .from("profiles")
        .select("full_name, phone, avatar_url, username")
        .eq("id", user.id)
        .maybeSingle();
      if (full.error) {
        const basic = await supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle();
        row = (basic.data as Record<string, unknown> | null) || null;
      } else {
        row = (full.data as Record<string, unknown> | null) || null;
      }
      const metaName = typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "";
      setProfile({
        fullName: String(row?.full_name || metaName || user.email?.split("@")[0] || ""),
        username: String(row?.username || ""),
        phone: String(row?.phone || ""),
        avatarUrl: String(row?.avatar_url || ""),
        email: user.email || "",
        createdAt: user.created_at,
      });

      const [{ data: orders }, { count: carCount }] = await Promise.all([
        supabase.from("orders").select("id, status, payment_status").eq("user_id", user.id),
        supabase.from("customer_vehicles").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);
      const next: Counts = { toPay: 0, toShip: 0, toReceive: 0, toRate: 0 };
      const delivered: string[] = [];
      for (const o of (orders || []) as Array<{ id: string; status: string; payment_status: string }>) {
        if (o.status === "pending_payment") next.toPay += 1;
        else if (["paid", "processing", "packed"].includes(o.status)) next.toShip += 1;
        else if (o.status === "shipped") next.toReceive += 1;
        else if (o.status === "delivered" || o.status === "completed") delivered.push(o.id);
      }
      // "To rate": delivered orders that still have a part without a review.
      if (delivered.length) {
        const [{ data: items }, { data: reviews }] = await Promise.all([
          supabase.from("order_items").select("id, order_id").in("order_id", delivered.slice(0, 200)),
          supabase.from("product_reviews").select("order_item_id").in("order_id", delivered.slice(0, 200)),
        ]);
        const reviewed = new Set(((reviews || []) as Array<{ order_item_id: string | null }>).map((r) => r.order_item_id));
        const waiting = new Set(
          ((items || []) as Array<{ id: string; order_id: string }>).filter((i) => !reviewed.has(i.id)).map((i) => i.order_id)
        );
        next.toRate = waiting.size;
      }
      setCounts(next);
      setCars(carCount || 0);
    })();
  }, []);

  async function uploadAvatar(file: File) {
    if (!userId || !draft) return;
    setError("");
    try {
      const supabase = createClient();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
      const path = userId + "/avatar-" + Date.now() + "." + ext;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      setDraft({ ...draft, avatarUrl: url });
    } catch (caught) {
      setError(friendlyError(caught, t, "common.error"));
    }
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError("");
    try {
      const supabase = createClient();
      const { error: saveError } = await supabase.rpc("profile_update", {
        p_full_name: draft.fullName,
        p_username: draft.username,
        p_avatar_url: draft.avatarUrl,
        p_phone: draft.phone,
        p_language: null,
      });
      if (saveError) throw saveError;
      setProfile(draft);
      setEditing(false);
      setNotice(t("me.saved"));
      setTimeout(() => setNotice(""), 2500);
    } catch (caught) {
      setError(friendlyError(caught, t, "common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await createClient().auth.signOut();
    window.location.href = "/";
  }

  if (!profile) {
    return (
      <main className={styles.page}>
        <div className={styles.wrap}>
          <div className={styles.skeleton} />
        </div>
      </main>
    );
  }

  const initial = (profile.fullName || profile.email || "M").slice(0, 1).toUpperCase();
  const memberSince = new Date(profile.createdAt).toLocaleDateString(intlTag(), { month: "short", year: "numeric" });
  const shown = editing && draft ? draft : profile;

  const purchases: Array<{ key: keyof Counts; label: string; href: string; icon: string }> = [
    { key: "toPay", label: t("me.toPay"), href: "/orders?tab=to_pay", icon: icons.toPay },
    { key: "toShip", label: t("me.toShip"), href: "/orders?tab=to_ship", icon: icons.toShip },
    { key: "toReceive", label: t("me.toReceive"), href: "/orders?tab=to_receive", icon: icons.toReceive },
    { key: "toRate", label: t("me.toRate"), href: "/orders?tab=completed", icon: icons.toRate },
  ];

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <section className={styles.hero}>
          <button
            type="button"
            className={styles.avatar}
            onClick={() => (editing ? fileRef.current?.click() : undefined)}
            aria-label={editing ? t("me.changePhoto") : undefined}
          >
            {shown.avatarUrl ? <img src={shown.avatarUrl} alt="" /> : <span>{initial}</span>}
            {editing ? <i>{t("me.changePhoto")}</i> : null}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadAvatar(file);
            }}
          />
          <div className={styles.identity}>
            <h1>{profile.fullName || profile.email}</h1>
            <p>
              {profile.username ? "@" + profile.username + " · " : ""}
              {t("me.memberSince", { date: memberSince })}
            </p>
          </div>
          {!editing ? (
            <button
              type="button"
              className={styles.editButton}
              onClick={() => {
                setDraft(profile);
                setEditing(true);
              }}
            >
              {t("me.editProfile")}
            </button>
          ) : null}
        </section>

        {notice ? <p className={styles.notice}>{notice}</p> : null}
        {error ? <p className={styles.error}>{error}</p> : null}

        {editing && draft ? (
          <section className={styles.card}>
            <h2>{t("me.settings")}</h2>
            <div className={styles.form}>
              <label>
                <span>{t("me.fullName")}</span>
                <input value={draft.fullName} onChange={(e) => setDraft({ ...draft, fullName: e.target.value })} />
              </label>
              <label>
                <span>{t("me.username")}</span>
                <input
                  value={draft.username}
                  placeholder="e.g. ali.myvi"
                  onChange={(e) => setDraft({ ...draft, username: e.target.value.toLowerCase() })}
                />
              </label>
              <label>
                <span>{t("me.phone")}</span>
                <input value={draft.phone} inputMode="tel" onChange={(e) => setDraft({ ...draft, phone: e.target.value })} />
              </label>
              <label>
                <span>{t("me.email")}</span>
                <input value={draft.email} disabled />
              </label>
            </div>
            <div className={styles.formActions}>
              <button type="button" className={styles.secondary} onClick={() => setEditing(false)}>
                {t("me.cancel")}
              </button>
              <button type="button" className={styles.primary} disabled={saving} onClick={() => void save()}>
                {saving ? t("common.loading") : t("me.save")}
              </button>
            </div>
          </section>
        ) : null}

        <section className={styles.card}>
          <div className={styles.cardHead}>
            <h2>{t("me.myPurchases")}</h2>
            <Link href="/orders">{t("me.viewHistory")}</Link>
          </div>
          <div className={styles.purchases}>
            {purchases.map((item) => (
              <Link key={item.key} href={item.href} className={styles.purchase}>
                <span className={styles.purchaseIcon}>
                  <Icon d={item.icon} />
                  {counts[item.key] ? <b>{counts[item.key]}</b> : null}
                </span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className={styles.card}>
          <div className={styles.shortcuts}>
            <Link href="/garage" className={styles.shortcut}>
              <Icon d={icons.garage} />
              <span>
                <strong>{t("me.myGarage")}</strong>
                <small>{t("me.myCars", { n: cars })}</small>
              </span>
            </Link>
            <button type="button" className={styles.shortcut} onClick={() => openChat()}>
              <Icon d={icons.chat} />
              <span>
                <strong>{t("me.chats")}</strong>
              </span>
            </button>
            <Link href="/account/vouchers" className={styles.shortcut}>
              <Icon d={icons.voucher} />
              <span>
                <strong>{t("me.vouchers")}</strong>
              </span>
            </Link>
            <Link href="/account/addresses" className={styles.shortcut}>
              <Icon d={icons.address} />
              <span>
                <strong>{t("me.addresses")}</strong>
              </span>
            </Link>
            <Link href="/account/returns" className={styles.shortcut}>
              <Icon d={icons.returns} />
              <span>
                <strong>{t("ret.myReturns")}</strong>
              </span>
            </Link>
            <Link href="/account/claims" className={styles.shortcut}>
              <Icon d={icons.claim} />
              <span>
                <strong>{t("me.claims")}</strong>
              </span>
            </Link>
            <Link href="/shipping-policy" className={styles.shortcut}>
              <Icon d={icons.help} />
              <span>
                <strong>{t("me.help")}</strong>
              </span>
            </Link>
          </div>
        </section>

        <section className={styles.card}>
          <label className={styles.settingRow}>
            <Icon d={icons.language} />
            <strong>{t("me.language")}</strong>
            <select value={locale} onChange={(e) => setLocale(e.target.value as Locale)}>
              {locales.map((code) => (
                <option key={code} value={code}>
                  {localeNames[code]}
                </option>
              ))}
            </select>
          </label>
          <MarketingOptIn className={styles.settingRow} />
        </section>

        <button type="button" className={styles.logout} onClick={() => void logout()}>
          {t("me.logout")}
        </button>
      </div>
    </main>
  );
}
