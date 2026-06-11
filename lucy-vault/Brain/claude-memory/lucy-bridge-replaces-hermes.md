---
name: lucy-bridge-replaces-hermes
description: Hermes deprecated; Lucy now = lucy_bridge.py (Telegram <-> claude -p direct) under pm2
metadata: 
  node_type: memory
  type: project
  originSessionId: 86177bba-20e3-44e0-b747-b4cb882a5407
---

As of 2026-06-04, Hermes was **dropped** as Lucy's runtime. Replaced by `~/lucy/bridge/lucy_bridge.py` (commit 99a460f): a ~120-line bridge polling Telegram and piping each owner message straight to `claude -p` (Claude Code = the brain directly, with `--permission-mode bypassPermissions`, persona via `--append-system-prompt-file`, session continuity via `--resume`).

**Why:** Hermes' weak body model (mistral/grok) hallucinated dispatchers/fake commands and burned ~190M tokens/day re-sending context. Bridge = Claude direct, no framework token-burn, cost = Claude subscription only.

**How to apply:**
- Bridge runs under **pm2** as `lucy-bridge` (NOT systemd). Restart: `pm2 restart lucy-bridge`. Logs: `pm2 logs lucy-bridge`.
- Hermes gateway (systemd --user `hermes-gateway.service`) is **stopped + disabled** — do NOT re-enable it while bridge runs: both share the SAME Telegram bot token, so two pollers = Telegram 409 conflict.
- Config: `~/lucy/bridge/.env` (token reused from `~/.hermes/.env`, uid `6603021156` = Bill, `CLAUDE_BIN=/root/.local/bin/claude`).
- Owner-only lock = `LUCY_ALLOWED_USER_ID`; that allowlist is the ONLY gate since bypassPermissions runs every tool unattended.
- Daily brief: `bridge/cron_brief.sh` via system crontab `0 7 * * *` (deterministic, not model-dispatched).
- Supersedes [[hermes-claude-max-oauth-extra-usage]] and [[omniroute-vm-hosting]] (OmniRoute routing no longer in the Lucy path). [[lucy-gateway-systemd-not-pm2]] still explains why the old Hermes is systemd, but it's now disabled.
