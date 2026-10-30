import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import MarketplaceProvider from "@/components/MarketplaceProvider";
import SiteChrome from "@/components/SiteChrome";


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
    <html lang="en" className={inter.variable}>
      <body>
        <MarketplaceProvider>
          <SiteChrome>{children}</SiteChrome>
        </MarketplaceProvider>
      </body>
    </html>
  );
}
