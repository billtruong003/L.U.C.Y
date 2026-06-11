---
name: lucy-hub-web-command-center
description: "Lucy Hub web UI — pm2 lucy-hub on 127.0.0.1:8800, nginx proxy :80, login at http://14.225.255.73"
metadata: 
  node_type: memory
  type: project
  originSessionId: 86177bba-20e3-44e0-b747-b4cb882a5407
---

Deployed 2026-06-04: **Lucy Hub** = web command center (React+Vite frontend in `~/lucy/hub/web`, Node/Express+tsx backend in `~/lucy/hub/server`). Browser chat UI that calls `claude -p` (same brain as [[lucy-bridge-replaces-hermes]]), with password login.

**Runtime / how to operate:**
- Runs under **pm2** as `lucy-hub` (`pm2 start npm --name lucy-hub -- start`, cwd=`~/lucy/hub/server`). Restart: `pm2 restart lucy-hub`. Logs: `pm2 logs lucy-hub`.
- Binds **127.0.0.1:8800** (NOT 0.0.0.0) — env `LUCY_HUB_HOST=127.0.0.1` in `~/lucy/hub/server/.env` is what forces that; default is 0.0.0.0 (would expose it), so that line must stay.
- **nginx** reverse-proxies `:80 → 127.0.0.1:8800`. Config: `/etc/nginx/sites-available/lucy` (default site removed). Access: **http://14.225.255.73**.
- Login password lives only in `~/lucy/hub/server/.env` (`LUCY_HUB_PASSWORD`, gitignored, chmod 600). API: `POST /login`→cookie, `POST /api/send`→job_id, `GET /api/poll/:id`. Default model sonnet; `{opus:true}` for opus.
- Build after pulling web changes: `cd ~/lucy/hub && npm run build` (vite → `web/dist`, served by express).

**2026-06-05 redeploy (2FA + Aki bridge):** pulled latest (commit 5673780). Hub now has 2FA(TOTP), schedule, logs, chat-history, brain-viz; voice dropped (2GB VPS). Deploy is now `bash ~/lucy/hub/deploy.sh` (npm install + vite build + `pm2 startOrReload ecosystem.config.cjs`). New `.env` keys: `LUCY_PROJECTS_ROOT=/root/lucy`, `LUCY_STATE=/root/.lucy-hub` (holds 2FA secret/schedules/logs/chat history), `LUCY_TZ_OFFSET=7`.

**Aki bridge (hub → radiant-bot Discord):** hub `.env` has `RADIANT_BOT_API_URL=http://127.0.0.1:3030` + `RADIANT_BOT_AGENT_SECRET=<hex32>` which MUST equal `AGENT_HMAC_SECRET` in `/root/bots/radiant-bot/.env`. radiant-bot side: merged branch `feat/lucy-agent-api` into main → exposes `POST /api/agent/post` + `/api/agent/channel` (HMAC-signed `x-lucy-signature`) on its `HEALTH_PORT` (set to **3030**, must be >0). Hub routes: `GET /api/aki/status`→`{configured:true}`, `POST /api/aki/report`, `POST /api/aki/channel`; tab **Aki** in web UI. Verified e2e 2026-06-05: login→`/api/aki/status`={"configured":true}, bot `/health`=ok. radiant-bot dir = `/root/bots/radiant-bot` (pm2 `radiant-tech-sect-bot`, restart with `--update-env`).

**Pending / caveats:**
- **No HTTPS** — Bill has no domain pointing here yet, so it's plain http and the password travels plaintext. When a domain is added: `certbot --nginx -d <domain>` (nginx-certbot already the plan). Update nginx `server_name` from the IP to the domain.
- **No ufw** firewall (Bill chose to skip) — radiant listens on 2567/3030 and enabling ufw risked blocking it. Port 8800 is localhost-only so not exposed regardless.
- Untouched and must stay safe: radiant (pm2 `radiant-tech-sect-bot` :3030, `radiant-arena-server` :2567) and `lucy-bridge`.
