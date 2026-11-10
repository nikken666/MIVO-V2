"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { GA_ID, META_PIXEL_ID } from "@/lib/analytics";

/**
 * Loads Google Analytics 4 and the Meta Pixel when their IDs are set in Vercel.
 * Visits from the parcel sticker QR (?src=sticker) show up in Google Analytics as
 * source "sticker" / medium "qr" (Reports -> Acquisition -> Traffic acquisition).
 */
const gaSetup = (id: string) => `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
window.gtag = gtag;
gtag('js', new Date());
(function(){
  var cfg = {};
  try {
    var u = new URL(location.href);
    var src = u.searchParams.get('src');
    if (src && !u.searchParams.get('utm_source')) {
      u.searchParams.set('utm_source', src);
      u.searchParams.set('utm_medium', src === 'sticker' ? 'qr' : 'referral');
      u.searchParams.set('utm_campaign', src === 'sticker' ? 'parcel_sticker' : src);
      cfg.page_location = u.toString();
    }
  } catch (e) {}
  gtag('config', ${JSON.stringify(id)}, cfg);
})();`;

const pixelSetup = (id: string) => `
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', ${JSON.stringify(id)});
fbq('track', 'PageView');`;

export default function Analytics() {
  const pathname = usePathname();
  const first = useRef(true);

  // Google Analytics counts page changes by itself; the Pixel needs to be told.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    try {
      (window as Window & { fbq?: (...args: unknown[]) => void }).fbq?.("track", "PageView");
    } catch {}
  }, [pathname]);

  // Keep the admin area out of the numbers.
  if (pathname?.startsWith("/admin")) return null;

  return (
    <>
      {GA_ID ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`} strategy="afterInteractive" />
          <Script id="mivo-ga" strategy="afterInteractive">{gaSetup(GA_ID)}</Script>
        </>
      ) : null}
      {META_PIXEL_ID ? (
        <Script id="mivo-pixel" strategy="afterInteractive">{pixelSetup(META_PIXEL_ID)}</Script>
      ) : null}
    </>
  );
}
