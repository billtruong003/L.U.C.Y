---
name: pm2-live-services-not-ecosystem
description: "Live agent-machine pm2 procs run via npm, NOT ecosystem.config.cjs — env changes need /proc reconstruction + --update-env"
metadata: 
  node_type: memory
  type: project
  originSessionId: c5b5838d-d97c-4e53-ad1d-aa863ae53760
---

Trên VPS, các pm2 service của agent-machine (`lucy-coordinator`, `lucy-vps-worker`, `lucy-autopilot`) đang chạy qua `npm/npx run <script>` — KHÔNG phải từ `ecosystem.config.cjs` (tên app trong ecosystem khác: `lucy-worker` ≠ live `lucy-vps-worker`). ⇒ env mới khai báo trong ecosystem.config.cjs (vd `AM_TURNS_LOG`) KHÔNG tự áp vào process đang chạy.

**Why:** divergence này khiến tính năng opt-in-by-env (turn-log/BH-G) bị "tối" trong prod dù code + ecosystem config đã đúng.

**How to apply:** để thêm 1 env var cho process npm-started mà KHÔNG mất env cũ (AM_TOKEN, LLM_ENV_FILE...): tái dựng full env từ `/proc/<pid>/environ` (NUL-delimited) vào shell → `export VAR=...` → `pm2 restart <name> --update-env` → `pm2 save`. Verify auth sau restart (`GET /token-guard` với header `x-worker-token`). KHÔNG echo secret. inFlight phải =0 trước khi restart worker. Liên quan [[daily-brief-setup]].
