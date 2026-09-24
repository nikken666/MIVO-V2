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
  const selectedMake = typeof params.make === "string" ? params.make : "";
  const selectedModel = typeof params.model === "string" ? params.model : "";
  const selectedYear = typeof params.year === "string" ? params.year : "";
  const selectedVariant = typeof params.variant === "string" ? params.variant : "";
  const selectedTransmission =
    typeof params.transmission === "string" ? params.transmission : "";
  const selectedVehicleLabel = [
    selectedMake,
    selectedModel,
    selectedYear,
    selectedVariant,
    selectedTransmission,
  ]
    .filter(Boolean)
    .join(" ");

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
      {selectedVehicleLabel ? (
        <div className="selectedVehicleBanner">
          <div>
            <span>SELECTED VEHICLE</span>
            <strong>{selectedVehicleLabel}</strong>
            <small>Vehicle selection is active while MIVO fitment data is being connected to each product.</small>
          </div>
          <a href="/#fitment">CHANGE VEHICLE</a>
        </div>
      ) : null}

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
