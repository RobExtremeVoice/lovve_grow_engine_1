/**
 * Infrastructure smoke test — Sprint 2 acceptance criterion.
 *
 * Enqueues a healthcheck job and waits for the running worker to process it,
 * which exercises the full path: this process -> Redis (BullMQ) -> worker ->
 * PostgreSQL (an OperationalEvent row).
 *
 * Usage (worker must be running against the same REDIS_URL / DATABASE_URL):
 *   npm run smoke:job
 *
 * Exit code 0 = the round trip completed, 1 = it timed out or errored.
 */

import { randomUUID } from "node:crypto";
import { getDMQueue, getRedisConnection, HEALTHCHECK_JOB_NAME } from "@/lib/queue/client";
import { prisma } from "@/lib/db/client";

const TIMEOUT_MS = Number(process.env.SMOKE_JOB_TIMEOUT_MS ?? 30_000);
const POLL_INTERVAL_MS = 1_000;

async function main() {
  const nonce = randomUUID();
  const enqueuedAt = new Date().toISOString();

  console.log(`[smoke] enqueuing healthcheck job ${nonce}`);
  const queue = getDMQueue();
  await queue.add(
    HEALTHCHECK_JOB_NAME,
    { nonce, enqueuedAt },
    { removeOnComplete: true, removeOnFail: true }
  );

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const row = await prisma.operationalEvent.findFirst({
      where: { source: "SYSTEM", message: { contains: nonce } },
      select: { createdAt: true, payload: true },
    });
    if (row) {
      const latency =
        typeof row.payload === "object" &&
        row.payload !== null &&
        "latencyMs" in row.payload
          ? (row.payload as { latencyMs: number }).latencyMs
          : null;
      console.log(
        `[smoke] PASS — worker processed the job` +
          (latency !== null ? ` in ${latency}ms` : "")
      );
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `no OperationalEvent for ${nonce} within ${TIMEOUT_MS}ms — is the worker running against this Redis/DB?`
  );
}

main()
  .then(async () => {
    await shutdown(0);
  })
  .catch(async (error) => {
    console.error(`[smoke] FAIL — ${error instanceof Error ? error.message : error}`);
    await shutdown(1);
  });

async function shutdown(code: number) {
  try {
    await prisma.$disconnect();
    await getRedisConnection().quit();
  } catch {
    // best effort
  }
  process.exit(code);
}
