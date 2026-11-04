// Simple line art for the built-in home banners (shown when no campaign
// picture is uploaded), so the right half of the banner isn't empty.

export type BannerArtKind = "fitment" | "brands" | "warranty";

export default function BannerArt({ kind }: { kind: BannerArtKind }) {
  return (
    <svg className={"shopSlideArt art-" + kind} viewBox="0 0 420 260" aria-hidden="true" focusable="false">
      {kind === "fitment" ? <Fitment /> : kind === "brands" ? <Brands /> : <Warranty />}
    </svg>
  );
}

function Wheel({ x }: { x: number }) {
  return (
    <g>
      <circle cx={x} cy="186" r="34" fill="rgba(10,20,40,.55)" />
      <circle cx={x} cy="186" r="22" fill="none" stroke="#fff" strokeOpacity=".85" strokeWidth="5" />
      <circle cx={x} cy="186" r="6" fill="#fff" fillOpacity=".9" />
      {[0, 72, 144, 216, 288].map((a) => (
        <line
          key={a}
          x1={x}
          y1="186"
          x2={x + 20 * Math.cos((a * Math.PI) / 180)}
          y2={186 + 20 * Math.sin((a * Math.PI) / 180)}
          stroke="#fff"
          strokeOpacity=".7"
          strokeWidth="3"
          strokeLinecap="round"
        />
      ))}
    </g>
  );
}

function Fitment() {
  return (
    <g>
      <ellipse cx="200" cy="222" rx="170" ry="12" fill="rgba(0,0,0,.18)" />
      {/* body */}
      <path
        d="M40 178c0-22 14-34 38-38l52-8c18-28 46-48 84-50h56c30 0 54 16 74 42l26 6c18 4 28 16 28 32v16c0 8-6 14-14 14H54c-8 0-14-6-14-14z"
        fill="#fff"
        fillOpacity=".95"
      />
      {/* windows */}
      <path d="M150 130c14-22 34-36 62-38h28v38z" fill="#9cc8ff" fillOpacity=".85" />
      <path d="M252 92h20c22 0 40 12 56 38h-76z" fill="#9cc8ff" fillOpacity=".85" />
      <rect x="292" y="146" width="22" height="5" rx="2.5" fill="#c5d6ec" />
      <path d="M372 150h18" stroke="#ffcd3c" strokeWidth="6" strokeLinecap="round" />
      <Wheel x={110} />
      <Wheel x={306} />
      {/* "fits" badge */}
      <circle cx="350" cy="58" r="34" fill="#ffcd3c" />
      <path d="M335 58l11 11 20-22" fill="none" stroke="#1d1d1f" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M312 82c-18 14-30 24-44 32" stroke="#fff" strokeOpacity=".6" strokeWidth="3" strokeDasharray="4 8" strokeLinecap="round" fill="none" />
    </g>
  );
}

function Brands() {
  return (
    <g>
      <rect x="70" y="70" width="140" height="150" rx="22" fill="#fff" fillOpacity=".22" transform="rotate(-8 140 145)" />
      <rect x="210" y="60" width="140" height="150" rx="22" fill="#fff" fillOpacity=".22" transform="rotate(8 280 135)" />
      <rect x="140" y="44" width="140" height="170" rx="24" fill="#fff" fillOpacity=".96" />
      {/* brake disc */}
      <circle cx="210" cy="118" r="44" fill="none" stroke="#0a5cff" strokeWidth="9" />
      <circle cx="210" cy="118" r="15" fill="#0a5cff" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx={210 + 29 * Math.cos((a * Math.PI) / 180)} cy={118 + 29 * Math.sin((a * Math.PI) / 180)} r="4.5" fill="#0a5cff" />
      ))}
      <path d="M244 84c16 10 24 24 26 40" stroke="#ffcd3c" strokeWidth="14" strokeLinecap="round" fill="none" />
      <rect x="168" y="182" width="84" height="10" rx="5" fill="#d7e3f5" />
      {/* spring and filter on the side cards */}
      <path d="M100 118c20-8 40-8 60 0M100 136c20-8 40-8 60 0M100 154c20-8 40-8 60 0" stroke="#fff" strokeWidth="6" strokeLinecap="round" fill="none" transform="rotate(-8 130 136)" />
      <rect x="292" y="104" width="34" height="58" rx="8" fill="none" stroke="#fff" strokeWidth="6" transform="rotate(8 309 133)" />
    </g>
  );
}

function Warranty() {
  return (
    <g>
      <circle cx="210" cy="132" r="104" fill="#fff" fillOpacity=".08" />
      <circle cx="210" cy="132" r="80" fill="#fff" fillOpacity=".08" />
      <path d="M210 44l84 30v52c0 52-36 86-84 104-48-18-84-52-84-104V74z" fill="#fff" fillOpacity=".96" />
      <path d="M210 66l62 22v38c0 38-26 64-62 78z" fill="#dce9ff" />
      <path d="M176 134l24 24 46-50" fill="none" stroke="#0a5cff" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
      {[
        [96, 62],
        [330, 92],
        [318, 196],
        [104, 192],
      ].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y - 10}v20M${x - 10} ${y}h20`} stroke="#ffcd3c" strokeWidth="5" strokeLinecap="round" />
      ))}
    </g>
  );
}
