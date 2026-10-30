import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Returns & Refunds Policy | MIVO",
  description:
    "How returns, exchanges, refunds and cancellations work for automotive parts bought on MIVO.",
  alternates: { canonical: "/returns-policy" },
};

export default function ReturnsPolicyPage() {
  return (
    <PolicyPage
      eyebrow="RETURNS & REFUNDS"
      title="Returns & Refunds Policy"
      intro="We want you to get the right part the first time. If something is wrong, here is exactly how returns, refunds and cancellations work."
      updated="30 October 2026"
      current="/returns-policy"
      sections={[
        {
          title: "Return window",
          body: (
            <>
              <p>
                Return requests must be made within <strong>7 days</strong> of
                the order being delivered. Requests made after this period are
                handled under the product warranty instead (see section 6).
              </p>
            </>
          ),
        },
        {
          title: "Who pays for return shipping",
          body: (
            <>
              <div className="policyTable">
                <div>
                  <strong>Wrong, damaged or defective item</strong>
                  <span>
                    MIVO pays the return shipping and sends the correct or
                    replacement part at no extra cost.
                  </span>
                </div>
                <div>
                  <strong>Item marked &ldquo;Fits your vehicle&rdquo; that does not fit</strong>
                  <span>
                    Treated as a MIVO error. MIVO pays the return shipping,
                    provided the vehicle details saved on the order are correct.
                  </span>
                </div>
                <div>
                  <strong>Change of mind</strong>
                  <span>
                    Accepted, but the customer pays shipping both ways: the
                    original delivery fee is not refunded and the customer pays
                    to send the item back.
                  </span>
                </div>
              </div>
              <p>
                Ordering a part that was marked &ldquo;Not compatible&rdquo; or
                &ldquo;Fitment not verified&rdquo; for your vehicle, or entering
                the wrong vehicle details, counts as a change of mind.
              </p>
            </>
          ),
        },
        {
          title: "Condition of returned items",
          body: (
            <ul>
              <li>Unused and not installed on a vehicle.</li>
              <li>
                In the original packaging, with all labels, accessories and
                hardware included.
              </li>
              <li>
                Packed securely. Damage caused by poor packing during the
                return trip may reduce or void the refund.
              </li>
            </ul>
          ),
        },
        {
          title: "How to request a return",
          body: (
            <ol>
              <li>
                Sign in and open the order from{" "}
                <Link href="/orders">My Orders</Link>.
              </li>
              <li>
                Tap <strong>View Warranty</strong> on the delivered order and
                submit a claim for the item. Choose the closest issue type (for example
                &ldquo;Fitment issue&rdquo; or &ldquo;Damage&rdquo;, or
                &ldquo;Other&rdquo; for a change of mind), explain the reason,
                and add clear photos of the item and its packaging.
              </li>
              <li>
                Wait for approval and return instructions before sending
                anything back. Parcels sent without approval may not be
                accepted.
              </li>
            </ol>
          ),
        },
        {
          title: "Refunds",
          body: (
            <>
              <p>
                Once the returned item arrives and passes inspection, the refund
                is issued to the original payment method. Banks usually take
                5–10 working days to show it on your statement.
              </p>
              <p>
                For a change-of-mind return, the refund covers the item price
                only. Shipping fees are not refunded.
              </p>
            </>
          ),
        },
        {
          title: "Warranty claims",
          body: (
            <p>
              Each product shows its warranty period on the product page. For a
              fault that appears after the return window but within the
              warranty period, submit a warranty claim from the order page.
              Warranty does not cover wear and tear, incorrect installation,
              accidents, or use outside the part&rsquo;s intended application.
            </p>
          ),
        },
        {
          title: "Cancelling an order",
          body: (
            <ul>
              <li>
                Unpaid orders are cancelled automatically 24 hours after they
                are placed.
              </li>
              <li>
                Paid orders can be cancelled from the order page until they are
                shipped. Payment processing charges are non-refundable, and a
                cancellation administration fee of 3% (capped at RM20) plus a
                RM2 service fee applies. The exact refund is shown before you
                confirm.
              </li>
              <li>
                Once an order has been shipped, it can no longer be cancelled.
                Use a return request instead.
              </li>
            </ul>
          ),
        },
      ]}
    />
  );
}
