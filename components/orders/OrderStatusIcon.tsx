import styles from "./OrderJourney.module.css";

/** Small looping icon next to an order's status in the order list. */
export default function OrderStatusIcon({ bucket }: { bucket: string }) {
  if (bucket === "to_ship") {
    return (
      <svg viewBox="0 0 32 32" className={styles.mini} aria-hidden="true">
        <g className={styles.miniWiggle}>
          <path d="M6 13h20v13H6z" className={styles.box} />
          <path d="M6 13l-3-5h11l2 5zM26 13l3-5H18l-2 5z" className={styles.boxTop} />
        </g>
      </svg>
    );
  }
  if (bucket === "to_receive") {
    return (
      <svg viewBox="0 0 32 32" className={styles.mini} aria-hidden="true">
        <g className={styles.miniDrive}>
          <rect x="3" y="9" width="16" height="12" rx="2" className={styles.truckBody} />
          <path d="M19 13h5l4 5v3h-9z" className={styles.cab} />
          <circle cx="9" cy="23" r="3" className={styles.tyre} />
          <circle cx="23" cy="23" r="3" className={styles.tyre} />
        </g>
        <path d="M0 28h32" className={styles.miniRoad} />
      </svg>
    );
  }
  if (bucket === "completed") {
    return (
      <svg viewBox="0 0 32 32" className={styles.mini} aria-hidden="true">
        <circle cx="16" cy="16" r="12" className={styles.miniDone} />
        <path d="M10 16l4 4 8-8" className={styles.checkMark} />
      </svg>
    );
  }
  return null;
}
