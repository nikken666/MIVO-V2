"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/LanguageProvider";
import { friendlyError } from "@/lib/i18n/errors";
import styles from "@/app/account/returns/Returns.module.css";

type Shop = { id: string; shop_name: string; status: string };

export default function SellOnMivoPage() {
  const t = useT();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setSignedIn(Boolean(user));
      if (user) {
        const { data } = await supabase.rpc("seller_my_shops");
        setShops((data || []) as Shop[]);
      }
    })();
  }, []);

  async function apply() {
    setBusy(true);
    setError("");
    try {
      const { error: applyError } = await createClient().rpc("seller_apply", {
        p_shop_name: name,
        p_phone: phone,
        p_note: note,
      });
      if (applyError) throw applyError;
      setDone(true);
    } catch (caught) {
      setError(friendlyError(caught, t, "common.error"));
    } finally {
      setBusy(false);
    }
  }

  const approved = shops.some((s) => s.status === "approved");

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t("sell.title")}</h1>
        <p className={styles.sub}>{t("sell.intro")}</p>

        <section className={styles.card}>
          <ul className={styles.timeline}>
            <li>{t("sell.point1")}</li>
            <li>{t("sell.point2")}</li>
            <li>{t("sell.point3")}</li>
          </ul>
        </section>

        {approved ? (
          <a href="/seller" className={styles.primary} style={{ display: "grid", placeItems: "center" }}>
            {t("sell.goCentre")}
          </a>
        ) : null}

        {shops.length ? (
          <section className={styles.card}>
            <h2>{t("sell.myApplications")}</h2>
            {shops.map((s) => (
              <p key={s.id} className={styles.hint}>
                {s.shop_name} · {s.status === "approved" ? t("sell.approved") : s.status === "pending" ? t("sell.pending") : s.status}
              </p>
            ))}
          </section>
        ) : null}

        {signedIn === false ? (
          <Link href="/login?next=/sell" className={styles.primary} style={{ display: "grid", placeItems: "center" }}>
            {t("sell.signIn")}
          </Link>
        ) : signedIn ? (
          done ? (
            <p className={styles.noteGood}>{t("sell.sent")}</p>
          ) : (
            <section className={styles.card}>
              <h2>{t("sell.apply")}</h2>
              <div className={styles.formRow}>
                <input className={styles.input} placeholder={t("sell.shopName")} value={name} onChange={(e) => setName(e.target.value)} />
                <input className={styles.input} placeholder={t("sell.phone")} value={phone} inputMode="tel" onChange={(e) => setPhone(e.target.value)} />
              </div>
              <textarea className={styles.textarea} rows={3} placeholder={t("sell.note")} value={note} onChange={(e) => setNote(e.target.value)} style={{ marginTop: 10 }} />
              {error ? <p className={styles.error}>{error}</p> : null}
              <div className={styles.actions}>
                <button type="button" className={styles.primary} disabled={busy || name.trim().length < 2 || phone.trim().length < 6} onClick={() => void apply()}>
                  {t("sell.submit")}
                </button>
              </div>
            </section>
          )
        ) : null}
      </div>
    </main>
  );
}
