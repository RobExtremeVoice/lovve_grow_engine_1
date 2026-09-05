/**
 * Feature flags for Lovve Growth Engine additions.
 *
 * The Lovve Growth Engine builds on the OpenReply core with a set of
 * incremental features (new-follower acquisition offer, referral program,
 * outreach assistant, Lightspeed commerce sync). Each ships behind a flag so
 * a workspace can adopt them one at a time and the upstream OpenReply
 * behaviour stays reachable with every flag off.
 *
 * Defaults: every flag is OFF. A missing or unparseable env var reads as
 * `false`, so an existing deployment that never sets these keeps behaving
 * exactly as before. Nothing in the codebase branches on these yet — this
 * module exists so later sprints have a single, tested place to gate on.
 *
 * Scope: these are process-level flags read from the environment. Per-workspace
 * or per-account overrides (as the blueprint anticipates) can layer on top
 * later by taking the env value as the default and consulting a workspace
 * setting when one exists.
 */

export type FeatureFlag =
  | "newFollowerOffer"
  | "referrals"
  | "outreachAssistant"
  | "lightspeed";

/** Maps each flag to the environment variable that controls it. */
export const FEATURE_FLAG_ENV: Record<FeatureFlag, string> = {
  newFollowerOffer: "FEATURE_NEW_FOLLOWER_OFFER",
  referrals: "FEATURE_REFERRALS",
  outreachAssistant: "FEATURE_OUTREACH_ASSISTANT",
  lightspeed: "FEATURE_LIGHTSPEED",
};

const TRUTHY = new Set(["1", "true", "yes", "on"]);

function parseFlag(raw: string | undefined): boolean {
  if (!raw) return false;
  return TRUTHY.has(raw.trim().toLowerCase());
}

/**
 * Whether a single Lovve feature is enabled for this process.
 *
 * Read at call time (not module load) so tests and serverless invocations that
 * stub the environment see the current value.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return parseFlag(process.env[FEATURE_FLAG_ENV[flag]]);
}

/** Snapshot of every flag, e.g. for a diagnostics view. */
export function getFeatureFlags(): Record<FeatureFlag, boolean> {
  return {
    newFollowerOffer: isFeatureEnabled("newFollowerOffer"),
    referrals: isFeatureEnabled("referrals"),
    outreachAssistant: isFeatureEnabled("outreachAssistant"),
    lightspeed: isFeatureEnabled("lightspeed"),
  };
}
