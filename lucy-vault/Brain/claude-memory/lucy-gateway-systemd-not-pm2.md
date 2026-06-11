---
name: lucy-gateway-systemd-not-pm2
description: "Lucy Hermes gateway runs under systemd --user, NOT pm2 — restart command differs from docs"
metadata: 
  node_type: memory
  type: project
  originSessionId: 95c6c661-acd1-46cc-a59a-c324ffd62d67
---

Trên VPS Vietnix (14.225.255.73), Lucy's Hermes gateway chạy dưới **`systemd --user`** (unit `hermes-gateway.service`, enabled), KHÔNG phải pm2. pm2 chỉ quản radiant-bot (`radiant-tech-sect-bot`, `radiant-arena-server`) + `pm2-logrotate`.

**Why:** HANDOFF.md và docs/DEPLOY.md ghi `pm2 restart lucy-hermes` — lệnh đó SAI với thực tế VPS này (không có process pm2 tên lucy-hermes). Gây nhầm khi deploy.

**How to apply:** Restart Lucy = `systemctl --user restart hermes-gateway.service` rồi verify `systemctl --user is-active hermes-gateway.service` = active và check `~/.hermes/gateway_state.json` (telegram=connected). TUYỆT ĐỐI không `pm2 restart` nhầm vào radiant-bot. Đo token = `hermes insights --source telegram --days 1`. Liên quan [[omniroute-vm-hosting]].
