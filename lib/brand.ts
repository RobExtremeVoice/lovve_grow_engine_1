/**
 * Brand & instance configuration for the Lovve Growth Engine.
 *
 * The rebrand is configurable so the fork stays close to upstream OpenReply:
 * nothing here hardcodes "Lovve" at a call site. A deployment that sets none
 * of these env vars still gets a working, if generically named, instance.
 *
 * All values are read at call time (not module load) so tests and serverless
 * invocations that stub the environment see the current value.
 */

/** Default when APP_BRAND_NAME is unset. */
export const DEFAULT_BRAND_NAME = "Lovve Growth Engine";

/**
 * Visible product name — used in page titles, the PWA manifest, wordmarks, and
 * legal copy. Override per deployment with APP_BRAND_NAME.
 */
export function getBrandName(): string {
  return process.env.APP_BRAND_NAME?.trim() || DEFAULT_BRAND_NAME;
}

/**
 * Canonical public origin of this instance, e.g. `https://growth.lovvestore.com`.
 * Falls back to NEXTAUTH_URL (already required for auth) and then localhost, so
 * an existing OpenReply deployment needs no new variable.
 */
export function getAppBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL?.trim() ||
    process.env.NEXTAUTH_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

const TRUTHY = new Set(["1", "true", "yes", "on"]);

/**
 * Whether this is a private, invite-only instance. When true, the public
 * acquisition surface OpenReply ships (marketing landing, SEO pages, the
 * template catalog) is hidden — see `proxy.ts`. The pages Meta App Review
 * needs (privacy, terms, data deletion, review notes) always stay public.
 *
 * Default false, so upstream OpenReply behaviour is preserved until a
 * deployment opts in with APP_PRIVATE_INSTANCE=true.
 */
export function isPrivateInstance(): boolean {
  const raw = process.env.APP_PRIVATE_INSTANCE?.trim().toLowerCase();
  return raw ? TRUTHY.has(raw) : false;
}
