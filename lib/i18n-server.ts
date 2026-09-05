// Server components only. `next/headers` throws if imported into a client
// bundle, which is the guard we want — `lib/i18n.ts` stays client-safe.
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "@/lib/i18n";

/**
 * Resolve the request locale from the `locale` cookie and the Accept-Language
 * header. Server components only — `lib/i18n.ts` stays import-safe for client
 * components (the dashboard nav needs `t()`).
 */
export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale({
    cookie: cookieStore.get(LOCALE_COOKIE)?.value ?? null,
    acceptLanguage: headerStore.get("accept-language"),
  });
}
