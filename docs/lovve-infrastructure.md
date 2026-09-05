# Lovve Growth Engine — Infrastructure Runbook (Sprint 2)

How the Lovve Growth Engine is deployed across `local`, `staging`, and
`production`. This is the operator's checklist; the app code is unchanged from
OpenReply's two-process model (see `docs/stack.md` and `docs/setup.md`).

> **Golden rule:** the web app and the worker must share the exact same
> `DATABASE_URL` target data, `REDIS_URL` target data, and `ENCRYPTION_KEY`.
> The web app writes the encrypted Instagram token; the worker decrypts it to
> send. Different keys = every send fails to decrypt.

---

## 1. Environment matrix

| Piece | local | staging | production |
| --- | --- | --- | --- |
| Web app + API | `next dev` | Vercel (preview/`staging` domain) | Vercel (`growth.lovvestore.com`) |
| Worker | `npm run worker` | Railway service | Railway service |
| PostgreSQL | Docker (`docker-compose`) | Supabase project (staging) | Supabase project (prod) |
| Redis | Docker (`docker-compose`) | Upstash Redis (staging DB) | Upstash Redis (prod DB) |
| Meta app | shared dev app + test IG account | dev app + test IG account | dedicated app + `@lovve.brazilian.store` |
| Lightspeed | mock / off | read-only / mock | (Sprint 8) |

Keep staging and production **fully separate**: different Supabase projects,
different Upstash databases, different Meta apps, different secrets.

---

## 2. Supabase (PostgreSQL)

Prisma 7 stays the access layer (`@prisma/adapter-pg`). We do **not** move
Auth.js to Supabase Auth in this phase.

### Projects

Two separate Supabase projects (staging + production). The concrete project
refs, dashboard links, and DB passwords live in the team vault and the
Vercel/Railway env panels — **not in this repo**. A staging project already
exists; the production project still needs to be created.

### Connection strings (Settings → Database → Connection string)

Supabase gives three shapes. Which one goes where matters:

| Consumer | Which URL | Host / port |
| --- | --- | --- |
| **Vercel** web app (`DATABASE_URL`) | Transaction pooler | `...pooler.supabase.com:6543` + `?pgbouncer=true` |
| **Railway** worker (`DATABASE_URL`) | Direct connection | `db.<ref>.supabase.co:5432` |
| **Migrations** (`DIRECT_URL`, both Vercel build + manual) | Direct connection | `db.<ref>.supabase.co:5432` |

- Vercel functions are short-lived and reconnect constantly → they need the
  pooler. `prisma migrate` and `prisma generate` cannot run through the
  transaction pooler → they use `DIRECT_URL` (added to `prisma.config.ts` in
  this sprint; unset, the CLI falls back to `DATABASE_URL`).
- The Railway worker is one long-lived process → the direct connection is
  simplest and avoids pooler prepared-statement quirks.
- URL-encode special characters in the password (`@` → `%40`, etc.).
- Never commit any of these. They live only in the host's env settings.

### First-time setup per project

1. Create the project, save the DB password.
2. Set `DIRECT_URL` (and `DATABASE_URL`) locally to the new project, then:
   ```
   npm run db:migrate      # prisma migrate deploy
   ```
   The Vercel `vercel-build` script also runs `prisma migrate deploy` on every
   deploy, using `DIRECT_URL`.
3. Production only: **enable Point-in-Time Recovery / daily backups** (Database
   → Backups).
4. Confirm SSL is enforced (Supabase default).

---

## 3. Upstash Redis

One database per environment. BullMQ needs the **native Redis protocol over
TCP** with blocking commands — an HTTP-only endpoint will not work.

1. Create a database (Regional, same region as the worker/Vercel where
   possible).
2. Copy the connection URL into `REDIS_URL` on **both** the web app and the
   worker. Upstash requires TLS — use the **`rediss://`** scheme (double `s`);
   `ioredis` enables TLS automatically for that scheme. A plain `redis://`
   Upstash URL will fail to connect.
3. Eviction: leave default (`noeviction`) — BullMQ data must not be evicted.
4. The worker's `getRedisConnection()` sets `maxRetriesPerRequest: null` (BullMQ
   requirement) and reconnects automatically.
5. The Upstash **REST** URL/token (`https://…upstash.io`) is not usable here —
   BullMQ needs the native TCP protocol on port 6379.

---

## 4. Railway (worker)

One service per environment, pointed at this repo.

| Setting | Value |
| --- | --- |
| Build command | `npm run db:generate` |
| Start command | `npm run worker` |
| Restart policy | On failure (always-on) |

- Do **not** leave the build as `npm run build` — it runs `next build`
  needlessly and any DB-touching build step fails (the worker cannot reach
  Postgres at build time). Migrations are applied by the web app's
  `vercel-build` and the manual `db:migrate`, never by the worker.
- Env vars: every var from §6 that the worker needs — `DATABASE_URL` (direct),
  `REDIS_URL`, `ENCRYPTION_KEY` (identical to Vercel), `NEXTAUTH_URL` (the
  public web domain — tracked links in DMs use it), `META_GRAPH_API_VERSION`,
  `INSTAGRAM_APP_SECRET`, `FACEBOOK_APP_SECRET`, and the
  `COMMENT_POLL_*` tuning vars if overriding defaults.
- Health: the worker writes a heartbeat to Redis every 30s
  (`recordWorkerHeartbeat`), TTL 120s. `/api/health` reports `worker.healthy`
  from it.

---

## 5. Vercel (web app + API)

1. Import the repo. Framework preset: Next.js. Build command stays the default
   (`package.json` → `vercel-build`: `prisma generate && prisma migrate deploy
   && next build`).
2. Add all secrets in **Project → Settings → Environment Variables** (never in
   Git), scoped to Preview (staging) vs Production.
3. Domains:
   - staging: a `*.vercel.app` or a `staging.` subdomain.
   - production: `growth.lovvestore.com` (set as primary). Update
     `NEXTAUTH_URL` / `APP_BASE_URL` and the two Meta URLs to match, and update
     the worker's `NEXTAUTH_URL` too.
4. Confirm `/api/webhook` is publicly reachable (Meta needs GET verify + POST).
   It must not sit behind Vercel password protection or Vercel Authentication.
5. Crons: `vercel.json` already declares the three daily crons; they run
   automatically once the project is deployed. `CRON_SECRET` guards them.

---

## 6. Environment variables (Sprint 2 delta)

Existing vars: see `docs/setup.md`. New / newly-relevant this sprint:

| Var | Where | Notes |
| --- | --- | --- |
| `DIRECT_URL` | Vercel (build), local, anywhere migrations run | Direct (non-pooled) Postgres URL. Optional; falls back to `DATABASE_URL`. |
| `APP_BASE_URL` | web + worker | Canonical public origin (Sprint 1). Keep in sync with `NEXTAUTH_URL`. |
| `APP_BRAND_NAME` | web (build time) | Sprint 1. |
| `APP_PRIVATE_INSTANCE` | web | `true` on staging + production. |
| `ALLOWED_EMAILS` | web | The Lovve operator addresses. Enforced in `lib/auth.ts`. |

`ENCRYPTION_KEY` must be **byte-identical** on Vercel and Railway for each env,
and different between staging and production.

---

## 7. Acceptance check — job round trip

Sprint 2 requires proof that a job flows API → Redis → worker → database.

```
# with the worker running against the same REDIS_URL + DATABASE_URL:
npm run smoke:job
```

`scripts/smoke-job.ts` enqueues a `healthcheck` BullMQ job; the worker
(`processHealthcheckJob`) writes one `OperationalEvent` row
(`source = SYSTEM`, `level = INFO`, message contains the nonce). The script
polls for that row and exits 0 on success, 1 on timeout. Safe to run in
production — it makes no Instagram calls.

Also hit `/api/health`:

```
curl -s https://<domain>/api/health | jq
```

Expect `status: "ok"` and `checks.worker.healthy: true`. The endpoint is
unauthenticated, so as of this sprint every `detail` / `error` string is passed
through `redactSecrets()` — connection strings and `key=value` secrets are
scrubbed before the response leaves the server (`lib/ops/redact.ts`).

---

## 8. Monitoring & alerts (interim — formalized in Sprint 18)

| Signal | Interim wiring |
| --- | --- |
| Web/API down, DB down, Redis down, worker no heartbeat | External uptime monitor (UptimeRobot / Better Stack) on `GET /api/health`, alert on non-200 (it returns **503** when degraded). |
| Worker job failures | `OperationalEvent` rows (`source = WORKER`, `level = ERROR`) + `getWorkerAlerts()` (last 25 in Redis). Surfaced on `/diagnostics`. |
| Token near expiry | Daily `refresh-tokens` cron; failures logged as `OperationalEvent`. |
| Meta error rate, Lightspeed webhook failures, reconciliation drift | Not yet — Sprints 8 & 18. |

---

## 9. Local development

Unchanged:

```
docker-compose up -d          # postgres + redis
cp .env.example .env          # fill in Meta creds; DIRECT_URL can stay unset
npm run db:migrate
npm run dev                   # web
npm run worker                # worker, separate terminal
npm run smoke:job             # optional round-trip check
```
