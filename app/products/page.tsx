export const dynamic = "force-dynamic";

import ProductCard from "@/components/ProductCard";
import SavedVehicleProductsBootstrap from "@/components/SavedVehicleProductsBootstrap";
import { createClient } from "@/lib/supabase/server";
import { getActiveProducts } from "@/lib/catalog";
import {
  fitmentRank,
  getProductFitmentStatus,
  type FitmentStatus,
} from "@/data/fitments";
import { getLiveFitmentStatuses } from "@/lib/liveFitment";


type ProductGroup =
  | "maintenance"
  | "braking"
  | "suspension"
  | "steering"
  | "drivetrain"
  | "cooling";

const groupKeywords: Record<ProductGroup, string[]> = {
  maintenance: [
    "maintenance",
    "engine oil",
    "oil filter",
    "filter",
    "lubricant",
    "additive",
    "spark plug",
    "wiper",
  ],
  braking: ["brake", "braking"],
  suspension: [
    "suspension",
    "shock absorber",
    "spring",
    "sway bar",
    "stabilizer",
    "ball joint",
    "bush",
  ],
  steering: ["steering", "tie rod", "hydraulic"],
  drivetrain: [
    "drive shaft",
    "transmission",
    "clutch",
    "half-axle",
    "tripod",
    "wheel hub",
    "bearing",
  ],
  cooling: [
    "cooling",
    "radiator",
    "thermatic fan",
    "engine hose",
    "water pump",
  ],
};

function matchesProductGroup(category: string, group: string) {
  if (!(group in groupKeywords)) return true;

  const value = category.toLowerCase();

  return groupKeywords[group as ProductGroup].some((keyword) =>
    value.includes(keyword)
  );
}

function groupHeading(group: string) {
  if (!(group in groupKeywords)) return "";

  return (
    group.charAt(0).toUpperCase() +
    group.slice(1) +
    " Parts"
  );
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const productsPromise = getActiveProducts();

  const q = typeof params.q === "string" ? params.q.toLowerCase() : "";
  const category =
    typeof params.category === "string" ? params.category.toLowerCase() : "";
  const group =
    typeof params.group === "string" ? params.group.toLowerCase() : "";
  const view = typeof params.view === "string" ? params.view.toLowerCase() : "";

  let selectedVehicleId =
    typeof params.vehicle === "string" ? params.vehicle : "";
  let selectedMake = typeof params.make === "string" ? params.make : "";
  let selectedModel = typeof params.model === "string" ? params.model : "";
  let selectedGeneration =
    typeof params.generation === "string" ? params.generation : "";
  let selectedYear = typeof params.year === "string" ? params.year : "";
  let selectedVariant =
    typeof params.variant === "string" ? params.variant : "";
  let selectedTransmission =
    typeof params.transmission === "string" ? params.transmission : "";

  if (!selectedVehicleId) {
    try {
      const supabase = await createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: savedVehicle } = await supabase
          .from("customer_vehicles")
          .select(
            "vehicle_key, make, model, generation, year, variant, transmission"
          )
          .eq("user_id", user.id)
          .eq("is_default", true)
          .maybeSingle();

        if (savedVehicle?.vehicle_key) {
          selectedVehicleId = savedVehicle.vehicle_key;
          selectedMake = savedVehicle.make || "";
          selectedModel = savedVehicle.model || "";
          selectedGeneration = savedVehicle.generation || "";
          selectedYear = savedVehicle.year || "";
          selectedVariant = savedVehicle.variant || "";
          selectedTransmission = savedVehicle.transmission || "";
        }
      }
    } catch {}
  }

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

  const products = await productsPromise;
  const representedBrands = [
    { name: "NIKKEN", category: "Automotive replacement parts", logo: "/brands/nikken-logo.svg" },
    { name: "KYB", category: "Suspension & shock absorbers", logo: "/brands/kyb-logo.svg" },
    { name: "GSP", category: "Drivetrain & drive shafts", logo: "/brands/gsp-logo.svg" },
  ];

  const baseFiltered = products.filter(
    (product) =>
      (!q ||
        (product.name + " " + product.brand + " " + product.category)
          .toLowerCase()
          .includes(q)) &&
      (!category || product.category.toLowerCase().includes(category)) &&
      (!group || matchesProductGroup(product.category, group))
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
      <SavedVehicleProductsBootstrap
        hasVehicle={Boolean(selectedVehicleId)}
      />
      {view !== "brands" && selectedVehicleLabel ? (
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

      {view !== "brands" && fitmentCounts ? (
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

      {view === "brands" ? (
        <>
          <section className="brandsHero">
            <span>MIVO BRAND PORTFOLIO</span>
            <h1>Our Brands</h1>
            <p>
              Automotive brands represented across the MIVO catalogue.
              Select a brand to browse its available products.
            </p>
          </section>
          <div className="brandDirectory">
            {representedBrands.map((brand) => (
              <a
                href={"/products?q=" + encodeURIComponent(brand.name)}
                className="brandDirectoryCard"
                key={brand.name}
              >
                <span className="brandLogo" aria-label={brand.name}>
                  <img src={brand.logo} alt={brand.name + " logo"} />
                </span>
              </a>
            ))}
          </div>
        </>
      ) : (
      <div className="pageHeading">
        <div>
          <h1>
            {group
              ? groupHeading(group)
              : selectedVehicle
                ? "Parts for your vehicle"
                : "All Products"}
          </h1>
          <p>{visible.length} products shown</p>
        </div>
      </div>
      )}

      {view === "brands" ? null : visible.length ? (
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
