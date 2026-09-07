import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  DEFAULT_BRAND_NAME,
  getAppBaseUrl,
  getBrandName,
  isPrivateInstance,
} from "../lib/brand";

beforeEach(() => {
  vi.unstubAllEnvs();
});

describe("getBrandName", () => {
  it("defaults to the Lovve name when APP_BRAND_NAME is unset", () => {
    expect(getBrandName()).toBe(DEFAULT_BRAND_NAME);
  });

  it("uses APP_BRAND_NAME when set, trimmed", () => {
    vi.stubEnv("APP_BRAND_NAME", "  Acme Growth  ");
    expect(getBrandName()).toBe("Acme Growth");
  });

  it("falls back to the default for a blank override", () => {
    vi.stubEnv("APP_BRAND_NAME", "   ");
    expect(getBrandName()).toBe(DEFAULT_BRAND_NAME);
  });
});

describe("getAppBaseUrl", () => {
  it("prefers APP_BASE_URL and strips trailing slashes", () => {
    vi.stubEnv("APP_BASE_URL", "https://growth.lovvestore.com/");
    expect(getAppBaseUrl()).toBe("https://growth.lovvestore.com");
  });

  it("falls back to NEXTAUTH_URL", () => {
    vi.stubEnv("APP_BASE_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "https://staging.example.com");
    expect(getAppBaseUrl()).toBe("https://staging.example.com");
  });

  it("falls back to localhost when nothing is set", () => {
    vi.stubEnv("APP_BASE_URL", "");
    vi.stubEnv("NEXTAUTH_URL", "");
    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });
});

describe("isPrivateInstance", () => {
  it("defaults to false so upstream behaviour is preserved", () => {
    expect(isPrivateInstance()).toBe(false);
  });

  it("accepts common truthy spellings", () => {
    for (const value of ["1", "true", "TRUE", " yes ", "on"]) {
      vi.stubEnv("APP_PRIVATE_INSTANCE", value);
      expect(isPrivateInstance()).toBe(true);
    }
  });

  it("treats other values as false", () => {
    for (const value of ["0", "false", "no", ""]) {
      vi.stubEnv("APP_PRIVATE_INSTANCE", value);
      expect(isPrivateInstance()).toBe(false);
    }
  });
});
