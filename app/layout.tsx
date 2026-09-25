import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import MarketplaceProvider from "@/components/MarketplaceProvider";
import SiteChrome from "@/components/SiteChrome";

export const metadata: Metadata = {
  title: "MIVO | Premium Automotive Parts",
  description: "Premium automotive parts, precisely matched to your vehicle.",
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
