import type { Metadata } from "next";
import Link from "next/link";
import PolicyPage from "@/components/PolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy | MIVO",
  description:
    "How MIVO collects, uses and protects your personal data under Malaysia's Personal Data Protection Act 2010.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage
      eyebrow="PRIVACY"
      title="Privacy Policy"
      intro="This policy explains what personal data MIVO collects, why we collect it, and how we protect it, in line with Malaysia's Personal Data Protection Act 2010 (PDPA)."
      updated="30 October 2026"
      current="/privacy-policy"
      sections={[
        {
          title: "Data we collect",
          body: (
            <ul>
              <li>
                <strong>Account details:</strong> name, email address and
                password (stored encrypted, never visible to us).
              </li>
              <li>
                <strong>Delivery details:</strong> recipient name, phone
                number and shipping address.
              </li>
              <li>
                <strong>Vehicle details:</strong> the cars you save to My
                Garage, used to match compatible parts.
              </li>
              <li>
                <strong>Order history:</strong> items purchased, payments,
                returns, warranty claims and reviews, including any photos you
                upload.
              </li>
              <li>
                <strong>Technical data:</strong> cookies and similar storage
                needed to keep you signed in and remember your cart and
                vehicle.
              </li>
            </ul>
          ),
        },
        {
          title: "Payment information",
          body: (
            <p>
              Card payments are processed by our payment provider, Stripe. MIVO
              does not see or store your full card number.
            </p>
          ),
        },
        {
          title: "How we use your data",
          body: (
            <ul>
              <li>To process, deliver and support your orders.</li>
              <li>To show parts that fit your saved vehicles.</li>
              <li>To handle returns, refunds and warranty claims.</li>
              <li>
                To send order and account updates. We only send marketing
                messages if you have agreed to receive them.
              </li>
              <li>To prevent fraud and keep the platform secure.</li>
            </ul>
          ),
        },
        {
          title: "Who we share it with",
          body: (
            <>
              <p>
                We share only what is needed to run the service, with:
              </p>
              <ul>
                <li>courier partners, to deliver your parcel;</li>
                <li>our payment provider, to take and refund payments;</li>
                <li>
                  hosting and database providers that store the platform&rsquo;s
                  data on our behalf.
                </li>
              </ul>
              <p>
                We do not sell your personal data. We may disclose it where
                required by law.
              </p>
            </>
          ),
        },
        {
          title: "How long we keep it",
          body: (
            <p>
              We keep account data while your account is active. Order and
              payment records are kept for as long as needed for warranty,
              accounting and legal requirements, then deleted or anonymised.
            </p>
          ),
        },
        {
          title: "Your rights",
          body: (
            <p>
              Under the PDPA you may ask to access or correct your personal
              data, or withdraw consent to marketing. You can update most
              details yourself from <Link href="/account">My Account</Link>.
              For anything else, contact MIVO customer support.
            </p>
          ),
        },
        {
          title: "Changes to this policy",
          body: (
            <p>
              We may update this policy from time to time. The latest version
              is always on this page, with the date it was last updated.
            </p>
          ),
        },
      ]}
    />
  );
}
