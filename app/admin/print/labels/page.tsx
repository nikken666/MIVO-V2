"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./Labels.module.css";
import { code128Bars } from "@/lib/barcode128";
import type { LabelData } from "@/app/api/admin/print-labels/route";

type Size = "a6" | "a4";

function Barcode({ value, height = 13 }: { value: string; height?: number }) {
  const { bars, width } = useMemo(() => code128Bars(value), [value]);
  return (
    <svg className={styles.barcode} viewBox={`0 0 ${width} 40`} preserveAspectRatio="none" style={{ height: height + "mm" }} aria-label={value}>
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={0} width={b.w} height={40} />
      ))}
    </svg>
  );
}

function when(iso: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-MY", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Label({ label }: { label: LabelData }) {
  const qty = label.items.reduce((sum, i) => sum + i.qty, 0);
  const shown = label.items.slice(0, 9);
  return (
    <article className={styles.label}>
      <header className={styles.top}>
        <div className={styles.brand}>
          <img src="/email-logo.png" alt="MIVO" />
          <span>{label.courier || "Courier"}</span>
        </div>
        <div className={styles.parcelNo}>
          <small>Parcel</small>
          <b>
            {label.parcelNo}/{label.parcelCount}
          </b>
        </div>
      </header>

      <section className={styles.orderCode}>
        <Barcode value={label.orderNumber} />
        <div>
          <span>ORDER</span>
          <b>{label.orderNumber}</b>
        </div>
      </section>

      <section className={styles.to}>
        <small>TO · PENERIMA</small>
        <div className={styles.toName}>
          <b>{label.to.name}</b>
          <b>{label.to.phone}</b>
        </div>
        {label.to.lines.map((line, i) => (
          <p key={i} className={i === label.to.lines.length - 1 ? styles.state : ""}>
            {line}
          </p>
        ))}
      </section>

      <section className={styles.from}>
        <small>FROM · PENGIRIM</small>
        <p>
          <b>{label.from.name}</b>
          {label.from.phone ? " · " + label.from.phone : ""}
        </p>
        <p>{label.from.lines.join(", ")}</p>
      </section>

      <section className={styles.items}>
        <div className={styles.itemsHead}>
          <span>Part</span>
          <span>SKU</span>
          <span>Qty</span>
        </div>
        {shown.map((item, i) => (
          <div key={i} className={styles.itemRow}>
            <span>
              {item.name}
              {item.variant ? <em> · {item.variant}</em> : null}
            </span>
            <span>{item.sku}</span>
            <b>{item.qty}</b>
          </div>
        ))}
        {label.items.length > shown.length ? (
          <p className={styles.more}>+ {label.items.length - shown.length} more line(s) — see the order in MIVO</p>
        ) : null}
      </section>

      <footer className={styles.bottom}>
        <span>
          {qty} item(s){label.weightKg ? " · ~" + label.weightKg + " kg" : ""} · {when(label.orderDate)}
        </span>
        {label.note ? <p className={styles.note}>Note: {label.note}</p> : null}
        {label.tracking ? (
          <div className={styles.tracking}>
            <Barcode value={label.tracking} height={9} />
            <span>{label.tracking}</span>
          </div>
        ) : null}
      </footer>
    </article>
  );
}

/**
 * Printable shipping labels / packing slips: /admin/print/labels?parcels=<ids>
 * or ?orders=<order numbers>. A6 (100×150 mm thermal) or four per A4 page.
 */
export default function PrintLabelsPage() {
  const [labels, setLabels] = useState<LabelData[] | null>(null);
  const [error, setError] = useState("");
  const [size, setSize] = useState<Size>("a6");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("mivo:labelSize");
      if (saved === "a4" || saved === "a6") setSize(saved);
    } catch {
      // ignore
    }
    const params = new URLSearchParams(window.location.search);
    const list = (key: string) => (params.get(key) || "").split(",").map((s) => s.trim()).filter(Boolean);
    fetch("/api/admin/print-labels", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ parcels: list("parcels"), orders: list("orders") }),
    })
      .then(async (response) => {
        const json = (await response.json()) as { labels?: LabelData[]; error?: string };
        if (!response.ok) throw new Error(json.error || "Couldn't load the labels.");
        setLabels(json.labels || []);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
  }, []);

  function choose(next: Size) {
    setSize(next);
    try {
      window.localStorage.setItem("mivo:labelSize", next);
    } catch {
      // ignore
    }
  }

  return (
    <main className={styles.page + " " + (size === "a4" ? styles.sheetA4 : styles.sheetA6)}>
      {/* The paper size follows the choice (thermal 100×150 mm or A4). */}
      <style>{size === "a4" ? "@page{size:A4;margin:0}" : "@page{size:100mm 150mm;margin:0}"}</style>
      <div className={styles.toolbar}>
        <strong>{labels ? labels.length + " label(s)" : "Loading labels…"}</strong>
        <div className={styles.sizes} role="radiogroup" aria-label="Paper">
          <button type="button" className={size === "a6" ? styles.active : ""} onClick={() => choose("a6")}>
            Label printer · 100×150 mm
          </button>
          <button type="button" className={size === "a4" ? styles.active : ""} onClick={() => choose("a4")}>
            A4 paper · 4 per page
          </button>
        </div>
        <button type="button" className={styles.print} disabled={!labels?.length} onClick={() => window.print()}>
          Print
        </button>
      </div>
      {error ? <p className={styles.error}>{error}</p> : null}
      {labels && !labels.length && !error ? <p className={styles.error}>No parcels found.</p> : null}
      <div className={styles.sheet}>
        {(labels || []).map((label) => (
          <Label key={label.parcelId} label={label} />
        ))}
      </div>
    </main>
  );
}
