"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/components/LanguageProvider";
import { friendlyError } from "@/lib/i18n/errors";

export default function UnpaidCancellationModal({
  orderNumber,
  onClose,
  onCancelled,
}: {
  orderNumber: string;
  onClose: () => void;
  onCancelled: () => void | Promise<void>;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function confirmCancellation() {
    setBusy(true);
    setError("");

    try {
      const supabase = createClient();
      const { error: cancelError } = await supabase.rpc(
        "customer_cancel_unpaid_order",
        { p_order_number: orderNumber }
      );

      if (cancelError) throw cancelError;

      await onCancelled();
      onClose();
    } catch (caught) {
      setError(
        friendlyError(caught, t, "account.cancel.error")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cancelModalBackdrop" role="presentation">
      <section
        className="cancelModal unpaidCancelModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unpaid-cancel-title"
      >
        <div className="cancelModalHead">
          <div>
            <span>{t("account.cancel.eyebrow")}</span>
            <h2 id="unpaid-cancel-title">{t("account.cancel.title")}</h2>
          </div>

          <button type="button" onClick={onClose} aria-label={t("chat.close")}>
            ×
          </button>
        </div>

        <div className="unpaidCancelOrderNumber">
          <span>{t("account.cancel.orderNumber")}</span>
          <strong>{orderNumber}</strong>
        </div>

        <div className="unpaidCancelSummary">
          <div>
            <i>✓</i>
            <p>
              <strong>{t("account.cancel.noFee")}</strong>
              <small>{t("account.cancel.noFeeText")}</small>
            </p>
          </div>

          <div>
            <i>✓</i>
            <p>
              <strong>{t("account.cancel.stockReleased")}</strong>
              <small>
                {t("account.cancel.stockReleasedText")}
              </small>
            </p>
          </div>

          <div>
            <i>!</i>
            <p>
              <strong>{t("account.cancel.cannotUndo")}</strong>
              <small>
                {t("account.cancel.cannotUndoText")}
              </small>
            </p>
          </div>
        </div>

        <div className="unpaidCancelAutoNote">
          <span>{t("account.cancel.rule")}</span>
          <p>
            {t("account.cancel.ruleText")}
          </p>
        </div>

        {error ? <p className="accountDataError">{error}</p> : null}

        <div className="cancelModalActions">
          <button
            type="button"
            className="orderGhostButton"
            onClick={onClose}
            disabled={busy}
          >
            {t("account.cancel.keep")}
          </button>

          <button
            type="button"
            className="orderDangerButton"
            disabled={busy}
            onClick={confirmCancellation}
          >
            {busy ? t("account.cancel.cancelling") : t("account.orders.cancelOrder")}

          </button>
        </div>
      </section>
    </div>
  );
}
