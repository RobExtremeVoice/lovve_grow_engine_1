/**
 * Webhook route — idempotency and signature handling (Sprint 3).
 *
 * The unit tests in webhook.test.ts cover parsing; this covers the POST handler:
 * a duplicate comment delivery must enqueue with the same deterministic job id
 * (so BullMQ drops the repeat), and a bad signature must be rejected and logged.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "crypto";
import { NextRequest } from "next/server";

const { mockPrisma, mockQueueAdd } = vi.hoisted(() => ({
  mockPrisma: {
    webhookEvent: { create: vi.fn(), update: vi.fn() },
    instagramAccount: { findUnique: vi.fn() },
    operationalEvent: { create: vi.fn() },
    dmLog: { findMany: vi.fn() },
  },
  mockQueueAdd: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/queue/client")>();
  return { ...actual, getDMQueue: () => ({ add: mockQueueAdd }) };
});

import { POST, GET } from "@/app/api/webhook/route";

const SECRET = "test_app_secret_for_route";

function sign(body: string): string {
  return "sha256=" + createHmac("sha256", SECRET).update(body).digest("hex");
}

function commentPayload(commentId: string) {
  return JSON.stringify({
    object: "instagram",
    entry: [
      {
        id: "17841400000000000",
        time: 1700000000,
        changes: [
          {
            field: "comments",
            value: {
              id: commentId,
              text: "LOVE15",
              from: { id: "999", username: "shopper" },
              media: { id: "media_1" },
            },
          },
        ],
      },
    ],
  });
}

function post(body: string, signature: string | null) {
  return POST(
    new NextRequest("https://growth.example.com/api/webhook", {
      method: "POST",
      headers: signature
        ? { "x-hub-signature-256": signature, "content-type": "application/json" }
        : { "content-type": "application/json" },
      body,
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("FACEBOOK_APP_SECRET", SECRET);
  vi.stubEnv("INSTAGRAM_APP_SECRET", "");
  mockPrisma.webhookEvent.create.mockResolvedValue({ id: "wh_1" });
  mockPrisma.webhookEvent.update.mockResolvedValue({});
  mockPrisma.instagramAccount.findUnique.mockResolvedValue({
    workspaceId: "ws_1",
  });
  mockPrisma.operationalEvent.create.mockResolvedValue({});
  mockPrisma.dmLog.findMany.mockResolvedValue([]);
});

describe("GET verify", () => {
  it("echoes the challenge when the verify token matches", async () => {
    vi.stubEnv("WEBHOOK_VERIFY_TOKEN", "vt");
    const res = await GET(
      new NextRequest(
        "https://x/api/webhook?hub.mode=subscribe&hub.verify_token=vt&hub.challenge=42"
      )
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("42");
  });

  it("403s on a wrong verify token", async () => {
    vi.stubEnv("WEBHOOK_VERIFY_TOKEN", "vt");
    const res = await GET(
      new NextRequest(
        "https://x/api/webhook?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42"
      )
    );
    expect(res.status).toBe(403);
  });
});

describe("POST signature handling", () => {
  it("rejects a missing/invalid signature with 401 and logs it", async () => {
    const body = commentPayload("c_1");
    const res = await post(body, "sha256=deadbeef");
    expect(res.status).toBe(401);
    expect(mockQueueAdd).not.toHaveBeenCalled();
    expect(mockPrisma.operationalEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ level: "WARNING" }),
      })
    );
  });
});

describe("POST idempotency", () => {
  it("enqueues a duplicate comment under the same deterministic job id", async () => {
    const body = commentPayload("c_42");
    const sig = sign(body);

    const res1 = await post(body, sig);
    const res2 = await post(body, sig);

    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);

    const [name1, , opts1] = mockQueueAdd.mock.calls[0];
    const [, , opts2] = mockQueueAdd.mock.calls[1];
    expect(name1).toBe("process-comment");
    expect(opts1.jobId).toBe("comment_17841400000000000_c_42");
    expect(opts2.jobId).toBe(opts1.jobId);
  });

  it("still returns 200 and enqueues nothing for a non-instagram object", async () => {
    const body = JSON.stringify({ object: "page", entry: [] });
    const res = await post(body, sign(body));
    expect(res.status).toBe(200);
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });
});
