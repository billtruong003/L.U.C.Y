# Lucy — Deploy / Host (LOCAL vs VPS chạy gì, chạy sao)

> Kiến trúc 2 tầng (chốt 2026-06-03). **VPS = tầng nhẹ always-on** (research/comms/Aki).
> **LOCAL = tầng nặng** (code nhiều project + web hub). Hai host khác nhau — bảng dưới là kim chỉ nam.

---

## A. VPS host (Vietnix, 2GB, always-on, NHẸ)

| | |
|---|---|
| **Process chính** | `hermes gateway` — body Telegram, model **grok-4-1-fast-reasoning** (xAI thẳng) |
| **Always-on** | `pm2 start "hermes gateway" --name lucy-hermes && pm2 save` (chung box radiant-bot) |
| **Cron research** | 1×/ngày (sáng) → gọi **`claude -p`** (1 call/ngày, research thuần KHÔNG repo) → **2 file**: `research/<date>.md` (chi tiết vàng/crypto/CK) + `TREND.md` (xu hướng, khi nào vào) → gửi Telegram + đẩy Aki |
| **Claude CLI** | cài nhẹ + `claude login` — **chỉ để brief 1×/ngày**, không code/repo (2GB kham được) |
| **Bridge → Aki** | POST radiant-bot `/api/agent/*` (HMAC) → Aki báo cáo Discord *(endpoint chưa có — phải thêm)* |
| **Tunnel endpoint** | nhận reverse-SSH từ local: sshd `GatewayPorts yes`; nginx TLS `:8443` → hub local |
| **KHÔNG chạy** | coding nặng / kanban / build / dashboard hub (đẩy hết về local) |
| **Secrets (~/.hermes/.env)** | `OPENAI_API_KEY`=xAI key · Telegram token + allowed user · **KHÔNG** ANTHROPIC_* |

Smoke: `hermes gateway status` · nhắn Telegram → Lucy trả lời · cron chạy ra 2 file.

---

## B. LOCAL host (máy Bill, mạnh, on-demand, NẶNG)

| | |
|---|---|
| **Web hub** | `hermes dashboard --host 127.0.0.1 --tui` (bind localhost) → expose ra ngoài **qua reverse-SSH tunnel tới VPS**, KHÔNG bind 0.0.0.0 trực tiếp |
| **Tunnel (giữ sống)** | `autossh -M 0 -N -R 0.0.0.0:8443:localhost:9119 root@<VPS_IP>` → Bill vào `https://<VPS_IP>:8443` |
| **2FA** | Telegram-approve (Lucy gửi nút Duyệt) — xem [LOCAL_HUB.md](LOCAL_HUB.md) |
| **Brain code** | **Claude Code** (`claude`, OAuth riêng) — code nhiều project, Kanban lanes, repos, build |
| **Hub chat thường** | Hermes (grok) cho chat nhẹ; lệnh code → Claude Code |
| **Deps** | `pip install 'hermes-agent[web,pty]'` · `claude` CLI · `autossh` |
| **Process mgr** | on-demand (chạy khi máy bật); muốn auto thì nssm/pm2 (Windows) |
| **Plugin hub** | sống trong `lucy/dashboard/` (modular, để share community sau) |

Smoke: mở hub localhost → 2FA → Chat → ra lệnh `claude` chạy 1 task nhỏ.

---

## C. Cùng dùng 1 tài khoản Claude
Cả VPS (brief 1×/ngày) lẫn local (code) đều xài **Claude subscription** chung → rate-limit **dùng chung quota**.
Brief 1 call/ngày không đáng kể; coding local mới là phần ăn quota. Mỗi máy `claude login` riêng, auth nằm `~/.claude` của máy đó.

## D. Thứ tự dựng
1. **Test LOCAL** (validate grok-via-xAI bằng `hermes chat`) — đang làm.
2. **VPS P1** Hermes + Telegram (bám [P1_RUNBOOK.md](P1_RUNBOOK.md) / [VPS_KICKOFF.md](VPS_KICKOFF.md)).
3. **VPS P2** cron research → 2 file → Telegram. **P3** đẩy Aki.
4. **LOCAL hub** H1 tunnel+2FA+Chat → H2 Tasks/Projects → H3 brain-viz.
