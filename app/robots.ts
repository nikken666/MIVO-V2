import type { MetadataRoute } from "next";

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  "https://mivo-v2.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/sellers",
        "/account",
        "/cart",
        "/checkout",
        "/orders",
        "/login",
        "/api",
      ],
    },
    sitemap: siteUrl + "/sitemap.xml",
  };
}
