# VPS Kickoff — paste vào Claude Code session TRÊN VPS

> Mở Claude Code trên VPS Ubuntu, paste nguyên block dưới làm message đầu tiên. Nó tự-chứa, không cần repo lucy/.

---

## Step 0 — Cài Claude Code lên VPS (paste vào terminal SSH trước)

```bash
# tmux để session sống nếu rớt SSH
sudo apt update && sudo apt install -y tmux
tmux new -s lucy

# Cài Claude Code — native installer (không cần Node, tự update)
curl -fsSL https://claude.ai/install.sh | bash

# Nạp lại PATH + kiểm tra
exec $SHELL
claude --version

# Chỗ làm việc rồi khởi động
mkdir -p ~/lucy && cd ~/lucy
claude
```

Login lần đầu (headless): `claude` hiện login flow → bấm `c` copy URL → mở trên laptop → authorize → paste code lại.
🔐 Hoặc `export ANTHROPIC_API_KEY=...` (nhập trên VPS, đừng paste vào chat). Login subscription gọn hơn.

Sau khi `claude` chạy + login xong → paste block dưới làm message đầu tiên.

---

```
Bạn là Claude Code chạy trên VPS Ubuntu của tôi (Bill). Ta đang dựng "Lucy" — một personal AI
luôn-bật, chạy trên Hermes Agent (Nous Research), nói chuyện qua Telegram. Session này CHỈ làm Phase 1:
cài Hermes + chat qua lại với Lucy trên Telegram. CHƯA làm voice, CHƯA Discord, CHƯA research.

LUẬT SECRET (bắt buộc):
- KHÔNG bao giờ yêu cầu tôi paste token/API key vào chat. KHÔNG echo/cat secret.
- Các bước nhập secret là PHẦN CỦA TÔI: tôi tự làm trong terminal riêng (OAuth trình duyệt hoặc `nano`),
  rồi báo "done". Bạn lo các bước không-secret.
- Dùng `nano ~/.hermes/.env` để xem/sửa, KHÔNG dùng `cat`.

CHIA VIỆC:
- BẠN chạy: system deps, cài Hermes, start gateway, dựng pm2, đọc log debug.
- TÔI tự làm (báo done sau): (1) `nano ~/.hermes/.env` set XAI_API_KEY=<xAI key> (model body =
  grok-4-1-fast-reasoning, provider=xai native → https://api.x.ai/v1; KHÔNG set ANTHROPIC_*);
  (2) Telegram — tạo bot @BotFather, lấy user ID @userinfobot, rồi `hermes gateway setup` HOẶC
  `nano ~/.hermes/.env` set TELEGRAM_BOT_TOKEN + TELEGRAM_ALLOWED_USERS=<user-id-tôi> (khóa chỉ mình tôi).

CÁC BƯỚC P1:
1. System deps: sudo apt update && sudo apt install -y python3.11 python3.11-venv nodejs npm ripgrep ffmpeg git curl
2. Cài Hermes: curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash  (rồi `hermes --version`)
3. [TÔI] set XAI_API_KEY=<xAI key> + copy hermes/config.yaml (provider=xai, grok-4-1-fast) → tôi báo done
4. [TÔI] cấu hình Telegram (token + TELEGRAM_ALLOWED_USERS) → tôi báo done
5. Start: hermes gateway  → tôi nhắn bot trên Telegram để test Lucy trả lời
6. Chạy nền: pm2 start "hermes gateway" --name lucy-hermes && pm2 save

DEFINITION OF DONE:
- hermes --version OK; Portal login OK; TELEGRAM_ALLOWED_USERS = đúng ID tôi (người khác bị từ chối);
  nhắn Telegram → Lucy trả lời; pm2 save xong; không secret nào lọt vào chat.

Sau khi xong P1, dừng lại và báo tôi review. Persona Lucy (anime girl sắc sảo, mê data/thị trường) +
P2 research sẽ làm ở session sau.

Bắt đầu từ bước 1.
```

---

## Ghi chú cho Bill
- Kickoff trên **tự-chứa** cho P1 — VPS không cần folder `lucy/`.
- Lát nữa P2 (skills/voice/bridge) mới cần đưa `lucy/` lên VPS (qua git). Khi đó t set remote + push.
- Refs đầy đủ: `lucy/docs/P1_RUNBOOK.md`, blueprint `radiant-bot/docs/PERSONAL_AI_HERMES.md`.
