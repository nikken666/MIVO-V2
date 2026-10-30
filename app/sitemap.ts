import type { MetadataRoute } from "next";
import { getActiveProducts } from "@/lib/catalog";

// The catalog client reads request cookies, so build the sitemap per request.
export const dynamic = "force-dynamic";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mivo-v2.vercel.app";

const productGroups = [
  "maintenance",
  "braking",
  "suspension",
  "steering",
  "drivetrain",
  "cooling",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getActiveProducts();

  return [
    { url: siteUrl + "/", changeFrequency: "daily", priority: 1 },
    { url: siteUrl + "/products", changeFrequency: "daily", priority: 0.9 },
    { url: siteUrl + "/brands", changeFrequency: "weekly", priority: 0.6 },
    ...["/shipping-policy", "/returns-policy", "/privacy-policy"].map((path) => ({
      url: siteUrl + path,
      changeFrequency: "monthly" as const,
      priority: 0.3,
    })),
    ...productGroups.map((group) => ({
      url: siteUrl + "/products?group=" + group,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
    ...products.map((product) => ({
      url: siteUrl + "/products/" + product.slug,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
