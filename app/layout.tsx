import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Roboto } from "next/font/google";
import "./globals.css";
import MarketplaceProvider from "@/components/MarketplaceProvider";
import SiteChrome from "@/components/SiteChrome";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
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
      <body className={roboto.variable}>
        <MarketplaceProvider>
          <SiteChrome>{children}</SiteChrome>
        </MarketplaceProvider>
      </body>
    </html>
  );
}
