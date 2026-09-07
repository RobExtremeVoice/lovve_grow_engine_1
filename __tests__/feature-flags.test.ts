import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  FEATURE_FLAG_ENV,
  getFeatureFlags,
  isFeatureEnabled,
  type FeatureFlag,
} from "../lib/feature-flags";

beforeEach(() => {
  vi.unstubAllEnvs();
});

const ALL_FLAGS = Object.keys(FEATURE_FLAG_ENV) as FeatureFlag[];

describe("feature flags", () => {
  it("defaults every flag to off when the environment is unset", () => {
    for (const flag of ALL_FLAGS) {
      expect(isFeatureEnabled(flag)).toBe(false);
    }
    expect(getFeatureFlags()).toEqual({
      newFollowerOffer: false,
      referrals: false,
      outreachAssistant: false,
      lightspeed: false,
    });
  });

  it("treats an empty or whitespace value as off", () => {
    vi.stubEnv("FEATURE_NEW_FOLLOWER_OFFER", "");
    vi.stubEnv("FEATURE_REFERRALS", "   ");
    expect(isFeatureEnabled("newFollowerOffer")).toBe(false);
    expect(isFeatureEnabled("referrals")).toBe(false);
  });

  it("accepts common truthy spellings, case and whitespace insensitive", () => {
    for (const value of ["1", "true", "TRUE", " yes ", "On"]) {
      vi.stubEnv("FEATURE_OUTREACH_ASSISTANT", value);
      expect(isFeatureEnabled("outreachAssistant")).toBe(true);
    }
  });

  it("treats any other value as off", () => {
    for (const value of ["0", "false", "no", "off", "disabled", "2"]) {
      vi.stubEnv("FEATURE_LIGHTSPEED", value);
      expect(isFeatureEnabled("lightspeed")).toBe(false);
    }
  });

  it("reads each flag from its own independent variable", () => {
    vi.stubEnv("FEATURE_REFERRALS", "true");
    expect(getFeatureFlags()).toEqual({
      newFollowerOffer: false,
      referrals: true,
      outreachAssistant: false,
      lightspeed: false,
    });
  });
});
