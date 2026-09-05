import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, resolveLocale, t } from "../lib/i18n";

describe("t", () => {
  it("returns English by default", () => {
    expect(t("signIn")).toBe("Sign in");
  });

  it("returns Portuguese when asked", () => {
    expect(t("signIn", "pt")).toBe("Entrar");
    expect(t("navCampaigns", "pt")).toBe("Campanhas");
  });

  it("falls back to English for an unknown locale", () => {
    // @ts-expect-error deliberately passing an invalid locale
    expect(t("signIn", "de")).toBe("Sign in");
  });
});

describe("resolveLocale", () => {
  it("prefers a valid locale cookie", () => {
    expect(
      resolveLocale({ cookie: "pt", acceptLanguage: "en-US,en;q=0.9" })
    ).toBe("pt");
  });

  it("ignores an unknown cookie and uses the header", () => {
    expect(
      resolveLocale({ cookie: "xx", acceptLanguage: "pt-BR,pt;q=0.9,en;q=0.5" })
    ).toBe("pt");
  });

  it("parses the header's first supported language", () => {
    expect(resolveLocale({ acceptLanguage: "fr-FR,fr;q=0.9,en;q=0.4" })).toBe(
      "en"
    );
  });

  it("falls back to the default when nothing matches", () => {
    expect(resolveLocale({ cookie: null, acceptLanguage: "fr,de" })).toBe(
      DEFAULT_LOCALE
    );
    expect(resolveLocale({})).toBe(DEFAULT_LOCALE);
  });

  it("is case-insensitive for the cookie", () => {
    expect(resolveLocale({ cookie: "PT" })).toBe("pt");
  });
});
