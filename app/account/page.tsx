"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/sellers/Seller.module.css";

type BuyerAccount = {
  fullName: string;
  email: string;
};

export default function AccountPage() {
  const [account, setAccount] =
    useState<BuyerAccount | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadAccount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?next=/account";
        return;
      }

      setAccount({
        fullName:
          typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "MIVO Buyer",
        email: user.email || "",
      });

      setLoading(false);
    }

    void loadAccount();
  }, []);

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  if (loading) {
    return (
      <main className="container pageShell">
        <section className={styles.panel}>
          Loading buyer account...
        </section>
      </main>
    );
  }

  return (
    <main className="container pageShell">
      <section className={styles.panel}>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.eyebrow}>
              MIVO BUYER ACCOUNT
            </span>

            <h1>Hello, {account?.fullName}</h1>
            <p>{account?.email}</p>
          </div>

          <button
            className={styles.secondaryButton}
            onClick={logout}
          >
            Log out
          </button>
        </div>

        <div className={styles.dashboardGrid}>
          <div className={styles.stat}>
            <span>Orders</span>
            <strong>My Orders</strong>
          </div>

          <div className={styles.stat}>
            <span>Vehicles</span>
            <strong>My Garage</strong>
          </div>

          <div className={styles.stat}>
            <span>Account</span>
            <strong>Addresses</strong>
          </div>
        </div>

        <div className={styles.actions}>
          <Link href="/products" className="redButton">
            Start Shopping
          </Link>

          <Link
            href="/orders"
            className={styles.secondaryButton}
          >
            My Orders
          </Link>

          <Link
            href="/garage"
            className={styles.secondaryButton}
          >
            My Garage
          </Link>
        </div>

        <p
          className={styles.notice}
          style={{ marginTop: 22 }}
        >
          Want to sell products? Seller registration is
          separate and optional.
        </p>

        <div className={styles.actions}>
          <Link
            href="/sellers"
            className={styles.secondaryButton}
          >
            Open Seller Centre
          </Link>
        </div>
      </section>
    </main>
  );
}