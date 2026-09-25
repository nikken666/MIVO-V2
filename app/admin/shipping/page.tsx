"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "../Admin.module.css";

type ShippingRule = {
  id: string;
  zone_code: string;
  zone_name: string;
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

function valueOf(value: number | string | null | undefined) {
  return value === null || value === undefined ? "" : String(value);
}

export default function AdminShippingPage() {
  const [rules, setRules] = useState<ShippingRule[]>([]);
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

        const { data, error: rulesError } = await supabase
          .from("shipping_rules")
          .select(
            "id, zone_code, zone_name, states, base_fee, base_weight_kg, additional_step_kg, additional_kg_fee, volumetric_divisor, minimum_chargeable_weight_kg, bulky_threshold_kg, bulky_surcharge, free_shipping_threshold, max_shipping_fee, is_active, sort_order"
          )
          .order("sort_order");

        if (rulesError) throw rulesError;
        setRules((data as ShippingRule[] | null) || []);
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
        rule.id === id ? { ...rule, [field]: value } : rule
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
              Chargeable weight = higher of actual weight or volumetric weight.
            </strong>
            <p>
              Volumetric weight uses L × W × H ÷ divisor. The base fee covers
              the base weight, then each additional weight step adds the
              configured fee. Bulky surcharge, free-shipping threshold and a
              maximum fee are optional.
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
                      <span>{rule.zone_code.toUpperCase()}</span>
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

                  <div className={styles.shippingRuleFields}>
                    <label className={styles.adminField}>
                      <span>BASE FEE (RM)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valueOf(rule.base_fee)}
                        onChange={(event) =>
                          updateRule(rule.id, "base_fee", event.target.value)
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>BASE WEIGHT (KG)</span>
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={valueOf(rule.base_weight_kg)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "base_weight_kg",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>ADDITIONAL STEP (KG)</span>
                      <input
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={valueOf(rule.additional_step_kg)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "additional_step_kg",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className={styles.adminField}>
                      <span>ADDITIONAL FEE / STEP (RM)</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={valueOf(rule.additional_kg_fee)}
                        onChange={(event) =>
                          updateRule(
                            rule.id,
                            "additional_kg_fee",
                            event.target.value
                          )
                        }
                      />
                    </label>

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
                      Activate only after the prices for this zone are ready.
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
