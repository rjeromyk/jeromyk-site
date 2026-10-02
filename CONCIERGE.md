# JK Concierge — AI chat for jeromykovatana.com

## Asset requests and optional newsletter

`POST /subscribe` now records two separate purposes: the requested playbook,
checklist or calculator results, and an optional request for **Insurance Lead
Notes**. Newsletter permission is unchecked by default and must be an actual
JSON boolean. When true, it requires `consent_version: "jeromyk-newsletter-v1"`.
Omitting permission is equivalent to false; strings/numbers/null are rejected.

The approved v1 label is **“Also send me Jeromy’s Insurance Lead Notes.”** Its
description is **“Practical follow-up systems, vendor checks, and agent math for
insurance agents and agency operators. Occasional emails from Jeromy Kovatana.
Unsubscribe anytime.”** Site publication and the dedicated empty newsletter
group/configuration were approved October 2, 2026 at 01:55 UTC. Email contents
and sends remain on hold. The server records these canonical strings and
version; client-supplied consent text cannot override them.

The server appends private request and outcome records to
`CONCIERGE_DATA_DIR/subscribe-requests.jsonl` (mode 0600), using thread/process
locks and file/directory `fsync` before provider effects. On Railway this must use
the existing persistent volume; the local app-directory fallback is ephemeral
across redeployment. Records include timestamp, source, allowed origin, safe
page path without query/fragment, requested asset, and purpose-specific
permission. Optional `page` is a self-reported pathname of at most 240 characters,
accepted only with an allowed Origin; invalid/missing values fall back to a safe
referrer pathname. `page_path_source` identifies `client` or `referer` attribution.
Neither source grants access or permissions. Only bounded calculator
`fields.funnel_snapshot` is accepted; it is stored only in the private journal,
never forwarded to MailerLite or stdout telemetry. The journal's `request_id`,
email and exact snapshot are authoritative for any later approved calculator
fulfillment; provider profile fields are not per-request fulfillment records.
No public journal review/replay route is exposed.

Existing asset MailerLite group IDs remain unchanged. The backend first checks
subscriber status, leaves unsubscribed/bounced/junk/unconfirmed contacts
unchanged, and never passes `status` or `resubscribe`. Newsletter enrollment uses
only the separately approved `MAILERLITE_NEWSLETTER_GROUP_ID`, unset by default.
Asset group IDs are rejected as newsletter destinations. Do not reuse the
legacy Free Lead Ads Swipe group. No group, automation, campaign or live variable
is created or changed by the backend code; dedicated empty-group configuration
is a separately approved setup step.

After durable capture, the response is:

```json
{
  "ok": true,
  "delivery": {"status": "captured", "email_sent": false},
  "newsletter": {"status": "pending", "reason": "not_configured"}
}
```

Newsletter status is `not_requested` when unchecked, `pending` when unavailable
or suppressed, and `subscribed` only after a confirmed active provider record and
successful assignment to the dedicated group. Provider failures preserve the
capture and do not block browser PDF access. `captured` means the request was
recorded; it never claims an email was sent. Initial journal failure returns
503 before provider calls. If recording the outcome fails after a provider call,
503 is returned and the initial request remains for manual reconciliation.

**Email sends remain held:** specific asset-delivery automation, calculator
fulfillment and newsletter email contents/sending plans require separate
verification and approval. Pending records are retained requests, not a running
dispatch queue. New explicit opt-ins may join the approved dedicated group;
existing contacts are not enrolled. Reconciliation, replay and any email dispatch
require separate explicit approval; deployment does not flush pending records.
No automatic outreach or delivery worker was added.

Offline backend regressions (stdlib only, temporary journals, mocked HTTP;
never real contacts, credentials or provider calls):

```sh
python3 -B -m unittest discover -s tests -p 'test_subscribe.py' -v
```

The floating chat widget on the homepage ("the HOW?! feature"). Two pieces:

| Piece | Location | Status |
|---|---|---|
| Frontend widget | `concierge.js` + `concierge.css`, wired into `index.html` | Deployed on the canonical Vercel site; last verified September 30, 2026 |
| Backend API | `concierge-server/` (this repo) → Railway service | Deployed on the existing Railway production service; last verified September 30, 2026 |

## How it works

```
visitor → widget (concierge.js) → POST {message, history} → concierge-server:8090/chat
                                                              → Muse Spark (Meta Model API), with Claude Haiku (Anthropic) as automatic fallback
                                                              → {"reply", "cta"?, "provider", "fallback"} → widget renders
```

- The widget sends the visitor's message plus the last 10 turns of history as JSON.
- The server answers from `concierge-server/knowledge.md` (compiled from this site's real content — services, verified proof figures, FAQs, playbook, about story, /contact). It never invents prices, guarantees, CPL, or timelines.
- When the visitor shows booking intent (book/call/price/start…, calculator numbers, funnel talk), the response includes a CTA button: **"Get your free funnel teardown →"** → `/contact#book` (deep-links straight onto the booking calendar).
- If the backend is unreachable, the widget degrades gracefully: *"Looks like I'm offline right now…"* + a button to `/contact#book`. No dead chat, no errors.

## Proactive openers (the widget starts conversations now)

The chat no longer waits to be opened. Two dismissible teaser bubbles (one line each, never the full panel), each shown at most once per session:

| Trigger | Teaser copy | Click behavior |
|---|---|---|
| ~35s on page, zero interaction | "You running ads right now, or still figuring out lead gen?" | Opens chat with that line as the opener |
| Funnel calculator completed (leads + spend + closes entered, no errors) | "Those numbers have room. Want me to show you where it's leaking?" | Opens chat, then auto-sends the visitor's numbers so the concierge runs the teardown |

Wiring: `redesign.js` calls `window.JeromyConcierge.calculatorDone(results)` once per page view (also listens for a `jk:calculator-done` CustomEvent as fallback). Teaser state lives in `sessionStorage`; opening the panel manually dismisses any teaser.

## Diagnosis flow (the offer is a live teardown)

The system prompt's `DIAGNOSIS` section reframes the offer: not "book a call" but **"Jeromy tears down your funnel live."** When a visitor shares numbers (typed, or auto-sent from the calculator):

1. The concierge asks for what's missing — at most weekly leads, pickups, closes — **one question per reply**, reusing anything already given.
2. Then the read, 3 short sentences max: weakest stage from *their* math, the math flipped to show what good looks like, then the book: *"Want Jeromy to tear down your funnel live? He'll map exactly where it's leaking."*
3. It never invents industry benchmarks — stages are compared against each other, never against made-up averages.

## Non-booker capture (POST /lead, GET /leads)

When a visitor declines the booking CTA ("no thanks", "not interested", …), the concierge says *"No worries. Leave your number and Jeromy will text you himself."* and the widget renders an inline capture card (name + cell/email). Submit posts to:

```
POST /lead   {"name", "contact", "context":[recent visitor messages, truncated]}
→ {"ok": true}
```

- Same rate limit as `/chat`. Validates: name 1–100 chars, contact must be an email or a phone number (7+ digits). `context` is capped server-side (6 messages × 200 chars).
- Stored as JSONL at `CONCIERGE_DATA_DIR/leads.jsonl`. The existing Railway production volume uses `/data` and preserves records across redeploys. The app-directory fallback is for local development and is ephemeral on redeployment. Review and privately back up both `leads.jsonl` and, when present, `subscribe-requests.jsonl` before an approved redeploy; preserve the existing volume and data-directory setting.
- **No auto-outreach anywhere.** Jeromy reviews and texts himself — the send gate holds.
- **Review:** `GET /leads?token=<CONCIERGE_LEADS_TOKEN>` returns `{"leads": [...]}`. Wrong or missing token → 404 (the endpoint doesn't advertise itself). Set the token as a Railway variable; it never appears in code or logs (logs carry a `lead_captured` event with IP hash only — never PII).

## Two models, one concierge

The backend runs **Muse Spark (Meta Model API) as the default**, with **Claude Haiku (Anthropic) as automatic fallback** — behind the same system prompt and knowledge base.

| Provider | Role | Model (default) | Key env var | Model override |
|---|---|---|---|---|
| `meta` (default) | primary | `muse-spark-1.1` | `META_API_KEY` | `META_MODEL` |
| `anthropic` | automatic fallback | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` | `CONCIERGE_MODEL` |

- **Default provider:** `CONCIERGE_PROVIDER` (`meta` or `anthropic`). Intended default is **`meta`**.
- **Automatic fallback (meta → anthropic):** if the Meta call fails — network error, non-200, or empty reply (the preview API's known occasional flakiness) — the server retries once with Haiku, provided `ANTHROPIC_API_KEY` is configured. If Haiku also fails (or has no key), the client gets the existing clean `502 concierge_unavailable`. There is no anthropic → meta fallback: an explicit `"provider": "anthropic"` request is honored as-is, and its failure is not retried elsewhere.
- **How you see it:** every reply carries `"provider"` (the model that *actually* answered) and `"fallback"` (boolean). A fallback reply looks like `{"reply": "...", "provider": "anthropic", "fallback": true}`. Fallback events are also logged (timestamp, IP hash, from → to, latency — never message content) so you can watch the rate in the service logs.
- **Meta Model API** (verified against dev.meta.ai/docs, 2026-09-27): base URL `https://api.meta.ai/v1` (overridable via `META_BASE_URL`), Bearer-token auth, OpenAI-compatible `/chat/completions`. Standard-tier models include `muse-spark-1.1`, `muse-spark-1.2`, `muse-spark-1.3` — set `META_MODEL=muse-spark-1.3` to test the newest. Note: Muse Spark always reasons and reasoning tokens bill against the output budget, so the server pins `reasoning_effort: minimal` to protect the 500-token reply cap.
- **Per-request override (for testing):** `POST /chat` accepts an optional `"provider": "anthropic" | "meta"` field. Still server-side rate-limited. Lets you flip between models in one session without redeploying or touching env. The widget doesn't send it (it posts `{message, history}` and gets the server default) — the field is purely additive.
- **`/healthz`** reports which providers are configured — booleans only, never key values:
  `{"ok": true, "default_provider": "meta", "providers": {"anthropic": {"configured": true, ...}, "meta": {"configured": true, ...}}, ...}`
- Every reply includes `"provider"` (the model that actually answered) and `"fallback"` (true when Haiku answered a failed Meta call). Request logs include provider + model + fallback status + token counts (never message content).

## Historical initial API-key setup

The existing production deployment is already configured. These original setup
notes explain the key variables; changing live keys/settings requires approval.

1. Go to **dev.meta.ai** → sign in → Model API dashboard.
2. Generate a key (`MODEL_API_KEY`). US public preview; new accounts get **$20 in free credits**.
3. Add it as `META_API_KEY` in the Railway service's Variables tab (`ANTHROPIC_API_KEY` likewise). **Never commit keys.**

Pricing (per Meta's launch coverage — verify at dev.meta.ai): ~$1.25 / 1M input tokens, ~$4.25 / 1M output tokens. A typical short chat is fractions of a cent on either provider.

## Current deployment workflow (last verified September 30, 2026)

The last verified published site used commit `0f5224f`; the production Railway
backend deployment was `7ae17b4f-b22b-4a9b-b3d2-bec39b468fcd`. These are historical
verification references, not a new check of today's live state. The image and
optional opt-in release was approved October 2, 2026 at 01:55 UTC; email contents
and sends remain separately held.

Vercel deploys the static site through the existing GitHub integration on
`main`. The verified Railway workflow uploads a fresh archive of the **exact
approved committed `concierge-server` content** using the Railway CLI `up`
command to the existing concierge service in the existing project's
`production` environment. Reuse the existing service, volume, variables and
public URL; do not create a replacement service or upload unrelated/uncommitted
working-tree files. The backend is separate from the GOAT Leads application.

For the approved release:

1. Review the exact combined diff, run the offline backend/frontend tests and
   static build, and create the approved commit. Privately back up the current
   `/data/leads.jsonl` and, when present, `/data/subscribe-requests.jsonl` without
   printing their contents. Preserve the existing volume mount and
   `CONCIERGE_DATA_DIR=/data` setting.
2. **Deploy the backend first**, from that committed backend archive via CLI
   `up`. Verify service health and the deployed response contract before pushing
   the frontend release to `main`. The old backend returns only `{"ok":true}`;
   the new frontend requires `delivery` and `newsletter` status objects and will
   treat the old response as a capture failure. Contract verification must not
   create real contacts or send email without explicit authorization.
3. After backend compatibility is verified, publish the approved frontend via
   the existing Vercel/GitHub integration. Verify the static artifacts and
   rendered forms. Configure only the separately approved dedicated empty
   newsletter group; setup approval does not authorize any email send.

A dedicated empty Insurance Lead Notes group and its configuration are approved;
set its returned ID as `MAILERLITE_NEWSLETTER_GROUP_ID`. Do not invent an ID or reuse
asset/legacy swipe groups. Existing asset-delivery and calculator-results email
automations must be independently verified and approved; this code adds no
automation. Pending journal reconciliation/replay/dispatch remains a separate
approval step.

The service is stdlib-only Python, with no pip dependencies or build step. It
binds `0.0.0.0` and reads `$PORT`; `CONCIERGE_PORT`/`8090` is the local override.
The deployed widget already points to
`https://concierge-production-6641.up.railway.app/chat`. Token-gated lead review
uses `CONCIERGE_LEADS_TOKEN`; never commit or print its value.


## Testing both models side by side

`concierge-server/test_both.py` sends the same 10 questions to both providers and prints replies side by side with latency and token counts. Five questions test **accuracy** (grounding traps: "What's your CPL?", "How much does it cost?", "Guarantee me 20% close rates" — the model must not invent prices/claims); five test **personality** (operator voice, warmth, the skeptical visitor, small talk). You judge the winner.

```bash
cd concierge-server
ANTHROPIC_API_KEY=<redacted> META_API_KEY=<redacted> python3 test_both.py
# save the comparison for later:
ANTHROPIC_API_KEY=... META_API_KEY=... python3 test_both.py --out model-compare.md
# test just one provider:
META_API_KEY=... python3 test_both.py --only meta
```

Providers without a key are skipped with a clear note. `CONCIERGE_MODEL` / `META_MODEL` / `META_BASE_URL` env vars are honored, so you can A/B model versions too (e.g. `META_MODEL=muse-spark-1.3`).

## Historical initial frontend wiring

The production URL is already wired as described above. This original example
documents the empty-URL fallback and is not the current production configuration.

In `concierge.js`, top of file:

```js
const CONCIERGE_CONFIG = {
  BACKEND_URL: "",   // ← set to the live API URL when deployed
  ...
};
```

Set `BACKEND_URL` to whichever public URL you chose above and redeploy the site. While it's `""`, the widget shows the graceful fallback (no failed requests).

## Cost estimate

- **Anthropic:** Claude Haiku (configurable via `CONCIERGE_MODEL`) — Anthropic's cheapest tier. A typical short chat conversation costs **well under a cent**. Even 1,000 conversations/month ≈ a few dollars. Verify current pricing at anthropic.com/pricing.
- **Meta:** Muse Spark via Model API — ~$1.25/1M input, ~$4.25/1M output tokens (per launch coverage; verify at dev.meta.ai). Same order of magnitude: fractions of a cent per chat. $20 in free credits covers a lot of testing.

## Guardrails (built into `server.py`)

- **Rate limit:** 20 requests / 60s per IP (in-memory sliding window; `CONCIERGE_RATE_LIMIT` / `CONCIERGE_RATE_WINDOW`). 429s beyond that. Applies to `/chat` and `/lead`, both providers, and per-request overrides.
- **History cap:** server truncates to the last 10 turns regardless of what the client sends; messages capped at 2,000 chars.
- **No PII logging:** logs carry timestamp, SHA-256 IP hash, message/reply lengths, provider, model, token counts, latency — never message content.
- **Prompt protection:** system prompt is never included in responses; LLM errors return a generic `concierge_unavailable` (no key state leaked). `/healthz` reports key *presence* as booleans only.
- **Stub mode:** `CONCIERGE_STUB=1` answers from canned replies with no API key — for testing the widget end-to-end without spending.

## Testing the widget against a stub

```bash
# terminal 1 — stub backend
CONCIERGE_STUB=1 CONCIERGE_CORS_ORIGIN=http://127.0.0.1:8000 python3 concierge-server/server.py
# terminal 2 — serve the site, point the widget at the stub
cd /Users/jeromykovatana/Projects/jeromyk/jeromyk-site
# temporarily set BACKEND_URL: "http://127.0.0.1:8090/chat" in concierge.js
python3 -m http.server 8000
# open http://127.0.0.1:8000, click the chat bubble, send a message
```

## Files

- `concierge.js` / `concierge.css` — the widget (all styles scoped under `#jk-concierge`)
- `concierge-server/server.py` — the API (stdlib only, dual-provider)
- `concierge-server/test_both.py` — side-by-side model comparison harness (stdlib only)
- `concierge-server/knowledge.md` — the knowledge base (edit facts here, no code changes)
- `concierge-server/concierge.service` — systemd unit
- `concierge-server/requirements.txt` — intentionally: stdlib only
