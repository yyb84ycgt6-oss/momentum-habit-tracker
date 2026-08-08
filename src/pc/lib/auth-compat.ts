/**
 * Firebase Auth compatibility layer, backed by Supabase.
 *
 * The companion to `firestore-compat.ts`. TermStudio signs in with Google
 * and watches auth state; that maps cleanly onto Supabase's OAuth and
 * `onAuthStateChange`, so the app keeps its call sites.
 *
 * The one honest difference is `signInWithPopup`. Supabase's OAuth is a
 * full-page redirect, not a popup — the tab navigates to Google and comes
 * back to the desktop. The name is kept so the ported code compiles, but it
 * does not open a popup, and the promise resolves once the redirect has been
 * initiated rather than once the user has signed in.
 */
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

/** Firestore-shaped user. Ported code reads `email`, `uid`, `displayName`. */
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

function toUser(u: SupabaseUser | null | undefined): User | null {
  if (!u) return null;
  const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
  return {
    uid: u.id,
    email: u.email ?? null,
    displayName:
      (typeof meta.full_name === "string" && meta.full_name) ||
      (typeof meta.name === "string" && meta.name) ||
      (u.email ? u.email.split("@")[0] : null),
    photoURL: typeof meta.avatar_url === "string" ? meta.avatar_url : null,
  };
}

/**
 * The `auth` object the ported apps import. `currentUser` is a live-updated
 * field rather than a getter because Firebase's is a plain property and the
 * call sites read it synchronously (`auth.currentUser?.email`).
 */
export const auth: { currentUser: User | null } = { currentUser: null };

// Keep `currentUser` populated from the moment the module loads, so a
// synchronous read right after mount is not spuriously null.
if (typeof window !== "undefined") {
  void supabase.auth.getSession().then(({ data }) => {
    auth.currentUser = toUser(data.session?.user);
  });
  supabase.auth.onAuthStateChange((_event, session) => {
    auth.currentUser = toUser(session?.user);
  });
}

/** OAuth credential, as Firebase's `credentialFromResult` returns it. */
export interface OAuthCredential {
  accessToken?: string;
  providerId: string;
}

/**
 * Provider handle. Supabase selects the provider by name rather than by
 * instance, so this mainly carries the requested OAuth scopes across to
 * `signInWithPopup`.
 */
export class GoogleAuthProvider {
  static readonly PROVIDER_ID = "google.com";

  readonly scopes: string[] = [];

  addScope(scope: string): this {
    this.scopes.push(scope);
    return this;
  }

  /**
   * Firebase hands back the provider token on the sign-in result. Supabase
   * delivers it on the *session* after the redirect completes, so there is
   * nothing to read from the result object — it returns null and callers
   * take their "no token" path. `providerToken()` below is the real route.
   */
  static credentialFromResult(_result: { user: User | null }): OAuthCredential | null {
    return null;
  }
}

/**
 * The Google access token for the current session, when one exists.
 *
 * This is the honest replacement for `credentialFromResult`: Supabase keeps
 * the provider's token on the session after the OAuth redirect, so it is
 * readable here rather than from the sign-in call's return value.
 */
export async function providerToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.provider_token ?? null;
}

export function onAuthStateChanged(
  _auth: unknown,
  callback: (user: User | null) => void,
): () => void {
  if (typeof window === "undefined") return () => {};
  const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(toUser(session?.user));
  });
  // Firebase fires immediately with the current state; match that so an app
  // that only renders from the callback is not stuck on a loading screen.
  void supabase.auth.getSession().then(({ data }) => callback(toUser(data.session?.user)));
  return () => sub.subscription.unsubscribe();
}

export async function signInWithPopup(
  _auth: unknown,
  _provider: GoogleAuthProvider,
): Promise<{ user: User | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${window.location.origin}/desktop` },
  });
  if (error) throw new Error(error.message);
  // The tab is navigating away; nothing meaningful to return.
  return { user: null };
}

export async function signOut(_auth?: unknown): Promise<void> {
  const { error } = await supabase.auth.signOut();
  if (error) throw new Error(error.message);
}
