"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function UnpaidCancellationModal({
  orderNumber,
  onClose,
  onCancelled,
}: {
  orderNumber: string;
  onClose: () => void;
  onCancelled: () => void | Promise<void>;
}) {
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
        caught instanceof Error
          ? caught.message
          : "Unable to cancel this order."
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
            <span>ORDER CANCELLATION</span>
            <h2 id="unpaid-cancel-title">Cancel this order?</h2>
          </div>

          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="unpaidCancelOrderNumber">
          <span>ORDER NUMBER</span>
          <strong>{orderNumber}</strong>
        </div>

        <div className="unpaidCancelSummary">
          <div>
            <i>✓</i>
            <p>
              <strong>No cancellation fee</strong>
              <small>No payment has been made for this order.</small>
            </p>
          </div>

          <div>
            <i>✓</i>
            <p>
              <strong>Reserved stock will be released</strong>
              <small>
                Product stock reserved for this order becomes available again
                immediately.
              </small>
            </p>
          </div>

          <div>
            <i>!</i>
            <p>
              <strong>This action cannot be undone</strong>
              <small>
                If you change your mind later, you will need to place a new
                order.
              </small>
            </p>
          </div>
        </div>

        <div className="unpaidCancelAutoNote">
          <span>24-HOUR PAYMENT RULE</span>
          <p>
            Unpaid orders are also cancelled automatically 24 hours after the
            order is placed.
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
            KEEP ORDER
          </button>

          <button
            type="button"
            className="orderDangerButton"
            disabled={busy}
            onClick={confirmCancellation}
          >
            {busy ? "CANCELLING..." : "CANCEL ORDER"}
          </button>
        </div>
      </section>
    </div>
  );
}
