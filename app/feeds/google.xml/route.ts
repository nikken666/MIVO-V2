import { getActiveProducts } from "@/lib/catalog";
import { htmlToPlainText } from "@/lib/plainText";

/**
 * Google Merchant Center product feed: https://www.mivoparts.my/feeds/google.xml
 * Add it in Merchant Center -> Products -> Add products -> "Add from a file" ->
 * "Enter a link to your file", fetched daily. One entry per product, priced at its
 * cheapest option (with the sale price when a shop discount is on).
 */

export const dynamic = "force-dynamic";

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.mivoparts.my").replace(/\/$/, "");

function xml(value: unknown) {
  return String(value ?? "")
    // characters XML 1.0 does not allow
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function money(value: number) {
  return (Math.round(value * 100) / 100).toFixed(2) + " MYR";
}

function absolute(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  return siteUrl + (url.startsWith("/") ? url : "/" + url);
}

export async function GET() {
  const products = (await getActiveProducts()).filter((product) => product.id && product.imageUrl);

  const items = products.map((product) => {
    const variants = product.variants || [];
    const cheapest = variants.reduce(
      (best, variant) => (!best || variant.price < best.price ? variant : best),
      variants[0]
    );
    const price = Number(cheapest?.price ?? product.price) || 0;
    const regular = Number(cheapest?.compareAtPrice || 0);
    const onSale = regular > price;
    const inStock = Number(product.stock || 0) > 0;
    const images = (product.imageUrls?.length ? product.imageUrls : [product.imageUrl!]).map(absolute);
    const description =
      htmlToPlainText(product.description || product.shortDescription || product.name).slice(0, 4900) || product.name;

    return [
      "<item>",
      `<g:id>${xml(product.id)}</g:id>`,
      `<g:title>${xml(product.name.slice(0, 150))}</g:title>`,
      `<g:description>${xml(description)}</g:description>`,
      `<g:link>${xml(siteUrl + "/products/" + encodeURIComponent(product.slug))}</g:link>`,
      `<g:image_link>${xml(images[0])}</g:image_link>`,
      ...images.slice(1, 11).map((url) => `<g:additional_image_link>${xml(url)}</g:additional_image_link>`),
      `<g:availability>${inStock ? "in_stock" : "out_of_stock"}</g:availability>`,
      `<g:price>${money(onSale ? regular : price)}</g:price>`,
      onSale ? `<g:sale_price>${money(price)}</g:sale_price>` : "",
      `<g:condition>new</g:condition>`,
      `<g:brand>${xml(product.brand || "MIVO")}</g:brand>`,
      // Shop SKUs aren't manufacturer part numbers, so no GTIN/MPN is claimed.
      `<g:identifier_exists>no</g:identifier_exists>`,
      // Vehicles & Parts > Vehicle Parts & Accessories
      `<g:google_product_category>5613</g:google_product_category>`,
      `<g:product_type>${xml(product.category || "Automotive Parts")}</g:product_type>`,
      "</item>",
    ]
      .filter(Boolean)
      .join("");
  });

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel>' +
    "<title>MIVO</title>" +
    `<link>${xml(siteUrl)}</link>` +
    "<description>MIVO automotive parts</description>" +
    items.join("\n") +
    "</channel></rss>";

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
