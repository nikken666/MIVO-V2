"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "@/app/sellers/Seller.module.css";

type CustomerAccount = {
  fullName: string;
  email: string;
};

export default function AccountPage() {
  const [account, setAccount] = useState<CustomerAccount | null>(null);
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

      let profileName = "";

      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .maybeSingle();

        if (typeof profile?.full_name === "string") {
          profileName = profile.full_name.trim();
        }
      } catch {}

      const metadataName =
        typeof user.user_metadata?.full_name === "string"
          ? user.user_metadata.full_name.trim()
          : "";

      setAccount({
        fullName:
          profileName ||
          metadataName ||
          user.email?.split("@")[0] ||
          "Customer",
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
        <section className={styles.panel}>Loading your account...</section>
      </main>
    );
  }

  return (
    <main className="container pageShell">
      <section className={styles.panel}>
        <div className={styles.titleRow}>
          <div>
            <span className={styles.eyebrow}>MIVO ACCOUNT</span>
            <h1>Hello, {account?.fullName}</h1>
            <p>{account?.email}</p>
          </div>

          <button className={styles.secondaryButton} onClick={logout}>
            Log out
          </button>
        </div>

        <div className={styles.dashboardGrid}>
          <Link href="/orders" className={styles.stat}>
            <span>Orders</span>
            <strong>My Orders</strong>
          </Link>

          <Link href="/garage" className={styles.stat}>
            <span>Vehicles</span>
            <strong>My Garage</strong>
          </Link>

          <Link href="/account/addresses" className={styles.stat}>
            <span>Account</span>
            <strong>Addresses</strong>
          </Link>
        </div>

        <div className={styles.actions}>
          <Link href="/products" className="redButton">
            Start Shopping →
          </Link>
        </div>
      </section>
    </main>
  );
}
