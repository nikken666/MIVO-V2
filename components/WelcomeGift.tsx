"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "@/components/LanguageProvider";
import type { Translate } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import { friendlyError } from "@/lib/i18n/errors";
import { PAID_ORDER_STATUSES, claimClosed } from "@/lib/vouchers";

/**
 * New-customer gift pack: pops up for visitors and new customers, opens to
 * show the gift vouchers, then sends guests to sign up and claims everything
 * as soon as they are signed in. Vouchers marked "welcome_pack" in Admin ->
 * Marketing -> Vouchers are in the pack (before that column exists: the
 * "new customers only" vouchers).
 */

type PackVoucher = {
  id: string;
  code: string;
  name: string;
  discount_type: "fixed" | "percent" | "free_shipping";
  discount_value: number | string;
  minimum_spend: number | string;
  max_discount: number | string | null;
  per_user_limit?: number | string | null;
  first_order_only?: boolean | null;
  new_user_only?: boolean | null;
  welcome_pack?: boolean | null;
  seller_id?: string | null;
  ends_at: string;
  claim_ends_at?: string | null;
};

type Stage = "hidden" | "closed" | "opening" | "open" | "claimed";

/** Set when a guest leaves the popup to sign up; the pack is claimed once they're signed in. */
export const GIFT_PENDING_KEY = "mivo:gift-pending";
const DISMISS_KEY = "mivo:gift-dismissed";
const SEEN_KEY = "mivo:gift-seen";
const DAY = 24 * 3600 * 1000;
const HIDDEN_ON = ["/login", "/auth", "/checkout", "/account", "/orders", "/sell", "/track-order"];

function storage(kind: "local" | "session") {
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}
function read(kind: "local" | "session", key: string) {
  try {
    return storage(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}
function write(kind: "local" | "session", key: string, value: string | null) {
  try {
    if (value === null) storage(kind)?.removeItem(key);
    else storage(kind)?.setItem(key, value);
  } catch {}
}
function pendingClaim() {
  const at = Number(read("local", GIFT_PENDING_KEY) || 0);
  return at > 0 && Date.now() - at < 7 * DAY;
}

function valueText(voucher: PackVoucher, t: Translate) {
  if (voucher.discount_type === "free_shipping") return t("gift.freeShipping");
  if (voucher.discount_type === "percent") return t("gift.percentOff", { n: Number(voucher.discount_value) });
  return t("gift.rmOff", { n: Number(voucher.discount_value).toFixed(0) });
}

function termsText(voucher: PackVoucher, t: Translate) {
  const parts = [
    Number(voucher.minimum_spend) > 0
      ? t("gift.minSpend", { amount: formatPrice(Number(voucher.minimum_spend)) })
      : t("gift.noMin"),
  ];
  if (voucher.max_discount) parts.push(t("gift.cap", { amount: formatPrice(Number(voucher.max_discount)) }));
  if (voucher.first_order_only) parts.push(t("gift.firstOrder"));
  return parts.join(" · ");
}

function GiftBoxArt({ opening }: { opening: boolean }) {
  return (
    <svg className={"giftArt" + (opening ? " isOpening" : "")} viewBox="0 0 160 150" aria-hidden="true">
      <ellipse cx="80" cy="142" rx="54" ry="6" fill="rgba(0,0,0,.12)" />
      <rect x="22" y="62" width="116" height="76" rx="12" fill="#ffbf1f" />
      <rect x="22" y="62" width="116" height="14" fill="rgba(0,0,0,.08)" />
      <rect x="71" y="62" width="18" height="76" fill="#0a4fd6" />
      <g className="giftArtLid">
        <rect x="14" y="44" width="132" height="26" rx="9" fill="#ffd24d" />
        <rect x="71" y="44" width="18" height="26" fill="#2563eb" />
        <path d="M80 44c-10-20-34-26-38-12-3 10 18 13 38 12z" fill="#2563eb" />
        <path d="M80 44c10-20 34-26 38-12 3 10-18 13-38 12z" fill="#1d4ed8" />
        <circle cx="80" cy="43" r="6" fill="#0a4fd6" />
      </g>
      <g className="giftArtSparkles" fill="#ffc400">
        <path d="M24 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
        <path d="M136 14l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" />
        <path d="M146 58l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
      </g>
    </svg>
  );
}

export default function WelcomeGift() {
  const t = useT();
  const router = useRouter();
  const pathname = usePathname() || "/";
  const [stage, setStage] = useState<Stage>("hidden");
  const [vouchers, setVouchers] = useState<PackVoucher[]>([]);
  const [claimedIds, setClaimedIds] = useState<string[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const checking = useRef(false);
  const stageRef = useRef<Stage>("hidden");
  stageRef.current = stage;

  const hiddenHere = HIDDEN_ON.some((path) => pathname === path || pathname.startsWith(path + "/"));

  const claimAll = useCallback(
    async (pack: PackVoucher[], already: string[]) => {
      const supabase = createClient();
      const got = [...already];
      const failures: string[] = [];
      for (const voucher of pack) {
        if (got.includes(voucher.id)) continue;
        const { error } = await supabase.rpc("claim_voucher", { p_voucher_id: voucher.id });
        if (error) failures.push(friendlyError(error, t, "browse.promo.claimError"));
        else got.push(voucher.id);
      }
      write("local", GIFT_PENDING_KEY, null);
      setClaimedIds(got);
      setNote(failures.length ? t("gift.someFailed", { reason: failures[0] }) : "");
    },
    [t]
  );

  const check = useCallback(async () => {
    if (checking.current || stageRef.current !== "hidden") return;
    // Already shown this visit and nothing to claim: no need to ask the database again.
    if (read("session", SEEN_KEY) && !pendingClaim()) return;
    checking.current = true;
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      const [{ data }, { data: auth }] = await Promise.all([
        supabase.from("vouchers").select("*").eq("is_active", true).lte("starts_at", now).gte("ends_at", now),
        supabase.auth.getUser(),
      ]);
      const rows = (data as PackVoucher[] | null) || [];
      const hasPackFlag = rows.some((voucher) => voucher.welcome_pack !== undefined);
      const pack = rows
        .filter(
          (voucher) =>
            !voucher.seller_id && !claimClosed(voucher) && (hasPackFlag ? voucher.welcome_pack : voucher.new_user_only)
        )
        .sort(
          (a, b) =>
            Number(Boolean(b.new_user_only)) - Number(Boolean(a.new_user_only)) ||
            new Date(b.ends_at).getTime() - new Date(a.ends_at).getTime()
        );
      if (!pack.length) return;
      setVouchers(pack);

      const user = auth.user;
      setSignedIn(Boolean(user));
      if (user) {
        const [{ count: paidOrders }, { data: claimed }] = await Promise.all([
          supabase
            .from("orders")
            .select("id", { count: "exact", head: true })
            .eq("user_id", user.id)
            .in("status", PAID_ORDER_STATUSES),
          supabase.from("customer_vouchers").select("voucher_id").eq("user_id", user.id),
        ]);
        // The gift is for new customers only.
        if (Number(paidOrders || 0) > 0) {
          write("local", GIFT_PENDING_KEY, null);
          return;
        }
        const already = ((claimed as Array<{ voucher_id: string }> | null) || []).map((row) => row.voucher_id);
        setClaimedIds(already);
        if (pendingClaim()) {
          // Back from signing up: claim the pack and show it.
          write("session", SEEN_KEY, "1");
          await claimAll(pack, already);
          setStage("claimed");
          return;
        }
        if (pack.every((voucher) => already.includes(voucher.id))) return;
      }

      // Pop up once per visit, and not again for a day after it was closed.
      const dismissedAt = Number(read("local", DISMISS_KEY) || 0);
      if (read("session", SEEN_KEY) || Date.now() - dismissedAt < DAY) return;
      if (new URLSearchParams(window.location.search).get("addVehicle") === "1") return;
      write("session", SEEN_KEY, "1");
      setStage("closed");
    } catch {
      // A gift problem must never get in the way of shopping.
    } finally {
      checking.current = false;
    }
  }, [claimAll]);

  useEffect(() => {
    if (hiddenHere) return;
    const timer = window.setTimeout(() => void check(), 1200);
    return () => window.clearTimeout(timer);
  }, [pathname, hiddenHere, check]);

  // Signed in on this page (e.g. password login): claim if they came from the popup.
  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" && pendingClaim()) window.setTimeout(() => void check(), 300);
    });
    return () => data.subscription.unsubscribe();
  }, [check]);

  const dismiss = useCallback(() => {
    write("local", DISMISS_KEY, String(Date.now()));
    setStage("hidden");
  }, []);

  useEffect(() => {
    if (stage === "hidden") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, dismiss]);

  function openGift() {
    setStage("opening");
    window.setTimeout(() => setStage("open"), 480);
  }

  function goSignIn(mode: "register" | "login") {
    write("local", GIFT_PENDING_KEY, String(Date.now()));
    const back = pathname + (typeof window !== "undefined" ? window.location.search : "");
    setStage("hidden");
    router.push("/login?" + (mode === "register" ? "mode=register&" : "") + "next=" + encodeURIComponent(back));
  }

  async function claimNow() {
    setBusy(true);
    try {
      await claimAll(vouchers, claimedIds);
      setStage("claimed");
    } finally {
      setBusy(false);
    }
  }

  if (stage === "hidden" || hiddenHere) return null;

  const useBy = (voucher: PackVoucher) =>
    t("gift.useBy", {
      date: new Date(voucher.ends_at).toLocaleDateString(intlTag(), { day: "numeric", month: "short", year: "numeric" }),
    });

  return (
    <div
      className="giftBackdrop"
      role="dialog"
      aria-modal="true"
      aria-label={t("gift.badge")}
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
    >
      <section className={"giftCard giftStage-" + stage}>
        <button type="button" className="giftClose" aria-label={t("gift.close")} onClick={dismiss}>
          ×
        </button>

        {stage === "closed" || stage === "opening" ? (
          <div className="giftIntro">
            <span className="giftBadge">{t("gift.badge")}</span>
            <button type="button" className="giftBox" onClick={openGift} aria-label={t("gift.open")}>
              <GiftBoxArt opening={stage === "opening"} />
            </button>
            <h2>{t("gift.title")}</h2>
            <p>{t("gift.subtitle", { n: vouchers.length })}</p>
            <button type="button" className="giftPrimary" onClick={openGift} disabled={stage === "opening"}>
              {t("gift.open")}
            </button>
            <button type="button" className="giftLater" onClick={dismiss}>
              {t("gift.later")}
            </button>
          </div>
        ) : (
          <div className="giftReveal">
            <span className="giftBadge">{t("gift.badge")}</span>
            <h2>{stage === "claimed" ? t("gift.claimedTitle") : t("gift.revealTitle")}</h2>
            <ul className="giftVouchers">
              {vouchers.map((voucher, index) => {
                const claimed = claimedIds.includes(voucher.id);
                const times = Math.floor(Number(voucher.per_user_limit) || 1);
                return (
                  <li key={voucher.id} className={claimed ? "isClaimed" : ""} style={{ animationDelay: index * 110 + "ms" }}>
                    <div className="giftValue">
                      <strong>{valueText(voucher, t)}</strong>
                      {times > 1 ? <em>{t("gift.times", { n: times })}</em> : null}
                    </div>
                    <div className="giftTerms">
                      <span>{termsText(voucher, t)}</span>
                      <small>{useBy(voucher)}</small>
                      {claimed ? <b className="giftTick">✓ {t("gift.claimed")}</b> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="giftAny">{stage === "claimed" ? t("gift.claimedText") : t("gift.anyProduct")}</p>
            {note ? <p className="giftNote">{note}</p> : null}

            <div className="giftActions">
              {stage === "claimed" ? (
                <>
                  <Link href="/products" className="giftPrimary" onClick={() => setStage("hidden")}>
                    {t("gift.shopNow")}
                  </Link>
                  <Link href="/account/vouchers" className="giftLater" onClick={() => setStage("hidden")}>
                    {t("gift.myVouchers")}
                  </Link>
                </>
              ) : signedIn ? (
                <button type="button" className="giftPrimary" onClick={() => void claimNow()} disabled={busy}>
                  {busy ? t("gift.claiming") : t("gift.claimAll")}
                </button>
              ) : (
                <>
                  <button type="button" className="giftPrimary" onClick={() => goSignIn("register")}>
                    {t("gift.signUpClaim")}
                  </button>
                  <button type="button" className="giftLater" onClick={() => goSignIn("login")}>
                    {t("gift.haveAccount")}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
