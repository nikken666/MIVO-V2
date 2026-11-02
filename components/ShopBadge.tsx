import Link from "next/link";

export type ShopTier = "direct" | "preferred" | "standard";

export function shopHref(shop: { sellerSlug?: string; sellerId?: string }) {
  const key = shop.sellerSlug || shop.sellerId;
  return key ? "/shops/" + encodeURIComponent(key) : "/shops";
}

/** Tier badge: MIVO Direct (official, blue + yellow) or Preferred (yellow). */
export default function ShopBadge({
  tier,
  size = "sm",
}: {
  tier?: ShopTier | null;
  size?: "sm" | "md";
}) {
  if (tier === "direct") {
    return (
      <span className={"shopBadge shopBadgeDirect " + size} title="Sold and shipped by MIVO">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.5l1.6 1.2 2 .1.6 1.9 1.6 1.2-.6 1.9.6 1.9-1.6 1.2-.6 1.9-2 .1L8 14.5l-1.6-1.2-2-.1-.6-1.9L2.2 10l.6-1.9-.6-1.9 1.6-1.2.6-1.9 2-.1z" />
          <path className="tick" d="M5.6 8.2l1.6 1.6 3.2-3.4" />
        </svg>
        MIVO Direct
      </span>
    );
  }
  if (tier === "preferred") {
    return (
      <span className={"shopBadge shopBadgePreferred " + size} title="Preferred seller">
        Preferred
      </span>
    );
  }
  return null;
}

/** Shop line used on product cards and the product page. */
export function ShopLine({
  name,
  tier,
  sellerSlug,
  sellerId,
}: {
  name?: string;
  tier?: ShopTier;
  sellerSlug?: string;
  sellerId?: string;
}) {
  if (!name) return null;
  return (
    <Link href={shopHref({ sellerSlug, sellerId })} className="productShopLine">
      <ShopBadge tier={tier} />
      <span>{name}</span>
    </Link>
  );
}
