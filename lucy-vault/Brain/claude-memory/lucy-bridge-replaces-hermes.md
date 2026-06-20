---
name: lucy-bridge-replaces-hermes
description: Hermes deprecated; Lucy = lucy_bridge.py (Telegram <-> Claude Agent SDK in-process) under pm2 lucy-bridge
metadata: 
  node_type: memory
  type: project
  originSessionId: 86177bba-20e3-44e0-b747-b4cb882a5407
---

As of 2026-06-04, Hermes was **dropped**. Replaced by `~/lucy/bridge/lucy_bridge.py`.

**Engine (2026-06-13 — ĐÃ MIGRATE SDK):** Bridge dùng **Claude Agent SDK in-process** (`claude_agent_sdk.query()`) làm primary. `claude -p` spawn là FALLBACK (env `LUCY_BRIDGE_ENGINE=spawn`). Mặc định `LUCY_BRIDGE_ENGINE=sdk`.

**Two paths:**
- **Claude-path** (default): Claude Agent SDK → Anthropic subscription. Dùng khi model = `claude:sonnet|claude:opus` hoặc chưa set model.
- **Lane-path**: coordinator `/chat-lane-agentic` → cred-pool → OpenCode Zen (free models). Dùng khi user `/model ds-v4-flash-free` hoặc `auto` router chọn lane. **Rotation 6 keys áp dụng ở đây.**

**Why replaced Hermes:** Hermes' weak body model hallucinated dispatchers/fake commands và burn ~190M tokens/day. Bridge = Claude direct, no framework overhead.

**⚠️ NOTE:** ĐỪNG nói "bridge dùng claude -p" — đó là thông tin cũ (pre-2026-06-13).

**How to apply:**
- Bridge runs under **pm2** as `lucy-bridge` (NOT systemd). Restart: `pm2 restart lucy-bridge`. Logs: `pm2 logs lucy-bridge`.
- Hermes gateway (systemd --user `hermes-gateway.service`) is **stopped + disabled** — do NOT re-enable it while bridge runs: both share the SAME Telegram bot token, so two pollers = Telegram 409 conflict.
- Config: `~/lucy/bridge/.env` (token reused from `~/.hermes/.env`, uid `6603021156` = Bill, `CLAUDE_BIN=/root/.local/bin/claude`).
- Owner-only lock = `LUCY_ALLOWED_USER_ID`; that allowlist is the ONLY gate since bypassPermissions runs every tool unattended.
- Daily brief: `bridge/cron_brief.sh` via system crontab `0 7 * * *` (deterministic, not model-dispatched).
- Supersedes [[hermes-claude-max-oauth-extra-usage]] and [[omniroute-vm-hosting]] (OmniRoute routing no longer in the Lucy path). [[lucy-gateway-systemd-not-pm2]] still explains why the old Hermes is systemd, but it's now disabled.
