"use client";

import { useState } from "react";

export default function StripePayButton({
  orderNumber,
  className = "orderPrimaryButton",
  children = "PAY NOW",
}: {
  orderNumber: string;
  className?: string;
  children?: string;
}) {
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
        throw new Error(data.error || "Unable to start payment.");
      }

      window.location.assign(data.url);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to start payment."
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
        {busy ? "OPENING PAYMENT..." : children}
      </button>
      {error ? <small className="stripePayError">{error}</small> : null}
    </span>
  );
}
