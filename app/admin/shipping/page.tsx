"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";

type ShippingRule = {
  id: string;
  zone_code: string;
  zone_name: string;
  courier_code: string;
  courier_name: string;
  handling_markup: number | string;
  origin_postcode: string | null;
  rate_source: string | null;
  states: string[];
  base_fee: number | string;
  base_weight_kg: number | string;
  additional_step_kg: number | string;
  additional_kg_fee: number | string;
  volumetric_divisor: number | string;
  minimum_chargeable_weight_kg: number | string;
  bulky_threshold_kg: number | string | null;
  bulky_surcharge: number | string;
  free_shipping_threshold: number | string | null;
  max_shipping_fee: number | string | null;
  is_active: boolean;
  sort_order: number;
};

type ShippingTier = {
  courier_code: string;
  zone_code: string;
  max_weight_kg: number | string;
  courier_fee: number | string;
};

function valueOf(value: number | string | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export default function AdminShippingPage() {
  const [rules, setRules] = useState<ShippingRule[]>([]);
  const [tiers, setTiers] = useState<ShippingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          window.location.href = "/login?next=/admin/shipping";
          return;
        }

        const { data: isAdmin, error: adminError } =
          await supabase.rpc("is_admin");

        if (adminError) throw adminError;
        if (!isAdmin) {
          window.location.href = "/";
          return;
        }

        const [
          { data, error: rulesError },
          { data: tierData, error: tierError },
        ] = await Promise.all([
          supabase
            .from("shipping_rules")
            .select(
              "id, zone_code, zone_name, courier_code, courier_name, handling_markup, origin_postcode, rate_source, states, base_fee, base_weight_kg, additional_step_kg, additional_kg_fee, volumetric_divisor, minimum_chargeable_weight_kg, bulky_threshold_kg, bulky_surcharge, free_shipping_threshold, max_shipping_fee, is_active, sort_order"
            )
            .order("sort_order"),
          supabase
            .from("shipping_rate_tiers")
            .select("courier_code, zone_code, max_weight_kg, courier_fee")
            .order("max_weight_kg"),
        ]);

        if (rulesError || tierError) throw rulesError || tierError;
        setRules((data as ShippingRule[] | null) || []);
        setTiers((tierData as ShippingTier[] | null) || []);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load shipping rules."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  function updateRule(
    id: string,
    field: keyof ShippingRule,
    value: string | boolean
  ) {
    setRules((current) =>
      current.map((rule) =>
        rule.id === id
          ? ({ ...rule, [field]: value } as ShippingRule)
          : rule
      )
    );
  }

  async function saveRule(rule: ShippingRule) {
    setSaving(rule.id);
    setError("");
    setMessage("");

    try {
      const supabase = createClient();

      const number = (
        value: string | number | null,
        fallback: number
      ) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
      };

      const nullableNumber = (
        value: string | number | null
      ) => {
        if (value === null || value === "") return null;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      };

      const payload = {
        base_fee: number(rule.base_fee, 0),
        base_weight_kg: number(rule.base_weight_kg, 1),
        additional_step_kg: number(rule.additional_step_kg, 1),
        additional_kg_fee: number(rule.additional_kg_fee, 0),
        volumetric_divisor: number(rule.volumetric_divisor, 5000),
        minimum_chargeable_weight_kg: number(
          rule.minimum_chargeable_weight_kg,
          0.5
        ),
        bulky_threshold_kg: nullableNumber(rule.bulky_threshold_kg),
        bulky_surcharge: number(rule.bulky_surcharge, 0),
        free_shipping_threshold: nullableNumber(
          rule.free_shipping_threshold
        ),
        max_shipping_fee: nullableNumber(rule.max_shipping_fee),
        handling_markup: number(rule.handling_markup, 2),
        is_active: rule.is_active,
        updated_at: new Date().toISOString(),
      };

      const { error: updateError } = await supabase
        .from("shipping_rules")
        .update(payload)
        .eq("id", rule.id);

      if (updateError) throw updateError;

      setMessage(rule.zone_name + " shipping rule saved.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save shipping rule."
      );
    } finally {
      setSaving("");
    }
  }

  return (
    <main className={styles.adminShell}>
      <div className={styles.adminWorkspace}>
        <aside className={styles.adminSidebar}>
          <a href="/admin" className={styles.adminBrand}>
            <span>MIVO</span>
            <small>STORE CONTROL</small>
          </a>

          <nav className={styles.adminSideNav}>
            <a href="/admin"><span>01</span>Dashboard</a>
            <a href="/admin/orders"><span>02</span>Orders</a>
            <a href="/admin/products"><span>03</span>Products</a>
            <a href="/admin/products/new"><span>04</span>Add Product</a>
            <a href="/admin/shipping" className={styles.active}>
              <span>05</span>Shipping
            </a>
          </nav>

          <div className={styles.adminSidebarFoot}>
            <span>DELIVERY</span>
            <strong>
              {rules.filter((rule) => rule.is_active).length} ACTIVE ZONES
            </strong>
            <a href="/">OPEN STOREFRONT ↗</a>
          </div>
        </aside>

        <section className={styles.adminContent}>
          <header className={styles.adminHeader}>
            <div>
              <span className={styles.adminEyebrow}>
                MIVO STORE CONTROL · SHIPPING
              </span>
              <h1>Shipping Rules</h1>
              <p>
                Configure Malaysia delivery charges by zone, weight and parcel
                dimensions.
              </p>
            </div>
          </header>

          <section className={styles.shippingFormulaCard}>
            <span>HOW MIVO CALCULATES SHIPPING</span>
            <strong>
              Tiered courier rate card + RM2 MIVO markup.
            </strong>
            <p>
              Origin postcode: 52200. MIVO first calculates chargeable weight
              using the higher of actual or volumetric weight, then looks up
              the matching SPX / J&T weight tier. Customer shipping = courier
              rate + MIVO markup.
            </p>
          </section>

          {message ? <p className={styles.adminSuccess}>{message}</p> : null}
          {error ? <p className={styles.adminError}>{error}</p> : null}

          {loading ? (
            <p className={styles.adminNotice}>Loading shipping rules...</p>
          ) : (
            <div className={styles.shippingRuleGrid}>
              {rules.map((rule) => (
                <section className={styles.shippingRuleCard} key={rule.id}>
                  <div className={styles.shippingRuleHead}>
                    <div>
                      <span>
                        {rule.courier_name.toUpperCase()} · {rule.zone_code.toUpperCase()}
                      </span>
                      <h2>{rule.zone_name}</h2>
                      <p>{rule.states.join(" · ")}</p>
                    </div>

                    <label className={styles.shippingActiveToggle}>
                      <input
                        type="checkbox"
                        checked={rule.is_active}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "is_active",
                            event.target.checked
                          )
                        }
                      />
                      <span>{rule.is_active ? "ACTIVE" : "INACTIVE"}</span>
                    </label>
                  </div>

                  <div className={styles.shippingRatePreview}>
                    <span>RATE CARD · ORIGIN {rule.origin_postcode || "—"}</span>
                    <small>{rule.rate_source || "Configured courier rate"}</small>
                    <div>
                      {[1, 3, 5, 10, 15].map((weight) => {
                        const rows = tiers.filter(
                          (tier) =>
                            tier.courier_code === rule.courier_code &&
                            tier.zone_code === rule.zone_code
                        );
                        const tier = rows.find(
                          (item) => Number(item.max_weight_kg) >= weight
                        );
                        if (!tier) return null;
                        const courierFee = Number(tier.courier_fee);
                        return (
                          <b key={weight}>
                            {weight}KG
                            <em>
                              RM {(courierFee + Number(rule.handling_markup || 0)).toFixed(2)}
                            </em>
                            <i>courier RM {courierFee.toFixed(2)}</i>
                          </b>
                        );
                      })}
                    </div>
                  </div>

                  <div className={styles.shippingRuleFields}>

                    <label className={styles.adminField}>
                      <span>VOLUMETRIC DIVISOR</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={valueOf(rule.volumetric_divisor)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "volumetric_divisor",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>MINIMUM CHARGEABLE KG</span>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        value={valueOf(rule.minimum_chargeable_weight_kg)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "minimum_chargeable_weight_kg",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>MIVO MARKUP (RM)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valueOf(rule.handling_markup)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "handling_markup",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>BULKY ABOVE (KG)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.001"
                        placeholder="Optional"
                        value={valueOf(rule.bulky_threshold_kg)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "bulky_threshold_kg",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>BULKY SURCHARGE (RM)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valueOf(rule.bulky_surcharge)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "bulky_surcharge",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>FREE SHIPPING ABOVE (RM)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Optional"
                        value={valueOf(rule.free_shipping_threshold)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "free_shipping_threshold",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>MAX SHIPPING FEE (RM)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Optional"
                        value={valueOf(rule.max_shipping_fee)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "max_shipping_fee",
                            event.target.value
                          )
                        }
                      />
                    </label>
                  </div>

                  <div className={styles.shippingRuleFooter}>
                    <small>
                      Customer charge = courier rate + RM {Number(rule.handling_markup || 0).toFixed(2)}. Rate card is already loaded for origin {rule.origin_postcode || "52200"}.
                    </small>
                    <button
                      type="button"
                      className={styles.adminAction}
                      disabled={saving === rule.id}
                      onClick={() => saveRule(rule)}
                    >
                      {saving === rule.id ? "SAVING..." : "SAVE RULE"}
                    </button>
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
