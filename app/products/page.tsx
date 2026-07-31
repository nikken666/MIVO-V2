import ProductCard from "@/components/ProductCard";
import { getActiveProducts } from "@/lib/catalog";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.toLowerCase() : "";
  const category =
    typeof params.category === "string" ? params.category.toLowerCase() : "";

  const products = await getActiveProducts();

  const filtered = products.filter(
    (product) =>
      (!q ||
        `${product.name} ${product.brand} ${product.category}`
          .toLowerCase()
          .includes(q)) &&
      (!category || product.category.toLowerCase().includes(category))
  );

  return (
    <main className="container pageShell">
      <div className="pageHeading">
        <div>
          <h1>All Products</h1>
          <p>{filtered.length} products found</p>
        </div>
      </div>

      {filtered.length ? (
        <div className="catalogGrid">
          {filtered.map((product) => (
            <ProductCard product={product} key={product.slug} />
          ))}
        </div>
      ) : (
        <div className="emptyState">
          <span>🔎</span>
          <h2>No matching products</h2>
          <p>Try another keyword or category.</p>
        </div>
      )}
    </main>
  );
}
