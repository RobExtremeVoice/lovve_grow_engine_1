import { describe, expect, it } from "vitest";
import { redactDetail, redactSecrets } from "../lib/ops/redact";

describe("redactSecrets", () => {
  it("strips credentials from a Postgres URL", () => {
    const input =
      "connect ECONNREFUSED postgresql://app:s3cr3t@db.example.com:5432/prod";
    const out = redactSecrets(input);
    expect(out).not.toContain("s3cr3t");
    expect(out).not.toContain("app:s3cr3t");
    expect(out).toContain("db.example.com:5432/prod");
  });

  it("strips credentials from a Redis URL", () => {
    const out = redactSecrets("redis://default:abc123@redis.example.com:6379");
    expect(out).not.toContain("abc123");
    expect(out).toContain("redis.example.com:6379");
  });

  it("redacts bare secret key=value pairs", () => {
    expect(redactSecrets("auth token=eyJhbGciOi")).not.toContain("eyJhbGciOi");
    expect(redactSecrets("password: hunter2")).toBe("password=***");
  });

  it("leaves an innocuous message untouched", () => {
    const msg = "Query timeout after 5000ms";
    expect(redactSecrets(msg)).toBe(msg);
  });
});

describe("redactDetail", () => {
  it("redacts only the detail field", () => {
    const check = {
      status: "error" as const,
      detail: "fail postgresql://u:p@h:5432/d",
    };
    const out = redactDetail(check);
    expect(out.status).toBe("error");
    expect(out.detail).not.toContain("u:p@");
  });

  it("passes through a check with no detail", () => {
    const check = { status: "ok" as const };
    expect(redactDetail(check)).toEqual({ status: "ok" });
  });
});
