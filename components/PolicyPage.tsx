import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@/lib/i18n";

export type PolicySection = {
  title: string;
  body: ReactNode;
};

const ui: Record<
  Locale,
  {
    heading: string;
    shipping: string;
    returns: string;
    privacy: string;
    lastUpdated: string;
  }
> = {
  en: {
    heading: "MIVO policies",
    shipping: "Shipping",
    returns: "Returns & Refunds",
    privacy: "Privacy",
    lastUpdated: "Last updated:",
  },
  ms: {
    heading: "Polisi MIVO",
    shipping: "Penghantaran",
    returns: "Pulangan & Bayaran Balik",
    privacy: "Privasi",
    lastUpdated: "Dikemas kini:",
  },
  zh: {
    heading: "MIVO 政策",
    shipping: "运送",
    returns: "退货与退款",
    privacy: "隐私",
    lastUpdated: "最后更新：",
  },
};

export default function PolicyPage({
  locale,
  eyebrow,
  title,
  intro,
  updated,
  current,
  sections,
}: {
  locale: Locale;
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  current: string;
  sections: PolicySection[];
}) {
  const t = ui[locale];
  const policyLinks = [
    { href: "/shipping-policy", label: t.shipping },
    { href: "/returns-policy", label: t.returns },
    { href: "/privacy-policy", label: t.privacy },
  ];

  return (
    <main className="policyPage">
      <div className="container policyLayout">
        <aside className="policyNav" aria-label="Policies">
          <span>{t.heading}</span>
          {policyLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={link.href === current ? "page" : undefined}
            >
              {link.label}
            </Link>
          ))}
        </aside>

        <article className="policyContent">
          <span className="policyEyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="policyIntro">{intro}</p>
          <small className="policyUpdated">
            {t.lastUpdated}
            {locale === "zh" ? "" : " "}
            {updated}
          </small>

          {sections.map((section, index) => (
            <section key={section.title}>
              <h2>
                <i>{String(index + 1).padStart(2, "0")}</i>
                {section.title}
              </h2>
              {section.body}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
