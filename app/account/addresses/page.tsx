"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  deleteAccountAddress,
  loadAccountAddresses,
  saveAccountAddress,
  setDefaultAccountAddress,
  type AccountAddress,
} from "@/lib/customerData";
import { useT } from "@/components/LanguageProvider";
import { friendlyError } from "@/lib/i18n/errors";

const states = [
  "Johor",
  "Kedah",
  "Kelantan",
  "W.P. Kuala Lumpur",
  "W.P. Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "W.P. Putrajaya",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
];

const emptyAddress: AccountAddress = {
  label: "Home",
  full_name: "",
  phone: "",
  address_line_1: "",
  address_line_2: "",
  city: "",
  state: "",
  postcode: "",
  country_code: "MY",
  is_default: false,
};

export default function AddressSettingsPage() {
  const t = useT();
  const [addresses, setAddresses] = useState<AccountAddress[]>([]);
  const [editing, setEditing] = useState<AccountAddress | null>(null);
  const [form, setForm] = useState<AccountAddress>(emptyAddress);
  const [makeDefault, setMakeDefault] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refreshAddresses() {
    const data = await loadAccountAddresses();
    setAddresses(data);
    return data;
  }

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login?next=/account/addresses";
        return;
      }

      try {
        const data = await loadAccountAddresses();
        if (!active) return;
        setAddresses(data);
        if (data.length === 0) setMakeDefault(true);
      } catch (caught) {
        if (!active) return;
        setError(
          friendlyError(caught, t, "account.addresses.loadError")
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  function startNew() {
    setEditing(null);
    setForm(emptyAddress);
    setMakeDefault(addresses.length === 0);
    setError("");
    setMessage("");
  }

  function startEdit(address: AccountAddress) {
    setEditing(address);
    setForm({
      ...address,
      address_line_2: address.address_line_2 || "",
    });
    setMakeDefault(Boolean(address.is_default));
    setError("");
    setMessage("");
  }

  function updateField(field: keyof AccountAddress, value: string) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const saved = await saveAccountAddress(
        {
          ...form,
          id: editing?.id,
        },
        makeDefault || addresses.length === 0
      );

      await refreshAddresses();
      setEditing(saved);
      if (saved) setForm(saved);
      setMakeDefault(Boolean(saved?.is_default));
      setMessage(t("account.addresses.saved"));
    } catch (caught) {
      setError(
        friendlyError(caught, t, "account.addresses.saveError")
      );
    } finally {
      setBusy(false);
    }
  }

  async function makeAddressDefault(id: string) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await setDefaultAccountAddress(id);
      await refreshAddresses();
      setMessage(t("account.addresses.defaultUpdated"));
    } catch (caught) {
      setError(
        friendlyError(caught, t, "account.addresses.defaultError")
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeAddress(id: string) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await deleteAccountAddress(id);
      const remaining = await refreshAddresses();

      if (editing?.id === id) {
        setEditing(null);
        setForm(emptyAddress);
      }

      if (remaining.length === 0) setMakeDefault(true);
      setMessage(t("account.addresses.removed"));
    } catch (caught) {
      setError(
        friendlyError(caught, t, "account.addresses.removeError")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="accountDataPage">
      <div className="container">
        <div className="accountDataHeader">
          <div>
            <span>{t("account.common.mivoAccount")}</span>
            <h1>{t("account.addresses.title")}</h1>
            <p>
              {t("account.addresses.subtitle")}
            </p>
          </div>

          <Link href="/account">← {t("account.common.backAccount")}</Link>
        </div>

        <div className="addressSettingsLayout">
          <section className="addressBookPanel">
            <div className="addressBookHead">
              <div>
                <span>{t("account.addresses.savedAddresses")}</span>
                <strong>{addresses.length}</strong>
              </div>

              <button type="button" onClick={startNew}>
                + {t("account.addresses.add")}
              </button>
            </div>

            {loading ? (
              <p className="accountDataNotice">{t("account.addresses.loading")}</p>
            ) : addresses.length === 0 ? (
              <div className="addressEmpty">
                <strong>{t("account.addresses.emptyTitle")}</strong>
                <p>{t("account.addresses.emptyText")}</p>
              </div>
            ) : (
              <div className="addressCardList">
                {addresses.map((address) => (
                  <article
                    className={
                      "addressCard" +
                      (address.is_default ? " addressCardDefault" : "")
                    }
                    key={address.id}
                  >
                    <div className="addressCardTop">
                      <div>
                        <span>{address.label || t("account.addresses.address")}</span>
                        {address.is_default ? <b>{t("account.addresses.default")}</b> : null}
                      </div>
                      <button type="button" onClick={() => startEdit(address)}>
                        {t("account.addresses.edit")}
                      </button>
                    </div>

                    <strong>{address.full_name}</strong>
                    <p>
                      {address.phone}
                      <br />
                      {address.address_line_1}
                      {address.address_line_2
                        ? ", " + address.address_line_2
                        : ""}
                      <br />
                      {address.postcode} {address.city}, {address.state}
                    </p>

                    <div className="addressCardActions">
                      {!address.is_default && address.id ? (
                        <button
                          type="button"
                          onClick={() => makeAddressDefault(address.id!)}
                          disabled={busy}
                        >
                          {t("account.addresses.setDefault")}
                        </button>
                      ) : null}

                      {address.id ? (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => removeAddress(address.id!)}
                          disabled={busy}
                        >
                          {t("account.addresses.delete")}
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="addressEditorPanel">
            <div className="addressEditorHead">
              <span>{editing ? t("account.addresses.editAddress") : t("account.addresses.newAddress")}</span>
              <h2>{editing ? t("account.addresses.updateDetails") : t("account.addresses.addDetails")}</h2>
            </div>

            <form className="addressEditorForm" onSubmit={submit}>
              <div className="addressFormGrid">
                <label>
                  <span>{t("account.addresses.label")}</span>
                  <input
                    value={form.label || ""}
                    onChange={(event) =>
                      updateField("label", event.target.value)
                    }
                    placeholder={t("account.addresses.labelPlaceholder")}
                  />
                </label>

                <label>
                  <span>{t("account.login.fullName")} *</span>
                  <input
                    required
                    value={form.full_name}
                    onChange={(event) =>
                      updateField("full_name", event.target.value)
                    }
                    placeholder={t("account.addresses.recipientPlaceholder")}
                  />
                </label>

                <label className="full">
                  <span>{t("account.addresses.phone")} *</span>
                  <input
                    required
                    value={form.phone}
                    onChange={(event) =>
                      updateField("phone", event.target.value)
                    }
                    placeholder="01X-XXXXXXX"
                  />
                </label>

                <label className="full">
                  <span>{t("account.addresses.line1")} *</span>
                  <input
                    required
                    value={form.address_line_1}
                    onChange={(event) =>
                      updateField("address_line_1", event.target.value)
                    }
                    placeholder={t("account.addresses.line1Placeholder")}
                  />
                </label>

                <label className="full">
                  <span>{t("account.addresses.line2")}</span>
                  <input
                    value={form.address_line_2 || ""}
                    onChange={(event) =>
                      updateField("address_line_2", event.target.value)
                    }
                    placeholder={t("account.addresses.line2Placeholder")}
                  />
                </label>

                <label>
                  <span>{t("account.addresses.postcode")} *</span>
                  <input
                    required
                    value={form.postcode}
                    onChange={(event) =>
                      updateField("postcode", event.target.value)
                    }
                    placeholder="75000"
                  />
                </label>

                <label>
                  <span>{t("account.addresses.city")} *</span>
                  <input
                    required
                    value={form.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                    placeholder={t("account.addresses.city")}
                  />
                </label>

                <label className="full">
                  <span>{t("account.addresses.state")} *</span>
                  <select
                    required
                    value={form.state}
                    onChange={(event) =>
                      updateField("state", event.target.value)
                    }
                  >
                    <option value="" disabled>
                      {t("account.addresses.chooseState")}
                    </option>
                    {states.map((state) => (
                      <option key={state}>{state}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="addressDefaultToggle">
                <input
                  type="checkbox"
                  checked={makeDefault}
                  onChange={(event) => setMakeDefault(event.target.checked)}
                />
                <span>
                  <strong>{t("account.addresses.useDefault")}</strong>
                  <small>{t("account.addresses.useDefaultHint")}</small>
                </span>
              </label>

              {message ? (
                <p className="accountDataSuccess">{message}</p>
              ) : null}
              {error ? <p className="accountDataError">{error}</p> : null}

              <button
                type="submit"
                className="addressSaveButton"
                disabled={busy}
              >
                <span>
                  <small>{t("account.common.mivoAccount")}</small>
                  {busy ? t("account.review.saving") : t("account.addresses.save")}

                </span>
                <b></b>
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
