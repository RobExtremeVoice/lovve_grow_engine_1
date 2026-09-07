import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import {
  INSTAGRAM_OAUTH_SCOPES,
  createOAuthState,
  decryptToken,
  encryptToken,
  getAuthorizationUrl,
  verifyOAuthState,
} from "../lib/meta/oauth";

beforeEach(() => {
  vi.stubEnv("NEXTAUTH_SECRET", "test-secret-with-enough-length");
  vi.stubEnv(
    "ENCRYPTION_KEY",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
  );
});

describe("OAuth state and token encryption", () => {
  it("round-trips encrypted tokens", () => {
    const encrypted = encryptToken("long-lived-token");
    expect(encrypted).not.toBe("long-lived-token");
    expect(decryptToken(encrypted)).toBe("long-lived-token");
  });

  it("signs and verifies Instagram OAuth state", () => {
    const state = createOAuthState("workspace_123");
    expect(verifyOAuthState(state)?.workspaceId).toBe("workspace_123");
  });

  it("rejects tampered OAuth state", () => {
    const state = createOAuthState("workspace_123");
    expect(verifyOAuthState(`${state}tampered`)).toBeNull();
  });

  it("rejects a null or malformed state", () => {
    expect(verifyOAuthState(null)).toBeNull();
    expect(verifyOAuthState("no-dot")).toBeNull();
  });
});

describe("OAuth state expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects a state older than the 10-minute window", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const state = createOAuthState("workspace_123");

    vi.setSystemTime(new Date("2026-01-01T00:09:30Z"));
    expect(verifyOAuthState(state)?.workspaceId).toBe("workspace_123");

    vi.setSystemTime(new Date("2026-01-01T00:10:30Z"));
    expect(verifyOAuthState(state)).toBeNull();
  });
});

describe("authorization URL", () => {
  it("requests exactly the reviewed Instagram scopes", () => {
    vi.stubEnv("INSTAGRAM_APP_ID", "1234567890");
    const url = new URL(
      getAuthorizationUrl("https://example.com/api/instagram/callback", "state")
    );
    expect(url.origin + url.pathname).toBe(
      "https://www.instagram.com/oauth/authorize"
    );
    expect(url.searchParams.get("scope")?.split(",")).toEqual([
      ...INSTAGRAM_OAUTH_SCOPES,
    ]);
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://example.com/api/instagram/callback"
    );
  });
});
