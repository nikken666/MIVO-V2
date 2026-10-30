import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import MarketplaceProvider from "@/components/MarketplaceProvider";
import SiteChrome from "@/components/SiteChrome";


const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mivo-v2.vercel.app";

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

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <MarketplaceProvider>
          <SiteChrome>{children}</SiteChrome>
        </MarketplaceProvider>
      </body>
    </html>
  );
}
