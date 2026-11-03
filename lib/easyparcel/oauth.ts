import { createAdminClient } from "@/lib/supabase/admin";

// EasyParcel Open API, OAuth 2.0 (authorization code).
// The MIVO superadmin links MIVO's EasyParcel account once at
// /api/easyparcel/connect; tokens are kept in public.easyparcel_connection
// (server-only) and refreshed automatically.

export function easyParcelConfig() {
  const clientId = process.env.EASYPARCEL_CLIENT_ID;
  const clientSecret = process.env.EASYPARCEL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("EasyParcel is not configured yet (EASYPARCEL_CLIENT_ID / EASYPARCEL_CLIENT_SECRET).");
  }
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");
  return {
    clientId,
    clientSecret,
    authBase: (process.env.EASYPARCEL_AUTH_BASE || "https://api.easyparcel.com").replace(/\/$/, ""),
    redirectUri: process.env.EASYPARCEL_REDIRECT_URI || site + "/api/easyparcel/callback",
  };
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: string;
  refresh_token_expires_at?: string;
  error?: string;
  message?: string;
};

async function requestToken(params: Record<string, string>): Promise<TokenResponse> {
  const config = easyParcelConfig();
  const body = new URLSearchParams({ redirect_uri: config.redirectUri, ...params });
  const response = await fetch(config.authBase + "/oauth/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(config.clientId + ":" + config.clientSecret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    cache: "no-store",
  });
  const data = (await response.json().catch(() => ({}))) as TokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error("EasyParcel sign-in failed: " + (data.message || data.error || response.status));
  }
  return data;
}

async function saveTokens(token: TokenResponse, connectedBy?: string | null) {
  const admin = createAdminClient();
  const expiresAt =
    token.expires_at || new Date(Date.now() + (token.expires_in || 36000) * 1000).toISOString();
  const row: Record<string, unknown> = {
    id: 1,
    access_token: token.access_token,
    expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };
  if (token.refresh_token) row.refresh_token = token.refresh_token;
  if (token.refresh_token_expires_at) row.refresh_expires_at = token.refresh_token_expires_at;
  if (connectedBy !== undefined) {
    row.connected_by = connectedBy;
    row.connected_at = new Date().toISOString();
  }
  const { error } = await admin.from("easyparcel_connection").upsert(row);
  if (error) throw new Error("Could not save the EasyParcel connection: " + error.message);
}

/** Exchange the code from the OAuth redirect and store the tokens. */
export async function connectWithCode(code: string, connectedBy: string) {
  const token = await requestToken({ grant_type: "authorization_code", code });
  await saveTokens(token, connectedBy);
}

/** A valid access token, refreshed when it is about to expire. */
export async function getEasyParcelToken(): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("easyparcel_connection")
    .select("access_token, refresh_token, expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (!data?.access_token) {
    throw new Error("EasyParcel is not connected yet. A MIVO superadmin needs to connect it in Shipping settings.");
  }
  const expiresAt = data.expires_at ? new Date(data.expires_at).getTime() : 0;
  if (expiresAt - Date.now() > 5 * 60 * 1000) return data.access_token;
  if (!data.refresh_token) throw new Error("EasyParcel connection expired. Please connect it again.");
  const token = await requestToken({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  await saveTokens(token);
  return token.access_token;
}

/** Force a refresh (after a 401). */
export async function refreshEasyParcelToken(): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("easyparcel_connection").select("refresh_token").eq("id", 1).maybeSingle();
  if (!data?.refresh_token) throw new Error("EasyParcel connection expired. Please connect it again.");
  const token = await requestToken({ grant_type: "refresh_token", refresh_token: data.refresh_token });
  await saveTokens(token);
  return token.access_token;
}

/** Whether EasyParcel is connected (for the settings page). */
export async function easyParcelStatus() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("easyparcel_connection")
    .select("connected_at, expires_at, refresh_expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (error) return { ready: false, connected: false, error: error.message };
  return {
    ready: true,
    connected: Boolean(data),
    connectedAt: data?.connected_at || null,
    refreshExpiresAt: data?.refresh_expires_at || null,
  };
}
