"use client";

import { useState } from "react";
import { useT } from "@/components/LanguageProvider";
import { friendlyError, ShownError } from "@/lib/i18n/errors";

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
  const [detail, setDetail] = useState("");

  async function pay() {
    setBusy(true);
    setError("");
    setDetail("");

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
        // Keep the reason visible (small) so a failed payment can be diagnosed.
        const friendly = friendlyError(data.error, t, "buy.pay.unable");
        if (data.error && data.error !== friendly) setDetail(data.error.slice(0, 240));
        throw new ShownError(friendlyError(data.error, t, "buy.pay.unable"));
      }

      window.location.assign(data.url);
    } catch (caught) {
      setError(
        friendlyError(caught, t, "buy.pay.unable")
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
      {detail ? <small className="stripePayDetail">{detail}</small> : null}
    </span>
  );
}
