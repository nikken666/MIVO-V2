import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MarketplaceProvider from "@/components/MarketplaceProvider";

export const metadata: Metadata = {
  title: "MIVO | Find The Right Parts",
  description: "Malaysia automotive parts marketplace",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <MarketplaceProvider>
          <Header />
          {children}
          <Footer />
        </MarketplaceProvider>
      </body>
    </html>
  );
}
