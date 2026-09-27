# JK Concierge — AI chat for jeromykovatana.com

The floating chat widget on the homepage ("the HOW?! feature"). Two pieces:

| Piece | Location | Status |
|---|---|---|
| Frontend widget | `concierge.js` + `concierge.css`, wired into `index.html` | ✅ On branch `redesign/homepage` |
| Backend API | `concierge-server/` (this repo, scaffold) → deploy to GOAT Leads app server | 🟡 Scaffold ready, not deployed |

## How it works

```
visitor → widget (concierge.js) → POST {message, history} → concierge-server:8090/chat
                                                              → Claude Haiku (Anthropic API)
                                                              → {"reply", "cta"?} → widget renders
```

- The widget sends the visitor's message plus the last 10 turns of history as JSON.
- The server answers from `concierge-server/knowledge.md` (compiled from this site's real content — services, verified proof figures, FAQs, playbook, about story, /contact). It never invents prices, guarantees, CPL, or timelines.
- When the visitor shows booking intent (book/call/price/start…), the response includes a CTA button: **"Book a free strategy call →"** → `/contact`.
- If the backend is unreachable (or not yet deployed), the widget degrades gracefully: *"Looks like I'm offline right now…"* + a button to `/contact`. No dead chat, no errors.

## What Jeromy must provide / approve before go-live (3 things)

1. **An Anthropic API key** — create at console.anthropic.com → API keys. It goes into `concierge.env` on the server as `ANTHROPIC_API_KEY`. **Never commit it to the repo.** (This is the only secret.)
2. **Hosting approval** — permission to run the service on the GOAT Leads app server (`45.33.11.54`) as the `deploy` user, and to expose it publicly via ONE of the two options below.
3. **A 5-minute content review** of `concierge-server/knowledge.md` — it's compiled from the site, but confirm the fit criteria ($50K+/month) and proof figures read the way you want an AI saying them.

## Backend: hosting steps

The service is stdlib-only Python — no pip, no build step.

```bash
# on the app server, as deploy
mkdir -p /home/deploy/concierge && cd /home/deploy/concierge
# copy server.py, knowledge.md from this repo's concierge-server/
cat > concierge.env <<'EOF'
ANTHROPIC_API_KEY=sk-ant-...          # <-- Jeromy provides
CONCIERGE_MODEL=claude-haiku-4-5      # verify current Haiku model ID at docs.anthropic.com
CONCIERGE_CORS_ORIGIN=https://www.jeromykovatana.com
CONCIERGE_PORT=8090
EOF
chmod 600 concierge.env
sudo cp concierge.service /etc/systemd/system/ && sudo systemctl daemon-reload
sudo systemctl enable --now concierge
curl -s http://127.0.0.1:8090/healthz   # {"ok": true, ...}
```

### Exposing it publicly — pick one

**Option A (recommended): reverse-proxy through existing nginx.**
Needs root (nginx is root-managed). Add a location block so the widget hits same-origin-ish HTTPS:

```nginx
location /concierge/ {
    proxy_pass http://127.0.0.1:8090/;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

Then the widget's `BACKEND_URL` = `https://crm.goatleads.com/concierge/chat`. No firewall changes, no new TLS.

**Option B: open the port in the Linode cloud firewall.**
Verified 2026-09-27: arbitrary ports (tested 8443) are **blocked from the public internet** despite no host firewall (`ufw` inactive) — the block is upstream. In Linode Cloud Manager → Network → Firewalls → the firewall attached to the GOAT Leads server → add an inbound rule: TCP, port 8090, source `0.0.0.0/0`. Then `BACKEND_URL` = `http://45.33.11.54:8090/chat` (plain HTTP unless you terminate TLS yourself — Option A is better for this reason).

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

Model: Claude Haiku (configurable via `CONCIERGE_MODEL`). Haiku is Anthropic's cheapest tier — a typical short chat conversation costs **well under a cent** (fractions of a cent). Even 1,000 conversations/month ≈ a few dollars. Verify current pricing at anthropic.com/pricing — the model ID default (`claude-haiku-4-5`) should also be confirmed against docs.anthropic.com, as model names rotate.

## Guardrails (built into `server.py`)

- **Rate limit:** 20 requests / 60s per IP (in-memory sliding window; `CONCIERGE_RATE_LIMIT` / `CONCIERGE_RATE_WINDOW`). 429s beyond that.
- **History cap:** server truncates to the last 10 turns regardless of what the client sends; messages capped at 2,000 chars.
- **No PII logging:** logs carry timestamp, SHA-256 IP hash, message/reply lengths, model, latency — never message content.
- **Prompt protection:** system prompt is never included in responses; LLM errors return a generic `concierge_unavailable` (no key state leaked).
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
- `concierge-server/server.py` — the API (stdlib only)
- `concierge-server/knowledge.md` — the knowledge base (edit facts here, no code changes)
- `concierge-server/concierge.service` — systemd unit
- `concierge-server/requirements.txt` — intentionally: stdlib only
