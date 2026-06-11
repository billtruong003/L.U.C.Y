---
name: omniroute-vm-hosting
description: How OmniRoute (LLM router) is self-hosted on the VPS to serve Claude OAuth for Lucy/Hermes
metadata: 
  node_type: memory
  type: project
  originSessionId: 65489fed-5a35-429e-b2e6-9ec44b3946e4
---

OmniRoute = self-hosted unified LLM proxy that fronts Claude OAuth (and other providers) for Lucy/Hermes. Source = jmvb stable fork **v3.8.7** (private repo `jmvbambico/OmniRoute`; user `billtruong003`/truongbill003 has NO access — got it via a Google Drive zip). Extracted at `/root/OmniRoute`.

**Hosting (the "VM version" = Docker):** building the fork from source OOM-thrashes this 2 vCPU / 2 GB VPS (Next.js Turbopack build), so we run the prebuilt upstream image instead — same app + same Claude OAuth feature:
```
docker run -d --name omniroute --restart unless-stopped \
  --env-file /opt/omniroute/.env -p 20128:20128 \
  -v omniroute-data:/app/data diegosouzapw/omniroute:latest
```
- Endpoints on `localhost:20128`: `/v1/messages` (Anthropic), `/v1/chat/completions` (OpenAI), `/v1/models`, dashboard at `/`.
- `/opt/omniroute/.env` holds JWT/secrets + `INITIAL_PASSWORD` (dashboard login). `REQUIRE_API_KEY=false` → any token accepted for inference.
- Added 6 GB swapfile (`/swapfile2`) so builds don't OOM-kill.

**Claude OAuth:** logged in via dashboard flow — `GET /api/oauth/claude/authorize` → user authorizes at claude.ai → paste `code#state` → `POST /api/oauth/claude/exchange`. Connected account: truongbill003@gmail.com (connection `3e95d504-dc5e-43f4-9bbd-41ff824b0703`). Model id to use: `cc/claude-opus-4-8` (cc = the OAuth connection).

**Brain decision (2026-06-02):** Claude Max OAuth does NOT work for real Hermes bot traffic (Anthropic meters persona+tools payload → 400 "out of extra usage"; small/canonical requests pass only because OmniRoute swaps in a ~2034-tok canonical Claude Code system prompt). Defeating that = ToS/billing evasion → declined. Instead Lucy runs on **`xai/grok-4.3`** via an **xAI API key** added as an OmniRoute `xai` connection (id `cfce2240…`; key file `/opt/omniroute/.xai_key` — user pasted it in chat, should rotate). Verified: real Hermes agent (17 tools + persona, 13k input tokens) → 200 OK. `/root/.hermes/config.yaml` set to `provider: anthropic` + `base_url: http://localhost:20128` + `default: xai/grok-4.3` (backup `.bak-omniroute-20260602`). Telegram gateway launched with `hermes gateway run --accept-hooks` → connected (polling). xAI text models seen: grok-4.3, grok-4.20-0309-reasoning/non-reasoning, grok-4.20-multi-agent-0309 (400 on plain chat), grok-build-0.1.

See [[hermes-claude-max-oauth-extra-usage]]. Lucy's routing profile lives in `/root/lucy/hermes/` (config.yaml + .env.example + README).
