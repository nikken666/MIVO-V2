"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/data/products";

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
          caught instanceof Error
            ? caught.message
            : "Unable to calculate cancellation refund."
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
          throw new Error(
            (data.error || "Stripe refund could not be completed.") +
              " Your order is cancelled and the refund is marked as pending."
          );
        }

        throw new Error(
          data.error || "Unable to cancel and refund this paid order."
        );
      }

      await onCancelled();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to cancel this paid order."
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
            <span>PAID ORDER CANCELLATION</span>
            <h2 id="cancel-order-title">Review your refund first.</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {loading ? (
          <p className="accountDataNotice">
            Calculating cancellation charges...
          </p>
        ) : error && !preview ? (
          <p className="accountDataError">{error}</p>
        ) : preview ? (
          <>
            <div className="cancelRefundBreakdown">
              <div>
                <span>Order total</span>
                <strong>{formatPrice(Number(preview.order_total))}</strong>
              </div>
              <div>
                <span>Payment processing fee</span>
                <strong>
                  − {formatPrice(Number(preview.processing_fee))}
                </strong>
              </div>
              <div>
                <span>
                  Cancellation administration fee (
                  {Number(preview.admin_fee_percent)}%)
                </span>
                <strong>− {formatPrice(Number(preview.admin_fee))}</strong>
              </div>
              <div>
                <span>Service fee</span>
                <strong>
                  − {formatPrice(Number(preview.service_fee))}
                </strong>
              </div>
            </div>

            <div className="cancelRefundTotal">
              <div>
                <span>ESTIMATED REFUND</span>
                <small>
                  Refund processing begins after cancellation is confirmed.
                </small>
              </div>
              <strong>{formatPrice(Number(preview.refund_amount))}</strong>
            </div>

            <div className="cancelPolicyBox">
              <strong>Cancellation policy</strong>
              <p>
                Payment processing charges are non-refundable. MIVO charges a
                3% cancellation administration fee capped at RM20, plus a RM2
                service fee. Once an order has been shipped, cancellation is
                unavailable.
              </p>
              {preview.processing_fee_is_fallback ? (
                <small>
                  The payment processing fee shown is based on the current
                  standard card-processing fallback. When the payment gateway
                  provides the actual fee, MIVO uses the actual amount.
                </small>
              ) : null}
            </div>

            <label className="cancelReasonField">
              <span>REASON (OPTIONAL)</span>
              <textarea
                rows={3}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Tell us why you are cancelling"
              />
            </label>

            <label className="cancelAgreement">
              <input
                type="checkbox"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                I understand the deductions above and agree to receive the
                displayed refund amount.
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
                KEEP ORDER
              </button>

              <button
                type="button"
                className="orderPrimaryButton"
                disabled={!accepted || busy}
                onClick={confirmCancellation}
              >
                {busy ? "CANCELLING..." : "CONFIRM CANCELLATION"}
              </button>
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}
