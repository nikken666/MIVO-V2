"use client";

import { useState } from "react";
import { useT } from "@/components/LanguageProvider";

export default function StripePayButton({
  orderNumber,
  className = "orderPrimaryButton",
  children,
}: {
  orderNumber: string;
  className?: string;
  children?: string;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function pay() {
    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/payments/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
      });

      const data = (await response.json()) as {
        url?: string;
        error?: string;
      };

      if (!response.ok || !data.url) {
        throw new Error(data.error || t("buy.pay.unable"));
      }

      window.location.assign(data.url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : t("buy.pay.unable")
      );
      setBusy(false);
    }
  }

  return (
    <span className="stripePayAction">
      <button
        type="button"
        className={className}
        disabled={busy}
        onClick={pay}
      >
        {busy ? t("buy.pay.opening") : children ?? t("buy.pay.payNow")}
      </button>
      {error ? <small className="stripePayError">{error}</small> : null}
    </span>
  );
}
