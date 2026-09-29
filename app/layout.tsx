import type { Metadata } from "next";
import type { ReactNode } from "react";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import MarketplaceProvider from "@/components/MarketplaceProvider";
import SiteChrome from "@/components/SiteChrome";

const shopeeLike = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-shopee",
});

export const metadata: Metadata = {
  title: "MIVO | Premium Automotive Parts",
  description: "Premium automotive parts, precisely matched to your vehicle.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={shopeeLike.variable}>
        <MarketplaceProvider>
          <SiteChrome>{children}</SiteChrome>
        </MarketplaceProvider>
      </body>
    </html>
  );
}
