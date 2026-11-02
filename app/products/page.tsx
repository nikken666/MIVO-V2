export const dynamic = "force-dynamic";

import ProductCard from "@/components/ProductCard";
import SavedVehicleProductsBootstrap from "@/components/SavedVehicleProductsBootstrap";
import ProductsVehicleBanner from "@/components/ProductsVehicleBanner";
import { createClient } from "@/lib/supabase/server";
import { getActiveProducts } from "@/lib/catalog";
import {
  fitmentRank,
  getProductFitmentStatus,
  shopFitmentStatus,
  type FitmentStatus,
} from "@/data/fitments";
import { getLiveFitmentStatuses } from "@/lib/liveFitment";
import { searchProducts } from "@/lib/search";
import { getT } from "@/lib/i18n/server";
import type { Key, Translate } from "@/lib/i18n";


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

function groupHeading(group: string, t: Translate) {
  if (!(group in groupKeywords)) return "";

  return t(("browse.group." + group) as Key);
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const t = await getT();
  const productsPromise = getActiveProducts();

  const rawQuery = typeof params.q === "string" ? params.q.trim() : "";
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
    { name: "NIKKEN", category: t("browse.brands.nikken.range"), logo: "/brands/nikken-logo.svg", slug: "nikken", intro: "NIKKEN focuses on key automotive replacement components for everyday vehicles.", about: t("browse.brands.nikken.about") },
    { name: "KYB", category: t("browse.brands.kyb.range"), logo: "/brands/kyb-logo.svg", slug: "kyb", intro: "KYB focuses on suspension and ride-control components for passenger vehicles.", about: t("browse.brands.kyb.about") },
    { name: "GSP", category: t("browse.brands.gsp.range"), logo: "/brands/gsp-logo.svg", slug: "gsp", intro: "GSP focuses on drivetrain, steering and chassis replacement components.", about: t("browse.brands.gsp.about") },
  ];


  const inSection = products.filter(
    (product) =>
      (!category || product.category.toLowerCase().includes(category)) &&
      (!group || matchesProductGroup(product.category, group))
  );
  // Word-by-word search across name, brand, SKU/OEM, category, shop and more.
  const search = searchProducts(inSection, rawQuery);
  const baseFiltered = search.items;

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
    fitmentStatus: shopFitmentStatus(
      product,
      product.id && liveFitmentStatuses[product.id]
        ? liveFitmentStatuses[product.id]
        : getProductFitmentStatus(product.slug, selectedVehicle)
    ),
  }));

  const ranked = selectedVehicle
    ? withFitment
        .slice()
        .sort(
          (a, b) =>
            fitmentRank(a.fitmentStatus) - fitmentRank(b.fitmentStatus)
        )
    : withFitment;

  // With a vehicle selected, parts confirmed not to fit are hidden unless
  // the shopper explicitly asks to see everything (?showAll=1).
  const showAll = params.showAll === "1";
  const visible =
    selectedVehicle && !showAll
      ? ranked.filter((item) => item.fitmentStatus !== "not-fit")
      : ranked;
  const hiddenCount = ranked.length - visible.length;

  const fitmentCounts = selectedVehicle
    ? ranked.reduce<Record<FitmentStatus, number>>(
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

  function catalogHref(changes: Record<string, string | null>) {
    const next = new URLSearchParams(queryParams);
    if (typeof params.q === "string" && params.q) next.set("q", params.q);
    if (category) next.set("category", category);
    if (group) next.set("group", group);
    if (showAll) next.set("showAll", "1");

    for (const [key, value] of Object.entries(changes)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }

    return "/products" + (next.toString() ? "?" + next.toString() : "");
  }

  const vehicleName = selectedModel || t("browse.products.vehicleFallback");
  const otherGroups = (Object.keys(groupKeywords) as ProductGroup[]).filter(
    (item) => item !== group
  );

  return (
    <main className="container pageShell">
      <SavedVehicleProductsBootstrap
        hasVehicle={Boolean(selectedVehicleId)}
      />
      {view !== "brands" && selectedVehicleLabel ? (
        <ProductsVehicleBanner label={selectedVehicleLabel} />
      ) : null}

      {view !== "brands" && fitmentCounts ? (
        <div className="fitmentResultsBar">
          <div>
            <strong>{fitmentCounts.fits + fitmentCounts.universal}</strong>
            <span>{t("browse.products.confirmedFits")}</span>
          </div>
          <div>
            <strong>{fitmentCounts.unverified}</strong>
            <span>{t("browse.products.notVerified")}</span>
          </div>
          {fitmentCounts["not-fit"] > 0 ? (
            <a
              href={catalogHref({ showAll: showAll ? null : "1" })}
              className="fitmentResultsToggle"
            >
              <strong>{fitmentCounts["not-fit"]}</strong>
              <span>
                {t("browse.products.notForYou", {
                  action: showAll ? t("browse.products.hide") : t("browse.products.show"),
                })}
              </span>
            </a>
          ) : null}
        </div>
      ) : null}

      {view === "brands" ? (
        <>
          <section className="brandsHero">
            <span>{t("browse.brands.kicker")}</span>
            <h1>{t("browse.brands.title")}</h1>
            <p>{t("browse.brands.intro")}</p>
          </section>
          <div className="brandDirectory">
            {representedBrands.map((brand) => (
              <details id={brand.slug} className="brandDirectoryCard brandExpandableCard" key={brand.name}>
                <summary>
                  <span className="brandLogo" aria-label={brand.name}>
                    <img src={brand.logo} alt={t("browse.brands.logo", { brand: brand.name })} />
                  </span>
                </summary>
                <div className="brandInlineDetails">
                  <span>{t("browse.brands.about", { brand: brand.name })}</span>
                  <h2>{t("browse.brands.what", { brand: brand.name })}</h2>
                  <p>{brand.about}</p>
                  <strong>{brand.category}</strong>
                  <a href={"/products?q=" + encodeURIComponent(brand.name)}>{t("browse.brands.explore", { brand: brand.name })}</a>
                </div>
              </details>
            ))}
          </div>
        </>
      ) : (
      <div className="pageHeading">
        <div>
          <h1>
            {rawQuery
              ? t("browse.products.resultsFor", { q: rawQuery })
              : group
              ? groupHeading(group, t)
              : selectedVehicle
                ? t("browse.products.forVehicle")
                : t("browse.products.allProducts")}
          </h1>
          <p>
            {rawQuery && !search.exact && visible.length
              ? t("browse.products.closeMatches", { n: visible.length })
              : hiddenCount
              ? t("browse.products.partsForYour", { n: visible.length, car: vehicleName })
              : t("browse.products.shown", { n: visible.length })}
          </p>
        </div>
      </div>
      )}

      {view === "brands" ? null : (
        <>
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
          ) : null}

          {hiddenCount || !visible.length ? (
            <section className="fitmentMorePanel">
              <div className="fitmentMoreCopy">
                <span>{hiddenCount ? t("browse.products.onlyFit") : t("browse.products.moreComing")}</span>
                <h2>
                  {!hiddenCount && rawQuery
                    ? t("browse.products.noMatchQuery", { q: rawQuery })
                    : !hiddenCount
                    ? t("browse.products.noGroup", {
                        what: group
                          ? groupHeading(group, t).toLowerCase()
                          : t("browse.products.matchingParts"),
                      })
                    : visible.length
                      ? t("browse.products.otherDontFit", { n: hiddenCount, car: vehicleName })
                      : t("browse.products.nothingFits", { car: vehicleName })}
                </h2>
                <p>
                  {hiddenCount
                    ? t("browse.products.hiddenNote")
                    : t("browse.products.addingNote")}
                </p>
              </div>

              <div className="fitmentMoreGroups">
                {otherGroups.map((item) => (
                  <a key={item} href={catalogHref({ group: item, q: null, category: null, showAll: null })}>
                    {t(("nav." + item) as Key)}
                    <span aria-hidden="true">→</span>
                  </a>
                ))}
              </div>

              <div className="fitmentMoreActions">
                {hiddenCount ? (
                  <a href={catalogHref({ showAll: "1" })} className="fitmentMoreGhost">
                    {t("browse.products.showAllN", { n: ranked.length })}
                  </a>
                ) : (
                  <a
                    href={catalogHref({ group: null, q: null, category: null })}
                    className="fitmentMoreGhost"
                  >
                    {t("browse.products.browseAll")}
                  </a>
                )}
                {selectedVehicle ? (
                  <a href="/?addVehicle=1#fitment" className="fitmentMoreGhost">
                    {t("browse.changeVehicle")}
                  </a>
                ) : null}
              </div>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
