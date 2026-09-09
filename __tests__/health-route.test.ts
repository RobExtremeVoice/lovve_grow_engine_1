/**
 * /api/health — must never hang.
 *
 * A misconfigured or unreachable REDIS_URL/DATABASE_URL must not make this
 * endpoint hang: ioredis's offline queue plus `maxRetriesPerRequest: null`
 * (required by BullMQ) means a command can wait for a connection forever.
 * Each check is raced against a timeout so the endpoint always answers
 * promptly and says which dependency is stuck.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { mockPrisma, mockRedisPing, mockGetJobCounts, mockGetWorkerHealth } =
  vi.hoisted(() => ({
    mockPrisma: { $queryRaw: vi.fn() },
    mockRedisPing: vi.fn(),
    mockGetJobCounts: vi.fn(),
    mockGetWorkerHealth: vi.fn(),
  }));

vi.mock("@/lib/db/client", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/queue/client", () => ({
  getRedisConnection: () => ({ ping: mockRedisPing }),
  getDMQueue: () => ({ getJobCounts: mockGetJobCounts }),
}));
vi.mock("@/lib/ops/worker-health", () => ({
  getWorkerHealth: mockGetWorkerHealth,
}));

import { GET } from "@/app/api/health/route";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
  mockRedisPing.mockResolvedValue("PONG");
  mockGetJobCounts.mockResolvedValue({ waiting: 0, active: 0 });
  mockGetWorkerHealth.mockResolvedValue({
    healthy: true,
    heartbeat: { status: "running", worker: "dm", pid: 1, checkedAt: "now" },
    ageMs: 100,
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/health", () => {
  it("returns 200 and ok when every dependency responds", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.redis.status).toBe("ok");
    expect(body.checks.queue.status).toBe("ok");
    expect(body.checks.worker.healthy).toBe(true);
  });

  it("reports a normal dependency failure without hanging", async () => {
    mockRedisPing.mockRejectedValue(new Error("ECONNREFUSED"));
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(503);
    expect(body.status).toBe("degraded");
    expect(body.checks.redis.status).toBe("error");
    expect(body.checks.database.status).toBe("ok");
  });

  it("times out a check that never resolves, instead of hanging the endpoint", async () => {
    vi.useFakeTimers();
    // Simulate the real failure mode: a command stuck forever waiting for a
    // connection (unreachable host, wrong TLS scheme, etc).
    mockRedisPing.mockReturnValue(new Promise(() => {}));

    const pending = GET();
    await vi.advanceTimersByTimeAsync(5000);
    const res = await pending;
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.checks.redis.status).toBe("error");
    expect(body.checks.redis.detail).toContain("timed out");
    // Other checks still resolved normally in the same response.
    expect(body.checks.database.status).toBe("ok");
    expect(body.checks.queue.status).toBe("ok");
  });

  it("redacts a connection string from a check failure", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(
      new Error("connect ECONNREFUSED postgresql://app:s3cr3t@db.example.com:5432/prod")
    );
    const res = await GET();
    const body = await res.json();
    expect(body.checks.database.detail).not.toContain("s3cr3t");
  });
});
