import ProductCard from "@/components/ProductCard";
import { products } from "@/data/products";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.toLowerCase() : "";
  const category = typeof params.category === "string" ? params.category.toLowerCase() : "";
  const filtered = products.filter((p) => (!q || `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(q)) && (!category || p.category.toLowerCase().includes(category)));
  return <main className="container pageShell"><div className="pageHeading"><div><h1>All Products</h1><p>{filtered.length} products found</p></div></div>{filtered.length ? <div className="catalogGrid">{filtered.map((p) => <ProductCard product={p} key={p.slug} />)}</div> : <div className="emptyState"><span>🔎</span><h2>No matching products</h2><p>Try another keyword or category.</p></div>}</main>;
}
