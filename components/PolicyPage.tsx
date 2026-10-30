import Link from "next/link";
import type { ReactNode } from "react";

export type PolicySection = {
  title: string;
  body: ReactNode;
};

const policyLinks = [
  { href: "/shipping-policy", label: "Shipping" },
  { href: "/returns-policy", label: "Returns & Refunds" },
  { href: "/privacy-policy", label: "Privacy" },
];

export default function PolicyPage({
  eyebrow,
  title,
  intro,
  updated,
  current,
  sections,
}: {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  current: string;
  sections: PolicySection[];
}) {
  return (
    <main className="policyPage">
      <div className="container policyLayout">
        <aside className="policyNav" aria-label="Policies">
          <span>MIVO POLICIES</span>
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
          <small className="policyUpdated">Last updated: {updated}</small>

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
