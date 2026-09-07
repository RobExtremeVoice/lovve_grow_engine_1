# Lovve Growth Engine — Meta App & Instagram (Sprint 3)

The Instagram integration code is inherited from OpenReply and unchanged in
substance. This is the Lovve-specific setup on top of it. The generic,
click-by-click Meta console walkthrough lives in **[docs/setup.md](setup.md)
Steps 4–9** — follow that for the mechanics; this file adds the Lovve values,
the two-app strategy, and the go-live order.

Run this first, with the deployed web app's environment, to get the exact
strings and catch missing vars:

```
npm run check:meta
```

---

## 1. Two apps, in sequence

| Phase | Meta app | Instagram account | Mode |
| --- | --- | --- | --- |
| **Now — build & App Review** | a dedicated test app | a throwaway test Business/Creator account | Development, then Live for testers |
| **Later — production** | a second, dedicated app | `@lovve.brazilian.store` | Live, Advanced Access after review |

Do **not** connect `@lovve.brazilian.store` until App Review has passed on the
test app and the production app is created and published. Connecting the real
account to a Development-mode app burns time and can trip account flags.

---

## 2. App configuration (both apps)

- **App type:** Business.
- **Use case:** *Manage messaging and content on Instagram*. Not "Marketing
  API", not "Facebook Login" — this app uses **Instagram Login**.
- **Products:** Instagram → *API setup with Instagram login*.

### Redirect URI (Instagram → Business login settings → OAuth redirect URIs)

```
https://lovve-grow-engine-1.vercel.app/api/instagram/callback
```

Exact, no trailing slash. Must match `NEXTAUTH_URL` on the web app. When the
production domain moves to `growth.lovvestore.com`, add that callback too (keep
both listed) and update `NEXTAUTH_URL`.

### Webhook (Instagram → Configure webhooks)

| Field | Value |
| --- | --- |
| Callback URL | `https://lovve-grow-engine-1.vercel.app/api/webhook` |
| Verify token | the value of `WEBHOOK_VERIFY_TOKEN` (any random string, same on both sides) |
| Subscribed fields | **`comments`** and **`messages`** |

`comments` drives comment-to-DM and public replies. `messages` drives inbound
DMs and Story replies (the "also reply when someone DMs these words" toggle used
by the `LOVE15` campaign). Subscribing to only `comments` makes that toggle look
enabled but silently never fire. These two fields are the source of truth in
`lib/meta/client.ts` → `WEBHOOK_SUBSCRIBED_FIELDS`.

The webhook signature is verified against **both** `INSTAGRAM_APP_SECRET` and
`FACEBOOK_APP_SECRET` (`lib/meta/webhook.ts`), so set both — no need to guess
which one Meta signs with. A mismatch is logged as an `OperationalEvent`
(`level: WARNING`) and returns 401, visible on `/diagnostics`.

### Scopes (requested automatically at connect — `lib/meta/oauth.ts` → `INSTAGRAM_OAUTH_SCOPES`)

```
instagram_business_basic
instagram_business_manage_messages
instagram_business_manage_comments
instagram_business_manage_insights
```

`instagram_business_manage_insights` is needed for the daily follower snapshots
in reports. If you skip it in App Review, the follower funnel numbers stop
updating; everything else still works.

---

## 3. Tester-account dance (both halves are required)

Standard Access — which a published app still has until App Review grants
Advanced Access — only covers accounts with a role on the app.

1. **Meta side:** App dashboard → App roles → Roles → *Instagram testers* → add
   the exact Instagram username → send invite.
2. **Instagram side:** open Instagram as that account → Settings and activity →
   Apps and websites → *Tester invites* → **Accept**.

Until step 2, the login fails with "Insufficient Developer Role". The account
must be Business or Creator, not personal. Repeat both halves once per account.

---

## 4. Publish

Meta requires these URLs before the Publish toggle unlocks — all live and
Lovve-branded (Sprint 1):

```
Privacy policy:  https://lovve-grow-engine-1.vercel.app/privacy
Terms:           https://lovve-grow-engine-1.vercel.app/terms
Data deletion:   https://lovve-grow-engine-1.vercel.app/data-deletion
```

Real comment webhooks are delivered **only when the app is Live**. In
Development mode only the console's "Send to My Server" test button delivers
events.

---

## 5. App Review

Needed only to let non-tester accounts connect (i.e. before
`@lovve.brazilian.store` connects to the production app, unless it is added as a
tester there). See **[META_APP_REVIEW.md](../META_APP_REVIEW.md)** for the
permission justifications and the screencast script (recorded on the published
app, real accounts, `LOVE15` keyword, ~2–3 min).

Meta usually requires **business verification** (a legal-entity document) before
Advanced Access. Have Lovve Brazilian Store's registration ready.

---

## 6. Connect order for production

1. Production Meta app created, configured (§2), published (§4).
2. App Review passed on the test app; same submission re-used or re-run for the
   production app.
3. `NEXTAUTH_URL` / redirect URI / webhook URL all pointed at the production
   domain.
4. `@lovve.brazilian.store` added as an Instagram tester on the production app
   **or** Advanced Access granted.
5. Sign in to the dashboard → Settings → Connect Instagram → authorize.
6. Verify: `/api/health` → `worker.healthy: true`; `npm run smoke:job` passes;
   the console "Send to My Server" test for `comments` produces a `WebhookEvent`
   row.

---

## 7. What the code already guarantees (Sprint 3 acceptance)

| Requirement | Where |
| --- | --- |
| No user gets the same automation twice for one event | Deterministic BullMQ `jobId` per comment/message/postback in `app/api/webhook/route.ts`; `DmLog` unique on `[automationId, commentId]`. Tested in `__tests__/webhook-route.test.ts`. |
| Self-comments ignored | `parseCommentEvents` drops `from.id === entry.id`. Tested in `webhook.test.ts`. |
| Failures visible | `WebhookEvent.status`, `OperationalEvent`, `DmLog.errorMessage` → `/logs` and `/diagnostics`. |
| Token stored encrypted | AES-256-GCM in `lib/meta/oauth.ts`; only the encrypted blob is persisted. Tested in `oauth.test.ts`. |
| Token renewal | `refresh-tokens` cron refreshes 10 days before expiry; failures logged. |
| OAuth CSRF / replay | Signed `state` with a 10-minute expiry (`verifyOAuthState`). Tested in `oauth.test.ts`. |
| Logs don't leak secrets | `/api/health` details run through `redactSecrets` (Sprint 2); webhook failure log stores only a 200-char body preview. |
| Worker offline → recovery | Comment reconciler sweeps missed comments on an interval when the worker comes back (`lib/polling/comment-reconciler.ts`, tested). |
