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

const states = [
  "Johor",
  "Kedah",
  "Kelantan",
  "WP Kuala Lumpur",
  "WP Labuan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Penang",
  "Perak",
  "Perlis",
  "Putrajaya",
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
          caught instanceof Error
            ? caught.message
            : "Unable to load your addresses."
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
      setMessage("Address saved to your MIVO account.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to save this address."
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
      setMessage("Default delivery address updated.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to update default address."
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
      setMessage("Address removed.");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to remove this address."
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
            <span>MIVO ACCOUNT</span>
            <h1>Delivery Addresses</h1>
            <p>
              Save your delivery details once and MIVO will fill them in at
              checkout.
            </p>
          </div>

          <Link href="/account">← ACCOUNT</Link>
        </div>

        <div className="addressSettingsLayout">
          <section className="addressBookPanel">
            <div className="addressBookHead">
              <div>
                <span>SAVED ADDRESSES</span>
                <strong>{addresses.length}</strong>
              </div>

              <button type="button" onClick={startNew}>
                + ADD ADDRESS
              </button>
            </div>

            {loading ? (
              <p className="accountDataNotice">Loading addresses...</p>
            ) : addresses.length === 0 ? (
              <div className="addressEmpty">
                <strong>No saved address yet.</strong>
                <p>Add your first delivery address on the right.</p>
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
                        <span>{address.label || "Address"}</span>
                        {address.is_default ? <b>DEFAULT</b> : null}
                      </div>
                      <button type="button" onClick={() => startEdit(address)}>
                        EDIT
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
                          SET AS DEFAULT
                        </button>
                      ) : null}

                      {address.id ? (
                        <button
                          type="button"
                          className="danger"
                          onClick={() => removeAddress(address.id!)}
                          disabled={busy}
                        >
                          DELETE
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
              <span>{editing ? "EDIT ADDRESS" : "NEW ADDRESS"}</span>
              <h2>{editing ? "Update delivery details." : "Add delivery details."}</h2>
            </div>

            <form className="addressEditorForm" onSubmit={submit}>
              <div className="addressFormGrid">
                <label>
                  <span>LABEL</span>
                  <input
                    value={form.label || ""}
                    onChange={(event) =>
                      updateField("label", event.target.value)
                    }
                    placeholder="Home / Office"
                  />
                </label>

                <label>
                  <span>FULL NAME *</span>
                  <input
                    required
                    value={form.full_name}
                    onChange={(event) =>
                      updateField("full_name", event.target.value)
                    }
                    placeholder="Recipient name"
                  />
                </label>

                <label className="full">
                  <span>PHONE NUMBER *</span>
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
                  <span>ADDRESS LINE 1 *</span>
                  <input
                    required
                    value={form.address_line_1}
                    onChange={(event) =>
                      updateField("address_line_1", event.target.value)
                    }
                    placeholder="House / unit number and street"
                  />
                </label>

                <label className="full">
                  <span>ADDRESS LINE 2</span>
                  <input
                    value={form.address_line_2 || ""}
                    onChange={(event) =>
                      updateField("address_line_2", event.target.value)
                    }
                    placeholder="Building, area or landmark"
                  />
                </label>

                <label>
                  <span>POSTCODE *</span>
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
                  <span>CITY *</span>
                  <input
                    required
                    value={form.city}
                    onChange={(event) =>
                      updateField("city", event.target.value)
                    }
                    placeholder="City"
                  />
                </label>

                <label className="full">
                  <span>STATE *</span>
                  <select
                    required
                    value={form.state}
                    onChange={(event) =>
                      updateField("state", event.target.value)
                    }
                  >
                    <option value="" disabled>
                      Choose state
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
                  <strong>Use as default address</strong>
                  <small>Checkout will load this address automatically.</small>
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
                  <small>MIVO ACCOUNT</small>
                  {busy ? "SAVING..." : "SAVE ADDRESS"}
                </span>
                <b>→</b>
              </button>
            </form>
          </section>
        </div>
      </div>
    </main>
  );
}
