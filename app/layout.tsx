import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import MarketplaceProvider from "@/components/MarketplaceProvider";
import SiteChrome from "@/components/SiteChrome";
import ViewportFix from "@/components/ViewportFix";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import LanguageProvider from "@/components/LanguageProvider";
import { getLocale } from "@/lib/i18n/server";


// SF Pro is used on Apple devices; Inter is the closest match everywhere else.
const inter = Inter({
  subsets: ["latin", "latin-ext", "vietnamese"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  themeColor: "#ffffff",
};

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://www.mivoparts.my";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "MIVO | Premium Automotive Parts",
  description: "Premium automotive parts, precisely matched to your vehicle.",
  openGraph: {
    type: "website",
    siteName: "MIVO",
    title: "MIVO | Premium Automotive Parts",
    description: "Premium automotive parts, precisely matched to your vehicle.",
    images: ["/campaigns/mivo-automotive-art.jpg"],
  },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale === "zh" ? "zh-Hans" : locale} className={inter.variable}>
      <body>
        {/* A product photo that fails to load (e.g. removed on Shopee) shows a neat placeholder instead of a broken icon. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'document.addEventListener("error",function(e){var t=e.target;if(t&&t.tagName==="IMG"&&!t.getAttribute("data-fallback")&&!/part-placeholder|mivo-logo|\\.svg/.test(t.currentSrc||t.src)){t.setAttribute("data-fallback","1");t.removeAttribute("srcset");t.src="/part-placeholder.svg";}},true);',
          }}
        />
        <ViewportFix />
        <ServiceWorkerRegister />
        <LanguageProvider initialLocale={locale}>
          <MarketplaceProvider>
            <SiteChrome>{children}</SiteChrome>
          </MarketplaceProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
