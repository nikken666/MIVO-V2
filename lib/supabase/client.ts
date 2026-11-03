import { createBrowserClient } from "@supabase/ssr";
import type { AuthChangeEvent, SupabaseClient, UserResponse } from "@supabase/supabase-js";

type BrowserClient = SupabaseClient;
type GetUser = BrowserClient["auth"]["getUser"];
type UserResult = UserResponse;
type AuthEvent = AuthChangeEvent;

const USER_CACHE_MS = 10_000;
const deduped = new WeakSet<object>();

/**
 * Many components ask "who is signed in?" at once (header, cart, chat, page…).
 * Each auth.getUser() is a network call, so share one answer between them:
 * calls within a few seconds reuse the same request, and any sign-in,
 * sign-out or token refresh clears it.
 */
function shareGetUser(client: BrowserClient) {
  if (deduped.has(client)) return;
  deduped.add(client);

  const original: GetUser = client.auth.getUser.bind(client.auth);
  let cached: { at: number; promise: ReturnType<GetUser> } | null = null;

  client.auth.getUser = ((jwt?: string) => {
    if (jwt) return original(jwt);
    if (cached && Date.now() - cached.at < USER_CACHE_MS) return cached.promise;
    const promise = original().then((result: UserResult) => {
      if (result.error) cached = null;
      return result;
    }) as ReturnType<GetUser>;
    cached = { at: Date.now(), promise };
    return promise;
  }) as GetUser;

  client.auth.onAuthStateChange((event: AuthEvent) => {
    if (event !== "INITIAL_SESSION") cached = null;
  });
}

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const client = createBrowserClient(url, key);
  // Only in the browser, where createBrowserClient returns one shared client.
  if (typeof window !== "undefined") shareGetUser(client as unknown as SupabaseClient);
  return client;
}
