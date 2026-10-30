import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Shipping Policy | MIVO",
  description:
    "Delivery coverage, shipping fees, dispatch times and tracking for MIVO orders in Malaysia.",
  alternates: { canonical: "/shipping-policy" },
};

export default function ShippingPolicyPage() {
  return (
    <PolicyPage
      eyebrow="SHIPPING"
      title="Shipping Policy"
      intro="MIVO ships automotive parts across Malaysia. Here is how delivery, fees and tracking work."
      updated="30 October 2026"
      current="/shipping-policy"
      sections={[
        {
          title: "Delivery coverage",
          body: (
            <p>
              We deliver to addresses in Peninsular Malaysia, Sabah and
              Sarawak. Some bulky or restricted parts can only be shipped to
              certain states. If so, checkout will tell you before you pay.
            </p>
          ),
        },
        {
          title: "Shipping fees",
          body: (
            <>
              <p>
                Shipping is calculated at checkout from your state and
                postcode, the courier you choose, and the weight and size of
                the parts in your order. Bulky items may carry a surcharge.
              </p>
              <p>
                Some zones offer free shipping above a minimum order value.
                When it applies, checkout shows the fee as &ldquo;FREE&rdquo;.
              </p>
            </>
          ),
        },
        {
          title: "Dispatch time",
          body: (
            <p>
              Paid orders are usually packed and handed to the courier within{" "}
              <strong>1–3 working days</strong>. Orders placed on weekends or
              public holidays are processed on the next working day.
            </p>
          ),
        },
        {
          title: "Delivery time",
          body: (
            <div className="policyTable">
              <div>
                <strong>Peninsular Malaysia</strong>
                <span>Usually 2–4 working days after dispatch.</span>
              </div>
              <div>
                <strong>Sabah, Sarawak &amp; Labuan</strong>
                <span>Usually 4–7 working days after dispatch.</span>
              </div>
            </div>
          ),
        },
        {
          title: "Tracking your order",
          body: (
            <p>
              Once your order ships, the courier and tracking number appear on
              the order page. Sign in and go to{" "}
              <Link href="/orders">Track Order</Link> to follow it.
            </p>
          ),
        },
        {
          title: "Receiving your parcel",
          body: (
            <p>
              Please check the parcel when it arrives. If the box is visibly
              damaged or the item is wrong or broken, take photos and submit a
              claim through View Warranty on the order page within 7 days of
              delivery. See the{" "}
              <Link href="/returns-policy">Returns &amp; Refunds Policy</Link>{" "}
              for details.
            </p>
          ),
        },
      ]}
    />
  );
}
