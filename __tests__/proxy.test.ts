import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

beforeEach(() => {
  vi.unstubAllEnvs();
});

const SESSION_COOKIE = "authjs.session-token=abc123";

function request(path: string, opts: { authed?: boolean } = {}): NextRequest {
  const headers = new Headers();
  if (opts.authed) headers.set("cookie", SESSION_COOKIE);
  return new NextRequest(`https://growth.example.com${path}`, { headers });
}

function location(res: Response): string | null {
  const loc = res.headers.get("location");
  return loc ? new URL(loc).pathname : null;
}

describe("auth gating", () => {
  it("redirects an unauthenticated visitor away from a protected area", () => {
    for (const path of [
      "/dashboard",
      "/campaigns/new",
      "/overview",
      "/inbox",
      "/settings",
      "/diagnostics",
    ]) {
      const res = proxy(request(path));
      expect(location(res)).toBe("/login");
    }
  });

  it("lets an authenticated visitor through to the dashboard", () => {
    const res = proxy(request("/dashboard", { authed: true }));
    expect(location(res)).toBeNull();
  });

  it("bounces an authenticated visitor off the login page", () => {
    const res = proxy(request("/login", { authed: true }));
    expect(location(res)).toBe("/dashboard");
  });
});

describe("private instance marketing gating", () => {
  it("passes marketing routes through when APP_PRIVATE_INSTANCE is unset", () => {
    for (const path of ["/", "/templates", "/manychat-alternative"]) {
      expect(location(proxy(request(path)))).toBeNull();
    }
  });

  it("redirects marketing routes to /login when private and signed out", () => {
    vi.stubEnv("APP_PRIVATE_INSTANCE", "true");
    for (const path of [
      "/",
      "/templates",
      "/templates/dtc-product-link",
      "/manychat-alternative",
      "/comment-link-automation",
      "/instagram-dm-automation-agencies",
    ]) {
      expect(location(proxy(request(path)))).toBe("/login");
    }
  });

  it("redirects marketing routes to /dashboard when private and signed in", () => {
    vi.stubEnv("APP_PRIVATE_INSTANCE", "true");
    expect(location(proxy(request("/", { authed: true })))).toBe("/dashboard");
  });

  it("keeps Meta-required pages public even when private", () => {
    vi.stubEnv("APP_PRIVATE_INSTANCE", "true");
    // These paths are outside the matcher, so proxy is never invoked for them;
    // assert they are not in the blocked set if proxy somehow runs.
    for (const path of [
      "/privacy",
      "/terms",
      "/data-deletion",
      "/meta-review",
    ]) {
      expect(location(proxy(request(path)))).toBeNull();
    }
  });
});
