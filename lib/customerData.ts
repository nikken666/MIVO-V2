"use client";

import { createClient } from "@/lib/supabase/client";

export type AccountVehicle = {
  id?: string;
  make: string;
  vehicleId: string;
  model: string;
  generation?: string;
  year: string;
  variant: string;
  transmission?: string;
  label: string;
};

export type AccountAddress = {
  id?: string;
  label?: string;
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  state: string;
  postcode: string;
  country_code?: string;
  is_default?: boolean;
};

export async function loadAccountVehicle(): Promise<AccountVehicle | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("customer_vehicles")
    .select(
      "id, vehicle_key, make, model, generation, year, variant, transmission, label"
    )
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    make: data.make,
    vehicleId: data.vehicle_key,
    model: data.model,
    generation: data.generation || undefined,
    year: data.year,
    variant: data.variant,
    transmission: data.transmission || undefined,
    label: data.label,
  };
}

export async function saveAccountVehicle(
  vehicle: AccountVehicle
): Promise<AccountVehicle | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const transmission = vehicle.transmission || "";

  const { data: existing, error: existingError } = await supabase
    .from("customer_vehicles")
    .select("id")
    .eq("user_id", user.id)
    .eq("vehicle_key", vehicle.vehicleId)
    .eq("year", vehicle.year)
    .eq("variant", vehicle.variant)
    .eq("transmission", transmission)
    .maybeSingle();

  if (existingError) throw existingError;

  const now = new Date().toISOString();

  let clearDefaults = supabase
    .from("customer_vehicles")
    .update({ is_default: false, updated_at: now })
    .eq("user_id", user.id)
    .eq("is_default", true);

  if (existing?.id) {
    clearDefaults = clearDefaults.neq("id", existing.id);
  }

  const { error: clearError } = await clearDefaults;
  if (clearError) throw clearError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("customer_vehicles")
      .update({
        make: vehicle.make,
        model: vehicle.model,
        generation: vehicle.generation || null,
        transmission,
        label: vehicle.label,
        is_default: true,
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(
        "id, vehicle_key, make, model, generation, year, variant, transmission, label"
      )
      .single();

    if (error) throw error;

    return {
      id: data.id,
      make: data.make,
      vehicleId: data.vehicle_key,
      model: data.model,
      generation: data.generation || undefined,
      year: data.year,
      variant: data.variant,
      transmission: data.transmission || undefined,
      label: data.label,
    };
  }

  const { data, error } = await supabase
    .from("customer_vehicles")
    .insert({
      user_id: user.id,
      vehicle_key: vehicle.vehicleId,
      make: vehicle.make,
      model: vehicle.model,
      generation: vehicle.generation || null,
      year: vehicle.year,
      variant: vehicle.variant,
      transmission,
      label: vehicle.label,
      is_default: true,
      updated_at: now,
    })
    .select(
      "id, vehicle_key, make, model, generation, year, variant, transmission, label"
    )
    .single();

  if (error) throw error;

  return {
    id: data.id,
    make: data.make,
    vehicleId: data.vehicle_key,
    model: data.model,
    generation: data.generation || undefined,
    year: data.year,
    variant: data.variant,
    transmission: data.transmission || undefined,
    label: data.label,
  };
}

export async function removeAccountVehicle(id?: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  let request = supabase
    .from("customer_vehicles")
    .delete()
    .eq("user_id", user.id);

  request = id ? request.eq("id", id) : request.eq("is_default", true);

  const { error } = await request;
  if (error) throw error;
}

export async function loadDefaultAddress(): Promise<AccountAddress | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data, error } = await supabase
    .from("addresses")
    .select(
      "id, label, full_name, phone, address_line_1, address_line_2, city, state, postcode, country_code"
    )
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    label: data.label || undefined,
    full_name: data.full_name,
    phone: data.phone,
    address_line_1: data.address_line_1,
    address_line_2: data.address_line_2 || undefined,
    city: data.city,
    state: data.state,
    postcode: data.postcode,
    country_code: data.country_code,
  };
}

export async function saveDefaultAddress(
  address: AccountAddress
): Promise<AccountAddress | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const now = new Date().toISOString();

  const { data: existing, error: existingError } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_default", true)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const { data, error } = await supabase
      .from("addresses")
      .update({
        label: address.label || "Default",
        full_name: address.full_name,
        phone: address.phone,
        address_line_1: address.address_line_1,
        address_line_2: address.address_line_2 || null,
        city: address.city,
        state: address.state,
        postcode: address.postcode,
        country_code: address.country_code || "MY",
        updated_at: now,
      })
      .eq("id", existing.id)
      .select(
        "id, label, full_name, phone, address_line_1, address_line_2, city, state, postcode, country_code"
      )
      .single();

    if (error) throw error;

    return {
      id: data.id,
      label: data.label || undefined,
      full_name: data.full_name,
      phone: data.phone,
      address_line_1: data.address_line_1,
      address_line_2: data.address_line_2 || undefined,
      city: data.city,
      state: data.state,
      postcode: data.postcode,
      country_code: data.country_code,
    };
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: user.id,
      label: address.label || "Default",
      full_name: address.full_name,
      phone: address.phone,
      address_line_1: address.address_line_1,
      address_line_2: address.address_line_2 || null,
      city: address.city,
      state: address.state,
      postcode: address.postcode,
      country_code: address.country_code || "MY",
      is_default: true,
      updated_at: now,
    })
    .select(
      "id, label, full_name, phone, address_line_1, address_line_2, city, state, postcode, country_code"
    )
    .single();

  if (error) throw error;

  return {
    id: data.id,
    label: data.label || undefined,
    full_name: data.full_name,
    phone: data.phone,
    address_line_1: data.address_line_1,
    address_line_2: data.address_line_2 || undefined,
    city: data.city,
    state: data.state,
    postcode: data.postcode,
    country_code: data.country_code,
  };
}


export async function loadAccountAddresses(): Promise<AccountAddress[]> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return [];

  const { data, error } = await supabase
    .from("addresses")
    .select(
      "id, label, full_name, phone, address_line_1, address_line_2, city, state, postcode, country_code, is_default"
    )
    .eq("user_id", user.id)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    label: row.label || undefined,
    full_name: row.full_name,
    phone: row.phone,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2 || undefined,
    city: row.city,
    state: row.state,
    postcode: row.postcode,
    country_code: row.country_code,
    is_default: Boolean(row.is_default),
  }));
}

export async function saveAccountAddress(
  address: AccountAddress,
  makeDefault = false
): Promise<AccountAddress | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const now = new Date().toISOString();

  if (makeDefault) {
    let clear = supabase
      .from("addresses")
      .update({ is_default: false, updated_at: now })
      .eq("user_id", user.id)
      .eq("is_default", true);

    if (address.id) {
      clear = clear.neq("id", address.id);
    }

    const { error: clearError } = await clear;
    if (clearError) throw clearError;
  }

  const payload = {
    label: address.label?.trim() || "Address",
    full_name: address.full_name.trim(),
    phone: address.phone.trim(),
    address_line_1: address.address_line_1.trim(),
    address_line_2: address.address_line_2?.trim() || null,
    city: address.city.trim(),
    state: address.state.trim(),
    postcode: address.postcode.trim(),
    country_code: address.country_code || "MY",
    is_default: makeDefault,
    updated_at: now,
  };

  if (address.id) {
    const { data, error } = await supabase
      .from("addresses")
      .update(payload)
      .eq("id", address.id)
      .eq("user_id", user.id)
      .select(
        "id, label, full_name, phone, address_line_1, address_line_2, city, state, postcode, country_code, is_default"
      )
      .single();

    if (error) throw error;

    return {
      id: data.id,
      label: data.label || undefined,
      full_name: data.full_name,
      phone: data.phone,
      address_line_1: data.address_line_1,
      address_line_2: data.address_line_2 || undefined,
      city: data.city,
      state: data.state,
      postcode: data.postcode,
      country_code: data.country_code,
      is_default: Boolean(data.is_default),
    };
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      user_id: user.id,
      ...payload,
    })
    .select(
      "id, label, full_name, phone, address_line_1, address_line_2, city, state, postcode, country_code, is_default"
    )
    .single();

  if (error) throw error;

  return {
    id: data.id,
    label: data.label || undefined,
    full_name: data.full_name,
    phone: data.phone,
    address_line_1: data.address_line_1,
    address_line_2: data.address_line_2 || undefined,
    city: data.city,
    state: data.state,
    postcode: data.postcode,
    country_code: data.country_code,
    is_default: Boolean(data.is_default),
  };
}

export async function setDefaultAccountAddress(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const now = new Date().toISOString();

  const { error: clearError } = await supabase
    .from("addresses")
    .update({ is_default: false, updated_at: now })
    .eq("user_id", user.id)
    .eq("is_default", true)
    .neq("id", id);

  if (clearError) throw clearError;

  const { error } = await supabase
    .from("addresses")
    .update({ is_default: true, updated_at: now })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

export async function deleteAccountAddress(id: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from("addresses")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;

  const { data: remaining, error: remainingError } = await supabase
    .from("addresses")
    .select("id")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (remainingError) throw remainingError;

  if (remaining?.[0]?.id) {
    const { data: defaultExists } = await supabase
      .from("addresses")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_default", true)
      .maybeSingle();

    if (!defaultExists) {
      await setDefaultAccountAddress(remaining[0].id);
    }
  }
}
