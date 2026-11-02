"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";
import { useT } from "@/components/LanguageProvider";
import { friendlyError, ShownError } from "@/lib/i18n/errors";

type CancellationPreview = {
  order_number: string;
  order_total: number | string;
  processing_fee: number | string;
  admin_fee: number | string;
  service_fee: number | string;
  total_fees: number | string;
  refund_amount: number | string;
  processing_fee_is_fallback: boolean;
  admin_fee_percent: number | string;
  admin_fee_cap: number | string;
  service_fee_flat: number | string;
};

export default function PaidCancellationModal({
  orderNumber,
  onClose,
  onCancelled,
}: {
  orderNumber: string;
  onClose: () => void;
  onCancelled: () => void | Promise<void>;
}) {
  const t = useT();
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [reason, setReason] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadPreview() {
      try {
        const supabase = createClient();
        const { data, error: previewError } = await supabase.rpc(
          "preview_paid_order_cancellation",
          { p_order_number: orderNumber }
        );

        if (previewError) throw previewError;
        if (!active) return;
        setPreview(data as CancellationPreview);
      } catch (caught) {
        if (!active) return;
        setError(
          friendlyError(caught, t, "account.paidCancel.previewError")
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [orderNumber]);

  async function confirmCancellation() {
    if (!preview || !accepted) return;

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/payments/stripe/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderNumber,
          reason: reason.trim() || null,
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        refundPending?: boolean;
      };

      if (!response.ok) {
        if (data.refundPending) {
          throw new ShownError(
            friendlyError(data.error, t, "account.paidCancel.refundFailed") +
              " " +
              t("account.paidCancel.refundPending")
          );
        }

        throw new ShownError(
          friendlyError(data.error, t, "account.paidCancel.refundError")
        );
      }

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
        className="cancelModal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-order-title"
      >
        <div className="cancelModalHead">
          <div>
            <span>{t("account.paidCancel.eyebrow")}</span>
            <h2 id="cancel-order-title">{t("account.paidCancel.title")}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={t("chat.close")}>
            ×
          </button>
        </div>

        {loading ? (
          <p className="accountDataNotice">
            {t("account.paidCancel.calculating")}
          </p>
        ) : error && !preview ? (
          <p className="accountDataError">{error}</p>
        ) : preview ? (
          <>
            <div className="cancelRefundBreakdown">
              <div>
                <span>{t("account.paidCancel.orderTotal")}</span>
                <strong>{formatPrice(Number(preview.order_total))}</strong>
              </div>
              <div>
                <span>{t("account.common.processingFee")}</span>
                <strong>
                  − {formatPrice(Number(preview.processing_fee))}
                </strong>
              </div>
              <div>
                <span>
                  {t("account.common.adminFee")} (
                  {Number(preview.admin_fee_percent)}%)
                </span>
                <strong>− {formatPrice(Number(preview.admin_fee))}</strong>
              </div>
              <div>
                <span>{t("account.common.serviceFee")}</span>
                <strong>
                  − {formatPrice(Number(preview.service_fee))}
                </strong>
              </div>
            </div>

            <div className="cancelRefundTotal">
              <div>
                <span>{t("account.paidCancel.estimated")}</span>
                <small>
                  {t("account.paidCancel.estimatedText")}
                </small>
              </div>
              <strong>{formatPrice(Number(preview.refund_amount))}</strong>
            </div>

            <div className="cancelPolicyBox">
              <strong>{t("account.paidCancel.policy")}</strong>
              <p>
                {t("account.paidCancel.policyText")}
              </p>
              {preview.processing_fee_is_fallback ? (
                <small>
                  {t("account.paidCancel.fallbackText")}
                </small>
              ) : null}
            </div>

            <label className="cancelReasonField">
              <span>{t("account.paidCancel.reason")}</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={t("account.paidCancel.reasonPlaceholder")}
              />
            </label>

            <label className="cancelAgreement">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                {t("account.paidCancel.agree")}
              </span>
            </label>

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
                className="orderPrimaryButton"
                disabled={!accepted || busy}
                onClick={confirmCancellation}
              >
                {busy ? t("account.cancel.cancelling") : t("account.paidCancel.confirm")}

              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
