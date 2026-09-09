import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";
import { getDMQueue, getRedisConnection } from "@/lib/queue/client";
import { getWorkerHealth } from "@/lib/ops/worker-health";
import { redactDetail, redactSecrets } from "@/lib/ops/redact";

export const runtime = "nodejs";
// Health must reflect live state (worker heartbeat, queue depth), never a
// cached response, or it reports stale worker start times.
export const dynamic = "force-dynamic";

type CheckStatus = "ok" | "error";

interface HealthCheck {
  status: CheckStatus;
  detail?: string;
}

const CHECK_TIMEOUT_MS = 5000;

/**
 * Bounds a check to CHECK_TIMEOUT_MS. Without this, a misconfigured or
 * unreachable REDIS_URL/DATABASE_URL doesn't fail fast — ioredis's default
 * offline queue plus `maxRetriesPerRequest: null` (required by BullMQ) means a
 * command can wait for a connection indefinitely, and the whole endpoint hangs
 * until the platform kills the function. That turns the one endpoint meant to
 * diagnose an outage into a second outage, with no log line pointing at which
 * dependency is actually stuck. Racing each check against a timeout guarantees
 * a prompt, actionable response either way.
 */
function withTimeout<T extends { status: CheckStatus }>(
  promise: Promise<T>,
  label: string
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(
        () =>
          resolve({
            status: "error",
            detail: `${label} check timed out after ${CHECK_TIMEOUT_MS}ms`,
          } as unknown as T),
        CHECK_TIMEOUT_MS
      );
    }),
  ]);
}

async function checkDatabase(): Promise<HealthCheck> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: "ok" };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Database check failed",
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  try {
    const pong = await getRedisConnection().ping();
    return { status: pong === "PONG" ? "ok" : "error", detail: pong };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Redis check failed",
    };
  }
}

async function checkQueue(): Promise<HealthCheck & { counts?: unknown }> {
  try {
    const counts = await getDMQueue().getJobCounts(
      "waiting",
      "active",
      "delayed",
      "failed"
    );
    return { status: "ok", counts };
  } catch (error) {
    return {
      status: "error",
      detail: error instanceof Error ? error.message : "Queue check failed",
    };
  }
}

export async function GET() {
  const [database, redis, queue, worker] = await Promise.all([
    withTimeout(checkDatabase(), "database"),
    withTimeout(checkRedis(), "redis"),
    withTimeout(checkQueue(), "queue"),
    withTimeout(
      getWorkerHealth()
        .then((h) => ({ ...h, status: (h.healthy ? "ok" : "error") as CheckStatus }))
        .catch((error) => ({
          healthy: false,
          heartbeat: null,
          ageMs: null,
          status: "error" as CheckStatus,
          error: error instanceof Error ? error.message : "Worker check failed",
        })),
      "worker"
    ),
  ]);

  const healthy =
    database.status === "ok" &&
    redis.status === "ok" &&
    queue.status === "ok" &&
    worker.healthy;

  // /api/health is unauthenticated, so no check detail may carry a credential.
  const workerSafe =
    "error" in worker && typeof worker.error === "string"
      ? { ...worker, error: redactSecrets(worker.error) }
      : worker;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks: {
        database: redactDetail(database),
        redis: redactDetail(redis),
        queue: redactDetail(queue),
        worker: workerSafe,
      },
    },
    { status: healthy ? 200 : 503 }
  );
}
