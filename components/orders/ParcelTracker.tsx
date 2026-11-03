"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import type { Key } from "@/lib/i18n";
import { intlTag } from "@/lib/i18n/format";
import styles from "./ParcelTracker.module.css";

type TrackEvent = { code: number | null; description: string; location: string | null; time: string };
type TrackedParcel = {
  sellerOrderId: string;
  courier: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  method: string | null;
  status: string;
  statusCode: number | null;
  statusText: string | null;
  events: TrackEvent[];
};

const STOPS = ["shipped", "collected", "transit", "delivered"] as const;

/** EasyParcel status codes → route stop (0 shop · 1 collected · 2 on the way · 3 delivered). */
function stopFor(parcel: TrackedParcel) {
  const code = parcel.statusCode ?? parcel.events[0]?.code ?? null;
  if (code === 5 || parcel.status === "delivered") return 3;
  if (code === 4) return 2;
  if (code === 3) return 1;
  if (code === 2 || code === 7 || code === 11) return 0;
  return parcel.trackingNumber ? 1 : 0;
}

/** Animated parcel journey with the courier's scan history. */
export default function ParcelTracker({ orderNumber, shopNames }: { orderNumber: string; shopNames: Record<string, string> }) {
  const t = useT();
  const [parcels, setParcels] = useState<TrackedParcel[] | null>(null);
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/shipping/track?order=" + encodeURIComponent(orderNumber))
      .then((r) => (r.ok ? r.json() : { parcels: [] }))
      .then((data: { parcels?: TrackedParcel[] }) => active && setParcels((data.parcels || []).filter((p) => p.trackingNumber)))
      .catch(() => active && setParcels([]));
    return () => {
      active = false;
    };
  }, [orderNumber]);

  if (!parcels?.length) return null;

  return (
    <div className={styles.wrap}>
      {parcels.map((parcel, index) => {
        const stop = stopFor(parcel);
        const latest = parcel.events[0];
        const returned = parcel.statusCode === 6;
        return (
          <section className={styles.card} key={parcel.sellerOrderId} data-stop={stop}>
            <header className={styles.head}>
              <div>
                <small>
                  {t("trk.parcel", { n: index + 1 })}
                  {shopNames[parcel.sellerOrderId] ? " · " + shopNames[parcel.sellerOrderId] : ""}
                </small>
                <strong>{parcel.courier || t("trk.courier")}</strong>
              </div>
              <button
                type="button"
                className={styles.copy}
                onClick={() => {
                  void navigator.clipboard?.writeText(parcel.trackingNumber || "");
                  setCopied(parcel.sellerOrderId);
                  setTimeout(() => setCopied(""), 1500);
                }}
              >
                <span>{parcel.trackingNumber}</span>
                <em>{copied === parcel.sellerOrderId ? t("trk.copied") : t("trk.copy")}</em>
              </button>
            </header>

            <div className={styles.headline}>
              <b>{returned ? t("trk.returned") : t(("trk.stop." + STOPS[stop]) as Key)}</b>
              {latest ? <span>{latest.location ? latest.location + " · " : ""}{latest.description}</span> : <span>{t("trk.waiting")}</span>}
            </div>

            <div className={styles.route} style={{ ["--stop" as string]: stop }}>
              <div className={styles.rail}>
                <div className={styles.railFill} />
                <div className={styles.dashes} />
              </div>
              <div className={styles.truck} aria-hidden="true">
                <svg viewBox="0 0 48 32">
                  <rect x="2" y="6" width="28" height="18" rx="3" className={styles.truckBox} />
                  <path d="M30 12h9l7 7v5H30z" className={styles.truckCab} />
                  <path d="M33 14h5l4 5h-9z" className={styles.truckWindow} />
                  <circle cx="10" cy="26" r="4" className={styles.wheel} />
                  <circle cx="38" cy="26" r="4" className={styles.wheel} />
                </svg>
              </div>
              <ol className={styles.stops}>
                {STOPS.map((name, i) => (
                  <li key={name} className={i < stop ? styles.done : i === stop ? styles.current : ""}>
                    <i aria-hidden="true">{["📦", "🤝", "🚚", "🏠"][i]}</i>
                    <span>{t(("trk.short." + name) as Key)}</span>
                  </li>
                ))}
              </ol>
            </div>

            {parcel.events.length ? (
              <ol className={styles.timeline}>
                {parcel.events.map((event, i) => (
                  <li key={event.time + i} className={i === 0 ? styles.latest : ""} style={{ animationDelay: i * 60 + "ms" }}>
                    <time>{new Date(event.time).toLocaleString(intlTag(), { dateStyle: "medium", timeStyle: "short" })}</time>
                    <p>{event.description}</p>
                    {event.location ? <small>{event.location}</small> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.empty}>{t("trk.noScans")}</p>
            )}

            {parcel.trackingUrl ? (
              <a className={styles.external} href={parcel.trackingUrl} target="_blank" rel="noreferrer">
                {t("trk.courierSite")} ↗
              </a>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
