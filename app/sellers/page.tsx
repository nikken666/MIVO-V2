"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./Seller.module.css";

type Seller = {
  id: string;
  shop_name: string;
  slug: string;
  status: "pending" | "approved" | "rejected" | "suspended";
  commission_rate: number;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function SellersPage() {
  const [loading, setLoading] = useState(true);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?next=/sellers";
        return;
      }

      setUserEmail(user.email || "");

      const { data, error: sellerError } = await supabase
        .from("sellers")
        .select("id, shop_name, slug, status, commission_rate")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (sellerError) setError(sellerError.message);
      setSeller((data as Seller | null) || null);
      setLoading(false);
    }

    void load();
  }, []);

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const supabase = createClient();

    setBusy(true);
    setError("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) throw new Error("Please log in again.");

      const baseSlug = slugify(shopName) || "mivo-seller";
      const uniqueSlug = `${baseSlug}-${crypto.randomUUID().slice(0, 6)}`;

      const { data, error: insertError } = await supabase
        .from("sellers")
        .insert({
          owner_id: user.id,
          shop_name: shopName.trim(),
          slug: uniqueSlug,
          company_name: companyName.trim() || null,
          email: user.email,
          phone: phone.trim() || null,
          status: "pending",
        })
        .select("id, shop_name, slug, status, commission_rate")
        .single();

      if (insertError) throw insertError;
      setSeller(data as Seller);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Application failed.");
    } finally {
      setBusy(false);
    }
  }

 async function logout() {
  const supabase = createClient();
  await supabase.auth.signOut();
  window.location.href = "/";
}

  if (loading) {
    return (
      <main className="container pageShell">
        <section className={styles.panel}>Loading seller account...</section>
      </main>
    );
  }

  if (!seller) {
    return (
      <main className={`container pageShell ${styles.narrowPage}`}>
        <section className={styles.panel}>
          <div className={styles.titleRow}>
            <div>
              <span className={styles.eyebrow}>SELLER CENTRE</span>
              <h1>Open a MIVO shop</h1>
              <p>
                Apply once. After MIVO approves the shop, you can upload products,
                prices, dimensions, stock and product images.
              </p>
            </div>
          </div>

          <form className={styles.form} onSubmit={apply}>
            <label>
              <span>Shop name</span>
              <input
                required
                value={shopName}
                onChange={(event) => setShopName(event.target.value)}
                placeholder="Example: Direct Parts MY"
              />
            </label>

            <label>
              <span>Company name</span>
              <input
                value={companyName}
                onChange={(event) => setCompanyName(event.target.value)}
                placeholder="Optional"
              />
            </label>

            <label>
              <span>Email</span>
              <input value={userEmail} disabled />
            </label>

            <label>
              <span>Phone</span>
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="01X-XXXXXXX"
              />
            </label>

            {error && <p className={styles.error}>{error}</p>}

            <button className="redButton" disabled={busy} type="submit">
              {busy ? "Submitting..." : "Submit seller application"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (seller.status !== "approved") {
    return (
      <main className={`container pageShell ${styles.narrowPage}`}>
        <section className={styles.panel}>
          <span className={styles.eyebrow}>SELLER CENTRE</span>
          <h1>{seller.shop_name}</h1>
          <p className={styles.notice}>
            Application status: <strong>{seller.status}</strong>. Product upload is
            enabled after MIVO approval.
          </p>
          <div className={styles.actions}>
            <Link href="/" className={styles.secondaryButton}>
              Back to MIVO
            </Link>
            <button className={styles.secondaryButton} onClick={logout}>
              Log out
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="container pageShell">
      <section className={styles.panel}>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.eyebrow}>SELLER CENTRE</span>
            <h1>{seller.shop_name}</h1>
            <p>
              Approved shop · Platform commission {seller.commission_rate}%
            </p>
          </div>

          <button className={styles.secondaryButton} onClick={logout}>
            Log out
          </button>
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.stat}>
            <span>Shop status</span>
            <strong>Approved</strong>
          </div>
          <div className={styles.stat}>
            <span>Commission</span>
            <strong>{seller.commission_rate}%</strong>
          </div>
          <div className={styles.stat}>
            <span>Inventory</span>
            <strong>Live</strong>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/sellers/products/new" className="redButton">
            + Upload product
          </Link>
          <Link href="/sellers/products" className={styles.secondaryButton}>
            Manage products
          </Link>
        </div>
      </section>
    </main>
  );
}
