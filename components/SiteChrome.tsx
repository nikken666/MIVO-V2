"use client";

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SiteChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBackOffice =
    pathname === "/admin" ||
    pathname.startsWith("/admin/") ||
    pathname === "/sellers" ||
    pathname.startsWith("/sellers/");

  return (
    <>
      {!isBackOffice ? <Header /> : null}
      {children}
      {!isBackOffice ? <Footer /> : null}
    </>
  );
}
