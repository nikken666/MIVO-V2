import ProductCard from "@/components/ProductCard";
import { getActiveProducts } from "@/lib/catalog";
import {
  fitmentRank,
  getProductFitmentStatus,
  type FitmentStatus,
} from "@/data/fitments";
import { getLiveFitmentStatuses } from "@/lib/liveFitment";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const q = typeof params.q === "string" ? params.q.toLowerCase() : "";
  const category =
    typeof params.category === "string" ? params.category.toLowerCase() : "";

  const selectedVehicleId =
    typeof params.vehicle === "string" ? params.vehicle : "";
  const selectedMake = typeof params.make === "string" ? params.make : "";
  const selectedModel = typeof params.model === "string" ? params.model : "";
  const selectedGeneration =
    typeof params.generation === "string" ? params.generation : "";
  const selectedYear = typeof params.year === "string" ? params.year : "";
  const selectedVariant =
    typeof params.variant === "string" ? params.variant : "";
  const selectedTransmission =
    typeof params.transmission === "string" ? params.transmission : "";

  const selectedVehicleLabel = [
    selectedMake,
    selectedModel,
    selectedGeneration,
    selectedYear,
    selectedVariant,
    selectedTransmission,
  ]
    .filter(Boolean)
    .join(" ");

  const selectedVehicle = selectedVehicleId
    ? {
        vehicleId: selectedVehicleId,
        year: selectedYear,
        variant: selectedVariant,
        transmission: selectedTransmission,
      }
    : null;

  const products = await getActiveProducts();

  const baseFiltered = products.filter(
    (product) =>
      (!q ||
        (product.name + " " + product.brand + " " + product.category)
          .toLowerCase()
          .includes(q)) &&
      (!category || product.category.toLowerCase().includes(category))
  );

  const liveFitmentStatuses = selectedVehicle
    ? await getLiveFitmentStatuses(
        baseFiltered
          .map((product) => product.id)
          .filter((id): id is string => Boolean(id)),
        selectedVehicle
      )
    : {};

  const withFitment = baseFiltered.map((product) => ({
    product,
    fitmentStatus:
      product.id && liveFitmentStatuses[product.id]
        ? liveFitmentStatuses[product.id]
        : getProductFitmentStatus(product.slug, selectedVehicle),
  }));

  const visible = selectedVehicle
    ? withFitment
        .filter((item) => item.fitmentStatus !== "not-fit")
        .sort((a, b) => fitmentRank(a.fitmentStatus) - fitmentRank(b.fitmentStatus))
    : withFitment;

  const fitmentCounts = selectedVehicle
    ? visible.reduce<Record<FitmentStatus, number>>(
        (counts, item) => {
          counts[item.fitmentStatus] += 1;
          return counts;
        },
        { fits: 0, universal: 0, unverified: 0, "not-fit": 0 }
      )
    : null;

  const queryParams = new URLSearchParams();
  if (selectedVehicleId) queryParams.set("vehicle", selectedVehicleId);
  if (selectedMake) queryParams.set("make", selectedMake);
  if (selectedModel) queryParams.set("model", selectedModel);
  if (selectedGeneration) queryParams.set("generation", selectedGeneration);
  if (selectedYear) queryParams.set("year", selectedYear);
  if (selectedVariant) queryParams.set("variant", selectedVariant);
  if (selectedTransmission) queryParams.set("transmission", selectedTransmission);
  const hrefSuffix = queryParams.toString() ? "?" + queryParams.toString() : "";

  return (
    <main className="container pageShell">
      {selectedVehicleLabel ? (
        <div className="selectedVehicleBanner vehicleMatchBanner">
          <div>
            <span>YOUR MIVO VEHICLE</span>
            <strong>{selectedVehicleLabel}</strong>
            <small>
              Confirmed matches are shown first. Products without verified fitment
              data remain clearly marked instead of being guessed.
            </small>
          </div>
          <a href="/#fitment">CHANGE VEHICLE</a>
        </div>
      ) : null}

      {fitmentCounts ? (
        <div className="fitmentResultsBar">
          <div>
            <strong>{fitmentCounts.fits}</strong>
            <span>CONFIRMED FITS</span>
          </div>
          <div>
            <strong>{fitmentCounts.universal}</strong>
            <span>UNIVERSAL</span>
          </div>
          <div>
            <strong>{fitmentCounts.unverified}</strong>
            <span>AWAITING FITMENT DATA</span>
          </div>
        </div>
      ) : null}

      <div className="pageHeading">
        <div>
          <h1>{selectedVehicle ? "Parts for your vehicle" : "All Products"}</h1>
          <p>{visible.length} products shown</p>
        </div>
      </div>

      {visible.length ? (
        <div className="catalogGrid">
          {visible.map(({ product, fitmentStatus }) => (
            <ProductCard
              product={product}
              fitmentStatus={selectedVehicle ? fitmentStatus : undefined}
              hrefSuffix={hrefSuffix}
              key={product.slug}
            />
          ))}
        </div>
      ) : (
        <div className="emptyState">
          <span>🔎</span>
          <h2>No matching products yet</h2>
          <p>
            We do not have a verified compatible product for this vehicle in the
            current catalogue.
          </p>
        </div>
      )}
    </main>
  );
}
