# Lovve Growth Engine — Architecture & Baseline

This document is the running architectural record for the Lovve Growth Engine,
a private build on top of [OpenReply](https://github.com/diwenne/openreply). It
is maintained sprint by sprint per `LOVVE_GROWTH_ENGINE_IMPLEMENTATION.md`.

The guiding rule: **preserve the OpenReply core**. Every addition lands behind a
feature flag (off by default) and as an incremental Prisma migration, so the
fork stays synchronizable with upstream.

---

## 1. Repository & remotes

| Remote | URL |
| --- | --- |
| `origin` | `https://github.com/RobExtremeVoice/lovve_grow_engine_1` |
| `upstream` | `https://github.com/diwenne/openreply.git` |

Branch model: `main` (production), `develop` (staging/integration),
`feature/*`, `fix/*`, `chore/*`.

Baseline commit for this work: `f180d2d` (per the blueprint), current `main`
includes later upstream commits through `15ba231`.

---

## 2. Stack (inherited from OpenReply, unchanged)

| Layer | Tool |
| --- | --- |
| Framework | Next.js 16 (App Router, Turbopack) + React 19 |
| Language | TypeScript 5 (`strict`) |
| ORM / DB | Prisma 7 (`@prisma/adapter-pg`), PostgreSQL |
| Queue | BullMQ 5 on Redis (`ioredis`) |
| Auth | Auth.js / NextAuth 5 — email magic links |
| Email | Resend (or SMTP via `EMAIL_SERVER`) |
| Validation | Zod 4 |
| Charts | Recharts 3 |
| Styling | Tailwind CSS 4 |
| Tests | Vitest 4 |
| Worker runtime | `tsx` running `worker/dm-worker.ts` |
| Instagram | Official Meta Graph API (Instagram Login) |

Read `AGENTS.md` and the local Next.js 16 docs under
`node_modules/next/dist/docs/` before editing any API route or component — this
Next.js version carries breaking changes from older releases.

---

## 3. Runtime topology

Two processes, two datastores (see `docs/stack.md`):

- **Web app + API** (`next dev` / `next start`, Vercel-friendly): dashboard, the
  Instagram OAuth callback, and the inbound Meta webhook (`/api/webhook`).
- **Worker** (`npm run worker`, must be always-on — Railway / a VM): drains the
  BullMQ send queue, sends DMs and public replies, runs the polling comment
  reconciler, and performs the follow-gate `is_user_follow_business` checks.
- **PostgreSQL**: campaigns, DM logs, accounts, sessions, tracked links, clicks,
  webhook events, operational events, follower snapshots.
- **Redis**: BullMQ send queue + per-account rate limiter (native TCP protocol
  required — an HTTP-only Redis will not work).

Web and worker must share `DATABASE_URL`, `REDIS_URL`, and `ENCRYPTION_KEY`.

```
Meta Webhooks ──▶ Next.js API ──▶ Postgres
                      │             ▲
                      ▼             │
                    Redis ──▶ Worker ──▶ Meta Instagram API
```

---

## 4. Code inventory

### `app/`
- `app/(dashboard)/` — authenticated UI: `campaigns`, `automations`, `dashboard`,
  `overview`, `inbox`, `logs`, `diagnostics`, `settings`.
- `app/api/`
  - `webhook/route.ts` — Meta webhook verify (GET) + event intake (POST).
  - `instagram/*` — OAuth connect/callback/disconnect, accounts, conversations,
    posts, profile, overview.
  - `cron/*` — `refresh-tokens`, `attach-next-reel`, `snapshot-followers`
    (scheduled in `vercel.json`, guarded by `CRON_SECRET`).
  - `automations/*` — CRUD, `duplicate`, `import`.
  - `dashboard/stats`, `logs`, `health`, `admin/diagnostics`,
    `workspace/{invitations,members}`, `auth/[...nextauth]`.
- Public / legal pages: `privacy`, `terms`, `data-deletion`, `meta-review`, plus
  marketing/SEO pages (`manychat-alternative`, `comment-link-automation`, …).
- `app/generated/prisma/` — generated Prisma client (gitignored).

### `lib/`
| Path | Responsibility |
| --- | --- |
| `env.ts` | Env access helpers, encryption-key check, sign-in allowlist, core env Zod schema |
| `feature-flags.ts` | **Lovve** — feature-flag reads (added Sprint 0) |
| `auth.ts` | NextAuth config |
| `db/client.ts` | Prisma client singleton (pg adapter) |
| `queue/client.ts`, `queue/dm-worker.ts` | BullMQ queue + the send/processing logic |
| `meta/client.ts` | Meta Graph API calls (send DM, public reply, follow check) |
| `meta/oauth.ts` | Instagram OAuth exchange + token encryption |
| `meta/webhook.ts` | Webhook signature verification + payload parsing |
| `polling/comment-reconciler.ts` | Fallback comment sweep when webhooks miss |
| `utils/keyword-matcher.ts` | Unicode-aware keyword matching (incl. Arabic script, diacritic folding) |
| `utils/rate-limiter.ts` | Per-account Meta rate limiting |
| `utils/csv.ts` | CSV export |
| `campaigns/duplicate.ts` | Deep-copy a campaign with all settings |
| `templates/campaign-templates.ts` | Preset campaign definitions |
| `tracking/*` | Tracked-link redirect, click analytics, message assembly |
| `reports/*` | Report data, shareable report slugs, follower history |
| `instagram-accounts.ts`, `workspace*.ts`, `billing/usage.ts` | Multi-tenant access + usage counters |
| `ops/worker-health.ts` | Worker heartbeat / health |

### `worker/dm-worker.ts`
Thin entrypoint that runs the BullMQ processor from `lib/queue/dm-worker.ts`.

### `__tests__/` (Vitest, 17 files)
`dm-worker`, `webhook`, `oauth`, `keyword-matcher` (+ Arabic-script variant),
`tracking`, `redirect`, `rate-limiter`, `reports`, `templates`, `csv`, `usage`,
`env`, `agency-workspaces`, `campaign-duplicate`, `comment-reconciler`,
`follower-history`, and **`feature-flags`** (added Sprint 0).

---

## 5. Data model (current)

Core Prisma models (`prisma/schema.prisma`, 18 migrations applied):

- **Auth / tenancy**: `User`, `Account`, `Session`, `VerificationToken`,
  `Workspace`, `WorkspaceMember`, `WorkspaceInvitation` (`WorkspaceRole`).
- **Instagram**: `InstagramAccount` (encrypted `accessToken`),
  `FollowerSnapshot`.
- **Automation**: `Automation` (keywords, opening DM, follow gate, follow-up,
  public reply, DM keyword trigger), `DmLog` (unique on
  `[automationId, commentId]`, `DmStatus`), legacy unwired `ProcessedComment`.
- **Tracking**: `TrackedLink`, `LinkClick`.
- **Ops**: `WebhookEvent` (`WebhookStatus`), `OperationalEvent`
  (`OperationalEventSource` / `Level`).

Every business entity is scoped by `workspaceId` (and `instagramAccountId` where
relevant). New Lovve entities must follow the same convention.

### Planned Lovve additions (not yet built)

| Sprint | Entities |
| --- | --- |
| 4 — New Follower Offer | `InstagramContact` (`FollowStatus` enum), follow-status tracking on the acquisition flow |
| 6 — Referrals | `ReferralCode`, `Referral` (`ReferralStatus` enum) |
| 7 — Outreach Assistant | `OutreachProspect`, `OutreachDraft`, `OutreachActivity`, `OutreachDoNotContact` |
| 8 — Lightspeed | `Coupon`, `CouponRedemption`, `CommerceCustomer`, `CommerceOrder`, `CommerceWebhookEvent`, `RewardLedger` (append-only) |

---

## 6. Feature flags

Process-level flags read from the environment via `lib/feature-flags.ts`.
**All default to off**; an unset or non-truthy value reads as `false`, so an
existing OpenReply deployment is unaffected. Truthy spellings: `1`, `true`,
`yes`, `on` (case- and whitespace-insensitive).

| Flag key | Env var | Gates |
| --- | --- | --- |
| `newFollowerOffer` | `FEATURE_NEW_FOLLOWER_OFFER` | Sprint 4 — new-follower acquisition offer |
| `referrals` | `FEATURE_REFERRALS` | Sprint 6 — "Share the Lovve" referral program |
| `outreachAssistant` | `FEATURE_OUTREACH_ASSISTANT` | Sprint 7 — outreach draft/approval queue |
| `lightspeed` | `FEATURE_LIGHTSPEED` | Sprint 8 — Lightspeed commerce sync |

```ts
import { isFeatureEnabled } from "@/lib/feature-flags";
if (isFeatureEnabled("newFollowerOffer")) { /* Lovve path */ }
```

No runtime code branches on these yet. Per-workspace / per-account overrides can
layer on later, using the env value as the default.

### Other planned env vars (not added until their sprint)

`APP_BRAND_NAME`, `APP_BASE_URL` (Sprint 1); `LIGHTSPEED_*`,
`DEFAULT_NEW_FOLLOWER_DISCOUNT_PERCENT`, `DEFAULT_OFFER_EXPIRY_HOURS`,
`DEFAULT_REFERRER_CREDIT_CENTS` (Sprints 6/8). Real values never go in
`.env.example`.

---

## 7. Known divergences to resolve in later sprints

- **Follow gate on `UNKNOWN` status.** OpenReply's follow gate *fails open* —
  it sends the link when Instagram does not return follow status, so a real
  follower is never trapped. The blueprint's Sprint 4 acquisition offer instead
  wants **fail-closed** for the *discount* specifically (`initialFollowStatus`
  must be observed `false` → `true`). Sprint 4 must keep the existing
  fail-open behaviour for plain link delivery while gating the *coupon* on an
  explicitly observed conversion.
- **`DmLog` as the only per-person state.** Sprint 4 introduces
  `InstagramContact` as the durable per-person/per-account record rather than
  overloading `DmLog`.

---

## 8. CI & quality gates

`.github/workflows/ci.yml` runs on push/PR to `main`: `npm ci` → Prisma
generate → **typecheck → lint → test → build**. Every sprint must leave all
four green:

```
npm run typecheck
npm run lint
npm test
npm run build
```

---

## 9. Sprint 0 baseline (recorded 2026-09-05)

Established on a clean `npm ci` install:

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass (no warnings) |
| `npm test` | **196 passed** / 18 files (191 upstream + 5 new `feature-flags` cases) |
| `npm run build` | pass |

Changes in Sprint 0 (no runtime behaviour change):

- Added `lib/feature-flags.ts` + `__tests__/feature-flags.test.ts`.
- Added the four `FEATURE_*` keys to `.env.example` (all `false`).
- Added this document.
- CI already covered typecheck/lint/test/build — left as-is.
- Verified no secrets are tracked (`.env*` is gitignored except `.env.example`).
