"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/LanguageProvider";
import { errorText, friendlyError } from "@/lib/i18n/errors";
import type { Key } from "@/lib/i18n";
import styles from "@/app/account/returns/Returns.module.css";

type Shop = { id: string; shop_name: string; status: string };
type Application = {
  id: string;
  seller_id: string;
  seller_type: "individual" | "business";
  legal_name: string;
  ic_number: string | null;
  business_reg_no: string | null;
  tin: string | null;
  sst_no: string | null;
  phone: string;
  business_address: string;
  pickup_address: Record<string, string>;
  bank_name: string;
  bank_account_name: string;
  bank_account_no: string;
  documents: Record<string, string>;
  categories: string | null;
  status: "submitted" | "more_info" | "approved" | "rejected";
  admin_note: string | null;
};

const banks = [
  "Maybank", "CIMB Bank", "Public Bank", "RHB Bank", "Hong Leong Bank", "AmBank", "Bank Islam",
  "Bank Rakyat", "BSN", "Alliance Bank", "Affin Bank", "OCBC Bank", "UOB Bank", "HSBC Bank",
  "Standard Chartered", "Agrobank", "Bank Muamalat", "MBSB Bank", "GXBank", "Other",
];
const states = [
  "Johor", "Kedah", "Kelantan", "Melaka", "Negeri Sembilan", "Pahang", "Perak", "Perlis", "Pulau Pinang",
  "Sabah", "Sarawak", "Selangor", "Terengganu", "W.P. Kuala Lumpur", "W.P. Labuan", "W.P. Putrajaya",
];

const emptyForm = {
  application_id: "",
  shop_name: "",
  categories: "",
  seller_type: "individual" as "individual" | "business",
  legal_name: "",
  ic_number: "",
  business_reg_no: "",
  tin: "",
  sst_no: "",
  phone: "",
  business_address: "",
  pickup_name: "",
  pickup_phone: "",
  pickup_line: "",
  pickup_postcode: "",
  pickup_city: "",
  pickup_state: "",
  bank_name: "",
  bank_account_name: "",
  bank_account_no: "",
};

export default function SellOnMivoPage() {
  const t = useT();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [shops, setShops] = useState<Shop[]>([]);
  const [apps, setApps] = useState<Application[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [agree, setAgree] = useState(false);
  const [editing, setEditing] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [docSlot, setDocSlot] = useState("");

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUserId(user?.id || null);
      if (!user) return;
      const [{ data: shopRows }, { data: appRows }] = await Promise.all([
        supabase.rpc("seller_my_shops"),
        supabase.from("seller_applications").select("*").order("created_at", { ascending: false }),
      ]);
      setShops((shopRows || []) as Shop[]);
      const list = (appRows || []) as Application[];
      setApps(list);
      // An application waiting on the seller opens pre-filled.
      const open = list.find((a) => a.status === "more_info" || a.status === "rejected");
      if (list.length && !open) setEditing(false);
    })();
  }, []);

  function loadForEdit(a: Application, shopName: string) {
    const p = a.pickup_address || {};
    setForm({
      application_id: a.id,
      shop_name: shopName,
      categories: a.categories || "",
      seller_type: a.seller_type,
      legal_name: a.legal_name,
      ic_number: a.ic_number || "",
      business_reg_no: a.business_reg_no || "",
      tin: a.tin || "",
      sst_no: a.sst_no || "",
      phone: a.phone,
      business_address: a.business_address,
      pickup_name: p.name || "",
      pickup_phone: p.phone || "",
      pickup_line: p.line || "",
      pickup_postcode: p.postcode || "",
      pickup_city: p.city || "",
      pickup_state: p.state || "",
      bank_name: a.bank_name,
      bank_account_name: a.bank_account_name,
      bank_account_no: a.bank_account_no,
    });
    setDocs(a.documents || {});
    setEditing(true);
    setDone(false);
  }

  async function upload(file: File) {
    if (!userId || !docSlot) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(t("errors.fileTooLarge"));
      return;
    }
    setUploading(docSlot);
    setError("");
    setDetail("");
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().slice(0, 5);
    try {
      // The server hands out a one-time upload link for the applicant's own folder.
      const response = await fetch("/api/seller/document-upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slot: docSlot, ext }),
      });
      const signed = (await response.json()) as { path?: string; token?: string; error?: string };
      if (!response.ok || !signed.path || !signed.token) throw new Error(signed.error || "Upload failed.");
      const { error: uploadError } = await createClient()
        .storage.from("seller-documents")
        .uploadToSignedUrl(signed.path, signed.token, file, { contentType: file.type });
      if (uploadError) throw uploadError;
      setDocs((d) => ({ ...d, [docSlot]: signed.path! }));
    } catch (caught) {
      setError(friendlyError(caught, t, "common.error"));
      setDetail(errorText(caught));
    }
    setUploading("");
  }

  const needDocs = form.seller_type === "individual" ? ["ic_front", "ic_back", "bank_statement"] : ["ssm", "bank_statement"];
  const complete =
    form.shop_name.trim() &&
    form.legal_name.trim() &&
    (form.seller_type === "individual" ? form.ic_number.trim() : form.business_reg_no.trim()) &&
    form.phone.trim().length >= 8 &&
    form.business_address.trim() &&
    form.pickup_line.trim() &&
    form.pickup_postcode.trim() &&
    form.pickup_city.trim() &&
    form.pickup_state &&
    form.bank_name &&
    form.bank_account_name.trim() &&
    form.bank_account_no.trim().length >= 6 &&
    needDocs.every((d) => docs[d]) &&
    agree;

  async function submit() {
    if (!complete) {
      setError(t("so.missing"));
      return;
    }
    setBusy(true);
    setError("");
    setDetail("");
    try {
      const documents: Record<string, string> = {};
      needDocs.forEach((d) => (documents[d] = docs[d]));
      const { error: submitError } = await createClient().rpc("seller_submit_application", {
        p: {
          application_id: form.application_id || null,
          shop_name: form.shop_name,
          categories: form.categories,
          seller_type: form.seller_type,
          legal_name: form.legal_name,
          ic_number: form.seller_type === "individual" ? form.ic_number : null,
          business_reg_no: form.seller_type === "business" ? form.business_reg_no : null,
          tin: form.tin,
          sst_no: form.sst_no,
          phone: form.phone,
          business_address: form.business_address,
          pickup_address: {
            name: form.pickup_name || form.legal_name,
            phone: form.pickup_phone || form.phone,
            line: form.pickup_line,
            postcode: form.pickup_postcode,
            city: form.pickup_city,
            state: form.pickup_state,
          },
          bank_name: form.bank_name,
          bank_account_name: form.bank_account_name,
          bank_account_no: form.bank_account_no,
          documents,
        },
      });
      if (submitError) throw submitError;
      setDone(true);
      setEditing(false);
    } catch (caught) {
      setError(friendlyError(caught, t, "common.error"));
      setDetail(errorText(caught));
    } finally {
      setBusy(false);
    }
  }

  const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const docButton = (slot: string, label: Key) => (
    <div className={styles.docRow}>
      <span>{t(label)}</span>
      <button
        type="button"
        className={docs[slot] ? styles.secondary : styles.ghost}
        disabled={uploading === slot}
        onClick={() => {
          setDocSlot(slot);
          setTimeout(() => fileRef.current?.click(), 0);
        }}
      >
        {uploading === slot ? t("common.loading") : docs[slot] ? t("so.uploaded") : t("so.upload")}
      </button>
    </div>
  );

  const approved = shops.some((s) => s.status === "approved");

  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <h1 className={styles.title}>{t("sell.title")}</h1>
        <p className={styles.sub}>{t("sell.intro")}</p>

        {approved ? (
          <a href="/seller" className={styles.primary} style={{ display: "grid", placeItems: "center" }}>
            {t("sell.goCentre")}
          </a>
        ) : null}

        {apps.map((a) => {
          const shop = shops.find((s) => s.id === a.seller_id);
          return (
            <section key={a.id} className={styles.card}>
              <h2>{shop?.shop_name || form.shop_name}</h2>
              <span className={styles.status}>{t(("so.status." + a.status) as Key)}</span>
              {a.admin_note ? (
                <p className={styles.noteWarn}>
                  <strong>{t("so.note")}:</strong> {a.admin_note}
                </p>
              ) : null}
              {(a.status === "more_info" || a.status === "rejected") && !editing ? (
                <div className={styles.actions}>
                  <button type="button" className={styles.secondary} onClick={() => loadForEdit(a, shop?.shop_name || "")}>
                    {t("so.fix")}
                  </button>
                </div>
              ) : null}
            </section>
          );
        })}

        {done ? <p className={styles.noteGood}>{t("sell.sent")}</p> : null}

        {userId === null ? (
          <Link href="/login?next=/sell" className={styles.primary} style={{ display: "grid", placeItems: "center" }}>
            {t("sell.signIn")}
          </Link>
        ) : null}

        {userId && editing && !done ? (
          <>
            <section className={styles.card}>
              <ul className={styles.timeline}>
                <li>{t("sell.point1")}</li>
                <li>{t("sell.point2")}</li>
                <li>{t("sell.point3")}</li>
              </ul>
            </section>

            <section className={styles.card}>
              <h2>1 · {t("so.step1")}</h2>
              <div className={styles.formGrid}>
                <input className={styles.input} placeholder={t("sell.shopName")} value={form.shop_name} onChange={set("shop_name")} />
                <input className={styles.input} placeholder={t("so.categories")} value={form.categories} onChange={set("categories")} />
              </div>
            </section>

            <section className={styles.card}>
              <h2>2 · {t("so.step2")}</h2>
              <div className={styles.choices}>
                {(["individual", "business"] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    className={form.seller_type === type ? styles.choiceActive : styles.choice}
                    onClick={() => setForm((f) => ({ ...f, seller_type: type }))}
                  >
                    {t(type === "individual" ? "so.individual" : "so.business")}
                  </button>
                ))}
              </div>
              <div className={styles.formGrid} style={{ marginTop: 12 }}>
                <input className={styles.input} placeholder={t(form.seller_type === "individual" ? "so.legalNameInd" : "so.legalNameBiz")} value={form.legal_name} onChange={set("legal_name")} />
                {form.seller_type === "individual" ? (
                  <input className={styles.input} placeholder={t("so.ic") + " (900101-14-5678)"} value={form.ic_number} onChange={set("ic_number")} />
                ) : (
                  <input className={styles.input} placeholder={t("so.ssm")} value={form.business_reg_no} onChange={set("business_reg_no")} />
                )}
                <input className={styles.input} placeholder={t("so.tin")} value={form.tin} onChange={set("tin")} />
                {form.seller_type === "business" ? (
                  <input className={styles.input} placeholder={t("so.sst")} value={form.sst_no} onChange={set("sst_no")} />
                ) : null}
              </div>
            </section>

            <section className={styles.card}>
              <h2>3 · {t("so.step3")}</h2>
              <div className={styles.formGrid}>
                <input className={styles.input} placeholder={t("sell.phone")} inputMode="tel" value={form.phone} onChange={set("phone")} />
              </div>
              <textarea className={styles.textarea} rows={2} placeholder={t("so.address")} value={form.business_address} onChange={set("business_address")} style={{ marginTop: 10 }} />
              <h2 className={styles.h2gap}>{t("so.pickup")}</h2>
              <div className={styles.formGrid}>
                <input className={styles.input} placeholder={t("so.pickupName")} value={form.pickup_name} onChange={set("pickup_name")} />
                <input className={styles.input} placeholder={t("sell.phone")} inputMode="tel" value={form.pickup_phone} onChange={set("pickup_phone")} />
                <input className={styles.input + " " + styles.wide} placeholder={t("so.street")} value={form.pickup_line} onChange={set("pickup_line")} />
                <input className={styles.input} placeholder={t("so.postcode")} inputMode="numeric" value={form.pickup_postcode} onChange={set("pickup_postcode")} />
                <input className={styles.input} placeholder={t("so.city")} value={form.pickup_city} onChange={set("pickup_city")} />
                <select className={styles.input} value={form.pickup_state} onChange={set("pickup_state")}>
                  <option value="">{t("so.state")}</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </section>

            <section className={styles.card}>
              <h2>4 · {t("so.step4")}</h2>
              <div className={styles.formGrid}>
                <select className={styles.input} value={form.bank_name} onChange={set("bank_name")}>
                  <option value="">{t("so.bank")}</option>
                  {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
                <input className={styles.input} placeholder={t("so.accountName")} value={form.bank_account_name} onChange={set("bank_account_name")} />
                <input className={styles.input} placeholder={t("so.accountNo")} inputMode="numeric" value={form.bank_account_no} onChange={set("bank_account_no")} />
              </div>
              <p className={styles.hint} style={{ marginTop: 8 }}>{t("so.bankHint")}</p>
            </section>

            <section className={styles.card}>
              <h2>5 · {t("so.step5")}</h2>
              {form.seller_type === "individual" ? (
                <>
                  {docButton("ic_front", "so.icFront")}
                  {docButton("ic_back", "so.icBack")}
                </>
              ) : (
                docButton("ssm", "so.ssmDoc")
              )}
              {docButton("bank_statement", "so.bankDoc")}
              <p className={styles.hint} style={{ marginTop: 8 }}>🔒 {t("so.privacy")}</p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,application/pdf"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = "";
                }}
              />
            </section>

            <label className={styles.agree}>
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {t("so.agree")}
            </label>

            {error ? <p className={styles.error}>{error}</p> : null}
            {detail ? <p className={styles.hint}>{detail}</p> : null}

            <button type="button" className={styles.primary} disabled={busy} onClick={() => void submit()}>
              {busy ? t("common.loading") : form.application_id ? t("so.resubmit") : t("so.submit")}
            </button>
          </>
        ) : null}
      </div>
    </main>
  );
}
