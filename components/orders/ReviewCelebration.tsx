import styles from "./ReviewCelebration.module.css";

/** Thank-you burst shown after a review is submitted. */
export default function ReviewCelebration({ stars }: { stars: number }) {
  const pieces = Array.from({ length: 14 }, (_, i) => i);
  return (
    <div className={styles.wrap} aria-hidden="true">
      <span className={styles.ring} />
      <span className={styles.ring + " " + styles.ring2} />
      {pieces.map((i) => (
        <span
          key={i}
          className={styles.piece}
          style={{
            ["--a" as string]: (i * 360) / pieces.length + "deg",
            ["--d" as string]: 70 + (i % 3) * 16 + "px",
            ["--c" as string]: ["#ffc400", "#0071e3", "#ff3b30", "#1f9d4c"][i % 4],
            animationDelay: 0.25 + (i % 4) * 0.04 + "s",
          }}
        />
      ))}
      <svg viewBox="0 0 64 64" className={styles.star}>
        <path d="M32 5l8.2 16.6 18.3 2.7-13.2 12.9 3.1 18.2L32 46.8 15.6 55.4l3.1-18.2L5.5 24.3l18.3-2.7z" />
      </svg>
      {stars > 0 ? (
        <div className={styles.row}>
          {[1, 2, 3, 4, 5].map((n) => (
            <svg key={n} viewBox="0 0 64 64" className={n <= stars ? styles.small + " " + styles.on : styles.small} style={{ animationDelay: 0.5 + n * 0.09 + "s" }}>
              <path d="M32 5l8.2 16.6 18.3 2.7-13.2 12.9 3.1 18.2L32 46.8 15.6 55.4l3.1-18.2L5.5 24.3l18.3-2.7z" />
            </svg>
          ))}
        </div>
      ) : null}
    </div>
  );
}
