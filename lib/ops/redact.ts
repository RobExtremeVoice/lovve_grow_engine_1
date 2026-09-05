/**
 * Strip anything credential-shaped out of a diagnostic string before it leaves
 * the server. Driver errors (pg, ioredis) routinely embed the full connection
 * string — `/api/health` is unauthenticated, so its `detail` fields must not.
 */

// user:password@  inside a URL
const URL_CREDENTIALS = /\/\/[^/\s:@]+:[^/\s:@]+@/g;
// bare key=value pairs for common secret-ish keys
const SECRET_KV =
  /\b(password|passwd|pwd|secret|token|apikey|api_key|auth)\s*[=:]\s*\S+/gi;

export function redactSecrets(input: string): string {
  return input
    .replace(URL_CREDENTIALS, "//***:***@")
    .replace(SECRET_KV, "$1=***");
}

/** Redact the `detail` of a health check, leaving other fields intact. */
export function redactDetail<T extends { status: string; detail?: string }>(
  check: T
): T {
  if (typeof check.detail === "string") {
    return { ...check, detail: redactSecrets(check.detail) };
  }
  return check;
}
