---
name: lucy-hub-build-deploy
description: "Cách BUILD/DEPLOY Lucy Hub (script, KHÔNG raw vite) + auto-build.py harness — đừng để agent build sai"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 0ded98c3-60c8-4e72-a49d-0ebcaeafa57e
---

**Hub ở `/root/lucy/hub`** = 2 phần: `web/` (React/Vite frontend) + `server/` (Node backend). KHÔNG phải 1 vite app trần.

**Build/deploy = `bash /root/lucy/hub/deploy.sh`** (KHÔNG chạy vite trực tiếp): nó (1) `cd server && npm install`, (2) `cd web && npm install && npm run build`, (3) `pm2 startOrReload ecosystem.config.cjs` → hub local `127.0.0.1:8800`, nginx proxy vào. Cập nhật: `cd ~/lucy && git pull && bash hub/deploy.sh`. Doc đầy đủ: `/root/lucy/docs/DEPLOY_HUB.md`.

**Auto-build harness = `/root/lucy/auto-build.py`** (KHÔNG phải spawn agent tự chế): chạy bằng Claude Agent SDK in-process (đồng bộ Hub/bridge/runner), chạy NỀN sống độc lập session, làm theo `docs/MASTER-SPEC.md`, mỗi vòng 1 task → smoke/fix/deploy → in `AUTOBUILD: DONE|NEEDS_HUMAN|ALL_DONE`. Chạy: `pm2 start /root/lucy/auto-build.py --name lucy-autobuild --interpreter python3 --no-autorestart`. Dừng êm: `touch /root/lucy/.autobuild-stop`. Log `/root/lucy/auto-build.log`. Env: `AUTOBUILD_MODEL`(sonnet|opus)·`AUTOBUILD_MAX_ITERS`(8)·`AUTOBUILD_TIMEOUT`(2400). Wrapper: `autobuild-wrapper.sh`, `run-auto-opus.sh`.

⚠️ Khi build cụm UI (vd Prompt Architect cụm B): code vào `hub/web` + `hub/server` theo convention — ĐỪNG để agent dùng `vite build` trần hay tự chế lệnh. Restart `lucy-hub` (KHÔNG `lucy-bridge`). Xem [[lucy-hub-web-command-center]] [[lucy-hub-chat-sse-nginx]] [[ui-refactor-sprints]].

🚨 CẠM BẪY deploy.sh trên VPS live (phát hiện PA-B 2026-06-15): `deploy.sh` chạy `pm2 startOrReload ecosystem.config.cjs` → reload CẢ `lucy-coordinator`. Coordinator LIVE có env KHÔNG nằm trong ecosystem (token thật 48-ký-tự + `AM_DATA`, dựng qua /proc) — ecosystem fallback chỉ `AM_TOKEN='lucytok'`, reload sẽ MẤT env thật → hỏng auth bridge↔coordinator/persona-chat. ⇒ Để chỉ đổi flag .env hoặc rehost CHỈ hub: build web thủ công (`cd hub/web && npm install && npm run build`) rồi `pm2 restart lucy-hub` (plain, KHÔNG --update-env — dotenv tự đọc lại `hub/server/.env` lấy flag mới, giữ env pm2). Chỉ chạy deploy.sh nguyên bản khi đã preserve env coordinator hoặc coordinator không divergent. Kiểm divergence: `tr '\0' '\n' </proc/$(pid)/environ | grep AM_TOKEN` (49 ký tự kể newline = token thật, 7 = lucytok).
