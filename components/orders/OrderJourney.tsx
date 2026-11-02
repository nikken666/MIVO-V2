"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/LanguageProvider";
import type { Key } from "@/lib/i18n";
import styles from "./OrderJourney.module.css";

type Stage = "unpaid" | "toShip" | "packed" | "shipped" | "delivered";

export function stageForStatus(status: string): Stage {
  if (status === "delivered" || status === "completed") return "delivered";
  if (status === "shipped") return "shipped";
  if (status === "packed") return "packed";
  if (status === "paid" || status === "processing") return "toShip";
  return "unpaid";
}

const order: Stage[] = ["toShip", "packed", "shipped", "delivered"];

/** Animated order progress: preparing → packed → on the way → delivered. */
export default function OrderJourney({
  status,
  detail,
}: {
  status: string;
  detail?: string | null;
}) {
  const t = useT();
  const stage = stageForStatus(status);
  const index = Math.max(0, order.indexOf(stage));
  // Fill the bar after the first paint so it animates in.
  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setFill(stage === "unpaid" ? 0 : index / (order.length - 1)));
    return () => cancelAnimationFrame(id);
  }, [index, stage]);

  return (
    <section className={styles.card} data-stage={stage} aria-live="polite">
      <div className={styles.scene} aria-hidden="true">
        {stage === "unpaid" ? <UnpaidScene /> : null}
        {stage === "toShip" ? <PreparingScene /> : null}
        {stage === "packed" ? <PackedScene /> : null}
        {stage === "shipped" ? <TruckScene /> : null}
        {stage === "delivered" ? <DeliveredScene /> : null}
      </div>

      <div className={styles.text}>
        <span className={styles.badge}>{t(("journey.tab." + stage) as Key)}</span>
        <h2>{t(("journey.title." + stage) as Key)}</h2>
        <p>{detail || t(("journey.text." + stage) as Key)}</p>
      </div>

      <ol className={styles.track}>
        <span className={styles.rail} aria-hidden="true">
          <span className={styles.railFill} style={{ transform: "scaleX(" + fill + ")" }} />
        </span>
        {order.map((step, i) => {
          const done = stage !== "unpaid" && i < index;
          const current = stage !== "unpaid" && i === index;
          return (
            <li
              key={step}
              className={styles.node + (done ? " " + styles.done : "") + (current ? " " + styles.current : "")}
              style={{ transitionDelay: i * 0.18 + "s" }}
            >
              <i>{done || (current && step === "delivered") ? "✓" : i + 1}</i>
              <span>{t(("journey.step." + step) as Key)}</span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function UnpaidScene() {
  return (
    <svg viewBox="0 0 240 120" className={styles.svg}>
      <rect x="70" y="30" width="100" height="62" rx="10" className={styles.cardShape} />
      <rect x="70" y="44" width="100" height="12" className={styles.cardStripe} />
      <rect x="82" y="68" width="34" height="8" rx="4" className={styles.cardChip} />
      <g className={styles.pulse}>
        <circle cx="168" cy="34" r="14" className={styles.clock} />
        <path d="M168 26v9l6 4" className={styles.clockHand} />
      </g>
    </svg>
  );
}

function PreparingScene() {
  return (
    <svg viewBox="0 0 240 120" className={styles.svg}>
      <ellipse cx="120" cy="104" rx="60" ry="6" className={styles.shadow} />
      {/* Parts dropping into the box */}
      <g className={styles.dropA}>
        <circle cx="108" cy="20" r="9" className={styles.part} />
        <circle cx="108" cy="20" r="3.5" className={styles.partHole} />
      </g>
      <g className={styles.dropB}>
        <rect x="124" y="12" width="16" height="10" rx="3" className={styles.partAlt} />
      </g>
      {/* Box */}
      <path d="M78 58h84v42a4 4 0 0 1-4 4H82a4 4 0 0 1-4-4z" className={styles.box} />
      <path d="M78 58h84" className={styles.boxEdge} />
      <path d="M78 58l-14-16h50l6 16z" className={styles.flapL} />
      <path d="M162 58l14-16h-50l-6 16z" className={styles.flapR} />
      <text x="120" y="88" textAnchor="middle" className={styles.boxLabel}>MIVO</text>
      <g className={styles.sparkle}>
        <path d="M186 36l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" />
      </g>
    </svg>
  );
}

function PackedScene() {
  return (
    <svg viewBox="0 0 240 120" className={styles.svg}>
      <ellipse cx="110" cy="104" rx="52" ry="6" className={styles.shadow} />
      <g className={styles.bob}>
        <path d="M62 48h96v52a4 4 0 0 1-4 4H66a4 4 0 0 1-4-4z" className={styles.box} />
        <path d="M62 48l10-14h76l10 14z" className={styles.boxTop} />
        <rect x="104" y="34" width="12" height="70" className={styles.tape} />
        <rect x="74" y="70" width="40" height="22" rx="3" className={styles.labelPaper} />
        <path d="M80 77h28M80 84h18" className={styles.labelLines} />
      </g>
      <g className={styles.pulse}>
        <circle cx="186" cy="52" r="20" className={styles.clock} />
        <path d="M186 40v13l9 6" className={styles.clockHand} />
      </g>
    </svg>
  );
}

function TruckScene() {
  return (
    <svg viewBox="0 0 240 120" className={styles.svg}>
      <g className={styles.road}>
        <path d="M-40 106h320" className={styles.roadDash} />
      </g>
      <g className={styles.speed}>
        <path d="M18 54h26M10 66h30M22 78h20" />
      </g>
      <g className={styles.truck}>
        <rect x="56" y="38" width="96" height="54" rx="6" className={styles.truckBody} />
        <text x="104" y="71" textAnchor="middle" className={styles.truckText}>MIVO</text>
        <path d="M152 52h28l18 22v18h-46z" className={styles.cab} />
        <path d="M158 58h19l11 14h-30z" className={styles.window} />
        <g className={styles.wheel} style={{ transformOrigin: "82px 94px" }}>
          <circle cx="82" cy="94" r="11" className={styles.tyre} />
          <path d="M82 86v16M74 94h16" className={styles.spoke} />
        </g>
        <g className={styles.wheel} style={{ transformOrigin: "176px 94px" }}>
          <circle cx="176" cy="94" r="11" className={styles.tyre} />
          <path d="M176 86v16M168 94h16" className={styles.spoke} />
        </g>
      </g>
      <g className={styles.pin}>
        <path d="M222 30c-8 0-13 6-13 13 0 9 13 21 13 21s13-12 13-21c0-7-5-13-13-13z" />
        <circle cx="222" cy="43" r="5" className={styles.pinDot} />
      </g>
    </svg>
  );
}

function DeliveredScene() {
  return (
    <svg viewBox="0 0 240 120" className={styles.svg}>
      <ellipse cx="120" cy="106" rx="76" ry="6" className={styles.shadow} />
      <path d="M58 58l42-30 42 30v46H58z" className={styles.house} />
      <path d="M50 62l50-38 50 38" className={styles.roof} />
      <rect x="90" y="74" width="20" height="30" rx="2" className={styles.door} />
      <g className={styles.land}>
        <path d="M122 84h30v20h-30z" className={styles.box} />
        <rect x="134" y="84" width="6" height="20" className={styles.tape} />
      </g>
      <g className={styles.check}>
        <circle cx="182" cy="44" r="20" />
        <path d="M172 44l7 7 13-14" className={styles.checkMark} />
      </g>
      <g className={styles.confetti}>
        <rect x="160" y="20" width="5" height="9" rx="1" />
        <rect x="204" y="28" width="5" height="9" rx="1" />
        <rect x="196" y="70" width="5" height="9" rx="1" />
        <rect x="160" y="70" width="5" height="9" rx="1" />
      </g>
    </svg>
  );
}
