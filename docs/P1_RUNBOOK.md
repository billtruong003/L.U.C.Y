# Lucy — P1 Runbook: dựng Hermes + chat Telegram

> Mục tiêu P1: Hermes chạy trên VPS Ubuntu + chat qua lại với Lucy trên Telegram. **Chưa voice, chưa Discord, chưa research.**
> 🔐 Bước có khóa = **Bill tự nhập secret TRÊN VPS** (không paste vào chat, không để Claude đụng).

---

## 0. Prerequisites (Bill chuẩn bị trước)

| | Việc | Ghi chú |
|---|---|---|
| 🔐 | **Telegram bot token** | @BotFather → `/newbot` → đặt tên + username kết thúc `bot` → nhận token `123…:ABC…` |
| 🔐 | **Telegram user ID của Bill** | nhắn @userinfobot → lấy số ID (để khóa chỉ mình Bill dùng) |
| | **Model provider** | P1 khuyến nghị **Nous Portal** (`hermes setup --portal`) — 1 lần OAuth, gồm cả tool gateway, nhanh nhất. Anthropic/OpenRouter routing để sau. |
| | **VPS** | Vietnix `14.225.255.73` (chung radiant-bot) đủ cho P1 (chat nhẹ). Tách box sau nếu cần. |

---

## 1. SSH vào VPS
```bash
ssh root@14.225.255.73
```

## 2. System deps (Ubuntu)
```bash
sudo apt update
sudo apt install -y python3.11 python3.11-venv nodejs npm ripgrep ffmpeg git curl
# kiểm: python3.11 --version ; node -v ; rg --version ; ffmpeg -version
```

## 3. Cài Hermes (one-liner chính chủ)
```bash
curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
# xong: lệnh `hermes` dùng được
hermes --version
```

## 4. 🔐 Cấu hình model (Bill tự làm — interactive, không paste ra ngoài)
```bash
hermes setup --portal      # mở OAuth Nous Portal: login bằng trình duyệt, KHÔNG gõ key vào chat
```
> Hoặc nếu muốn Anthropic/OpenRouter ngay: sửa `~/.hermes/.env` bằng `nano` (đừng `cat`).

## 5. 🔐 Cấu hình Telegram (Bill tự làm)
**Cách A — interactive (khuyến nghị):**
```bash
hermes gateway setup       # chọn Telegram → dán bot token + user ID khi được hỏi
```
**Cách B — thủ công:** `nano ~/.hermes/.env` thêm:
```
TELEGRAM_BOT_TOKEN=<token-cua-Bill>
TELEGRAM_ALLOWED_USERS=<user-id-cua-Bill>   # khóa chỉ mình Bill — QUAN TRỌNG
```

## 6. Khởi động + smoke test
```bash
hermes gateway             # bot online trong vài giây
# → mở Telegram, nhắn cho bot. Lucy phải trả lời.
```

## 7. Chạy nền bền (để không tắt khi đóng SSH)
Dùng **pm2** (đã có sẵn cho radiant-bot trên VPS):
```bash
pm2 start "hermes gateway" --name lucy-hermes
pm2 save
# pm2 logs lucy-hermes   # xem log
# pm2 restart lucy-hermes
```
> Hoặc systemd nếu muốn (Hermes docs có hướng dẫn). Modal = serverless idle-cheap, để sau.

---

## Definition of done (P1)
- [ ] `hermes --version` chạy trên VPS.
- [ ] Model provider cấu hình xong (Portal login OK).
- [ ] `TELEGRAM_ALLOWED_USERS` = đúng user ID Bill (người khác nhắn bot bị từ chối).
- [ ] Nhắn Telegram → Lucy trả lời (chat qua lại được).
- [ ] `pm2 save` → Lucy sống lại sau `pm2 restart` / reboot.
- [ ] 🔐 Token/key chỉ nằm trong `~/.hermes/.env` trên VPS, chưa từng xuất hiện trong chat.

## Sau P1
- Đặt persona Lucy (system prompt: anime girl sắc sảo, mê data/thị trường).
- P2: research skills + cron. P-voice: MeloTTS VN. P3: bridge → Aki.

## Refs
- Install/Quickstart: https://hermes-agent.nousresearch.com/docs
- Telegram: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/telegram
