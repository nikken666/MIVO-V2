"use client";

import { useEffect, useState, type ReactNode } from "react";
import styles from "@/app/admin/Admin.module.css";

type Mode = "easyparcel" | "manual";
const KEY = "mivo:shipMode";

/**
 * Two ways to ship a parcel: book it with EasyParcel (label + tracking
 * automatically), or ship it any other way and type the tracking number.
 * The last choice is remembered on this device.
 */
export default function ShipModeTabs({ easyParcel, manual }: { easyParcel: ReactNode; manual: ReactNode }) {
  const [mode, setMode] = useState<Mode>("easyparcel");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved === "manual" || saved === "easyparcel") setMode(saved);
    } catch {
      // private window: default tab
    }
  }, []);

  function choose(next: Mode) {
    setMode(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
  }

  return (
    <div className={styles.shipModes}>
      <div className={styles.shipModeTabs} role="tablist" aria-label="How do you ship this parcel?">
        <button type="button" role="tab" aria-selected={mode === "easyparcel"} className={mode === "easyparcel" ? styles.shipModeActive : ""} onClick={() => choose("easyparcel")}>
          Book with EasyParcel
        </button>
        <button type="button" role="tab" aria-selected={mode === "manual"} className={mode === "manual" ? styles.shipModeActive : ""} onClick={() => choose("manual")}>
          Ship myself · enter tracking no.
        </button>
      </div>
      <div className={styles.shipModeBody} role="tabpanel">
        {mode === "easyparcel" ? easyParcel : manual}
        <small className={styles.shipModeHint}>
          {mode === "easyparcel"
            ? "EasyParcel books the courier, prints the label and fills in the tracking number."
            : "Sent it at a counter, by Lalamove or yourself? Pick the courier and type its tracking number; the buyer sees it right away."}
        </small>
      </div>
    </div>
  );
}
