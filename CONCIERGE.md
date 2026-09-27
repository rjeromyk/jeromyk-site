# JK Concierge — AI chat for jeromykovatana.com

The floating chat widget on the homepage ("the HOW?! feature"). Two pieces:

| Piece | Location | Status |
|---|---|---|
| Frontend widget | `concierge.js` + `concierge.css`, wired into `index.html` | ✅ On branch `redesign/homepage` |
| Backend API | `concierge-server/` (this repo) → Railway service | 🟡 Railway-ready, not deployed |

## How it works

```
visitor → widget (concierge.js) → POST {message, history} → concierge-server:8090/chat
                                                              → Muse Spark (Meta Model API), with Claude Haiku (Anthropic) as automatic fallback
                                                              → {"reply", "cta"?, "provider", "fallback"} → widget renders
```

- The widget sends the visitor's message plus the last 10 turns of history as JSON.
- The server answers from `concierge-server/knowledge.md` (compiled from this site's real content — services, verified proof figures, FAQs, playbook, about story, /contact). It never invents prices, guarantees, CPL, or timelines.
- When the visitor shows booking intent (book/call/price/start…), the response includes a CTA button: **"Book a free strategy call →"** → `/contact`.
- If the backend is unreachable (or not yet deployed), the widget degrades gracefully: *"Looks like I'm offline right now…"* + a button to `/contact`. No dead chat, no errors.

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

## Getting the Meta Model API key

1. Go to **dev.meta.ai** → sign in → Model API dashboard.
2. Generate a key (`MODEL_API_KEY`). US public preview; new accounts get **$20 in free credits**.
3. Add it as `META_API_KEY` in the Railway service's Variables tab (`ANTHROPIC_API_KEY` likewise). **Never commit keys.**

Pricing (per Meta's launch coverage — verify at dev.meta.ai): ~$1.25 / 1M input tokens, ~$4.25 / 1M output tokens. A typical short chat is fractions of a cent on either provider.

## What Jeromy must provide / approve before go-live

1. **API keys — both recommended.** Anthropic: console.anthropic.com → API keys → `ANTHROPIC_API_KEY`. Meta: dev.meta.ai → Model API dashboard → `META_API_KEY`. Keys go in `concierge.env` on the server (mode 0600). **Never commit them.** The automatic fallback needs the Anthropic key even though Meta is the default; for the side-by-side test you need both.
2. **Railway service** — approved 2026-09-27 (NOT the GOAT Leads app server, deliberately). Deploy as a new service in the existing Railway workspace (the one holding `ad-campaigns`), from GitHub repo `rjeromyk/jeromyk-site`, root directory `concierge-server`, branch `redesign/homepage` until the redesign merges. Env vars go in the Railway dashboard Variables tab.
3. **A 5-minute content review** of `concierge-server/knowledge.md` — it's compiled from the site, but confirm the fit criteria ($50K+/month) and proof figures read the way you want an AI saying them.

## Backend: hosting on Railway

The service is stdlib-only Python — no pip, no build step. It binds `0.0.0.0` and reads the port from `$PORT` (injected by Railway; `CONCIERGE_PORT`/`8090` remains the local-dev override).

**One-time setup** (Railway dashboard; the Studio's `railway` CLI is logged in as Jeromy if you prefer terminal):
1. In the existing workspace (the one holding `ad-campaigns`), create a new service → **Deploy from GitHub repo** → `rjeromyk/jeromyk-site`.
2. Service Settings → **Root Directory**: `concierge-server`. **Branch**: `redesign/homepage` (switch to `main` after the redesign merges).
3. Variables tab → add:
   - `META_API_KEY` = key from dev.meta.ai (required — default provider)
   - `ANTHROPIC_API_KEY` = key from console.anthropic.com (required — automatic fallback)
   - `CONCIERGE_PROVIDER` = `meta`
   - `CONCIERGE_CORS_ORIGIN` = `https://www.jeromykovatana.com`
   - optional: `META_MODEL` = `muse-spark-1.3`, `CONCIERGE_MODEL` = `claude-haiku-4-5`
4. Deploy. Railway assigns a public HTTPS URL like `https://<service>.up.railway.app`; the healthcheck hits `GET /healthz`.
5. Verify: `curl -s https://<service>.up.railway.app/healthz` → `{"ok": true, "default_provider": "meta", "providers": {...}}` (key presence as booleans only).

**Frontend wiring:** in `concierge.js`, set `CONCIERGE_CONFIG.BACKEND_URL` to `https://<service>.up.railway.app/chat` and redeploy the site. While it's `""`, the widget shows the graceful fallback (no failed requests).

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

## Frontend wiring

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

- **Rate limit:** 20 requests / 60s per IP (in-memory sliding window; `CONCIERGE_RATE_LIMIT` / `CONCIERGE_RATE_WINDOW`). 429s beyond that. Applies to both providers and to per-request overrides.
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
