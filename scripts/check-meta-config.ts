/**
 * Meta / Instagram configuration check — Sprint 3.
 *
 * Prints the exact strings to paste into the Meta app console and flags any
 * missing or malformed environment variable. Read-only, no network calls, and
 * never prints a secret value (only whether it is set).
 *
 *   vercel env pull .env      # pull the deployed Production vars
 *   npm run check:meta
 *
 * Loads .env automatically (same as prisma.config.ts). Values already present
 * in the real environment win over the file, so this is a no-op in CI / Vercel.
 */

import "dotenv/config";
import { INSTAGRAM_OAUTH_SCOPES } from "@/lib/meta/oauth";
import { WEBHOOK_SUBSCRIBED_FIELDS } from "@/lib/meta/client";

const HEX_64 = /^[a-f0-9]{64}$/i;

// `vercel env pull` writes this in place of any value marked Sensitive. It means
// the var IS set in Vercel; we just cannot read or validate the value locally.
const MASKED = "[SENSITIVE]";
function masked(name: string): boolean {
  return process.env[name] === MASKED;
}
function unmask(value: string | undefined): string | undefined {
  return value === MASKED ? undefined : value;
}

function baseUrl(): string {
  return (
    unmask(process.env.APP_BASE_URL)?.trim() ||
    unmask(process.env.NEXTAUTH_URL)?.trim() ||
    "http://localhost:3000"
  ).replace(/\/+$/, "");
}

type Row = { label: string; ok: boolean; note: string };

const rows: Row[] = [];
function check(label: string, ok: boolean, note: string) {
  rows.push({ label, ok, note });
}

// --- Environment variables -------------------------------------------------
const igAppId = process.env.INSTAGRAM_APP_ID;
check(
  "INSTAGRAM_APP_ID",
  Boolean(igAppId) && igAppId !== "your-instagram-app-id" && igAppId !== "test",
  igAppId ? `= ${igAppId}` : "missing — Instagram product → API setup with Instagram login"
);
check(
  "INSTAGRAM_APP_SECRET",
  Boolean(process.env.INSTAGRAM_APP_SECRET) &&
    process.env.INSTAGRAM_APP_SECRET !== "test",
  process.env.INSTAGRAM_APP_SECRET ? "set" : "missing — same page as the app id"
);
check(
  "FACEBOOK_APP_SECRET",
  Boolean(process.env.FACEBOOK_APP_SECRET) &&
    process.env.FACEBOOK_APP_SECRET !== "test",
  process.env.FACEBOOK_APP_SECRET
    ? "set — used alongside INSTAGRAM_APP_SECRET to verify webhook signatures"
    : "missing — App settings → Basic → App secret"
);
check(
  "WEBHOOK_VERIFY_TOKEN",
  Boolean(process.env.WEBHOOK_VERIFY_TOKEN) &&
    process.env.WEBHOOK_VERIFY_TOKEN !== "test",
  process.env.WEBHOOK_VERIFY_TOKEN
    ? "set — paste the SAME value into the console's Verify token field"
    : "missing — pick any random string"
);
check(
  "ENCRYPTION_KEY",
  masked("ENCRYPTION_KEY") ||
    (Boolean(process.env.ENCRYPTION_KEY) &&
      HEX_64.test(process.env.ENCRYPTION_KEY ?? "")),
  masked("ENCRYPTION_KEY")
    ? "set in Vercel (value masked — can't check the 64-hex format locally)"
    : HEX_64.test(process.env.ENCRYPTION_KEY ?? "")
      ? "valid 32-byte hex — Instagram tokens are stored AES-256-GCM encrypted"
      : "must be exactly 64 hex chars (openssl rand -hex 32)"
);
{
  const nextAuthUrl = unmask(process.env.NEXTAUTH_URL);
  check(
    "NEXTAUTH_URL",
    masked("NEXTAUTH_URL") ||
      (Boolean(nextAuthUrl) && /^https?:\/\//.test(nextAuthUrl ?? "")),
    masked("NEXTAUTH_URL")
      ? "set in Vercel (value masked) — confirm it is the canonical https domain"
      : nextAuthUrl
        ? `= ${nextAuthUrl}  (must be the canonical public domain — the OAuth redirect is built from it)`
        : "missing"
  );
}
check(
  "META_GRAPH_API_VERSION",
  true,
  `= ${unmask(process.env.META_GRAPH_API_VERSION) ?? "v25.0 (default)"}`
);

const b = baseUrl();
if (masked("NEXTAUTH_URL") && !unmask(process.env.APP_BASE_URL)) {
  check(
    "Public URL",
    true,
    "NEXTAUTH_URL is masked — the URLs above show a placeholder; the deployed value should be https://lovve-grow-engine-1.vercel.app"
  );
} else if (b.startsWith("http://")) {
  check("Public URL scheme", false, `${b} is not https — Meta requires https for redirect + webhook`);
}

// --- Values to paste into the Meta console --------------------------------
console.log("\n=== Paste into the Meta app console ===\n");
console.log(`OAuth redirect URI   (Instagram → Business login settings):`);
console.log(`  ${b}/api/instagram/callback\n`);
console.log(`Webhook callback URL (Instagram → Configure webhooks):`);
console.log(`  ${b}/api/webhook`);
console.log(`  Verify token: the value of WEBHOOK_VERIFY_TOKEN (not shown here)\n`);
console.log(`Webhook fields to subscribe: ${WEBHOOK_SUBSCRIBED_FIELDS.join(", ")}\n`);
console.log(`OAuth scopes requested by this app:`);
for (const s of INSTAGRAM_OAUTH_SCOPES) console.log(`  - ${s}`);
console.log(`\nApp Review / Publish URLs:`);
console.log(`  Privacy policy: ${b}/privacy`);
console.log(`  Terms:          ${b}/terms`);
console.log(`  Data deletion:  ${b}/data-deletion`);
console.log(`  Review notes:   ${b}/meta-review`);

// --- Env check results ----------------------------------------------------
console.log("\n=== Environment ===\n");
let failures = 0;
for (const r of rows) {
  if (!r.ok) failures++;
  console.log(`  ${r.ok ? "OK  " : "FAIL"}  ${r.label.padEnd(24)} ${r.note}`);
}

console.log("");
if (failures > 0) {
  console.log(`${failures} problem(s) above. Fix before connecting an account.`);
  process.exit(1);
}
console.log("All Meta env vars look valid. Next: register the URIs above, then connect a tester account.");
