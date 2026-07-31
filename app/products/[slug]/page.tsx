import { notFound } from "next/navigation";
import ProductDetailClient from "@/components/ProductDetailClient";
import { getActiveProductBySlug } from "@/lib/catalog";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getActiveProductBySlug(slug);

  if (!product) notFound();

  return <ProductDetailClient product={product} />;
}
