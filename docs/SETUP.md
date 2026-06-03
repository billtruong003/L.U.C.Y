# Lucy — Setup (VPS Ubuntu) — OUTLINE

> Chưa thực thi — outline + prerequisites. Điền chi tiết khi bắt P1.
> 🔐 **KHÔNG paste secret vào chat.** Dùng `nano .env` trên VPS để nhập key, đừng `cat`.

---

## Prerequisites (Bill chuẩn bị)

- [ ] VPS Ubuntu — quyết định: Vietnix `14.225.255.73` (chung radiant-bot, không GPU) **hay** box riêng (cân nhắc GPU nếu local voice).
- [ ] Telegram bot token (tạo qua @BotFather).
- [ ] **xAI API key** cho Hermes body (`grok-4.1-fast-reasoning`, provider=custom → `https://api.x.ai/v1`). Não code = Claude Code qua `!c` (OAuth riêng). Xem [BRIDGE_CLAUDE_CODE.md](BRIDGE_CLAUDE_CODE.md).
- [ ] (Voice) Quyết GPU? → TTS engine (ElevenLabs cloud / GPT-SoVITS local). Xem VOICE.md §6.
- [ ] HMAC secret dùng chung với radiant-bot control API.

## Bước cài (outline)

1. **Hermes core**
   ```bash
   curl -fsSL https://raw.githubusercontent.com/NousResearch/hermes-agent/main/scripts/install.sh | bash
   hermes            # CLI
   hermes gateway    # bật messaging (Telegram)
   ```
   Deps: Python 3.11+, Node, ripgrep, ffmpeg.
2. **Cấu hình model + gateway** trong `lucy/hermes/` (provider=custom → xAI grok-4.1-fast; Telegram token qua env; KHÔNG ANTHROPIC_*).
3. **Skills** — cài research skills vào Hermes skill dir (+ vet community: awesome-finance-skills, last30days).
4. **Voice (`lucy/voice/`)** — **Telegram only**: Hermes transcribe voice note (STT) + TTS anime-voice reply gửi `sendVoice`. Dep: `ffmpeg` (convert sang OGG/Opus). KHÔNG cần @discordjs/voice.
5. **Bridge** (`lucy/bridge/`) — HMAC client → radiant-bot `/api/agent/*` (cần thêm endpoint phía radiant-bot).
6. **Dashboard** (`lucy/dashboard/`) — sau cùng; telemetry trước, viz sau.
7. **Process mgr** — PM2 (như radiant-bot) cho voice service + dashboard; Hermes tự quản phiên.

## Smoke checklist (khi có code)
- [ ] Telegram chat qua lại được với Lucy.
- [ ] Research cron ghi ra `research/YYYY-MM-DD.md`.
- [ ] Lucy trả lời voice note giọng anime trên Telegram (TTS test).
- [ ] Bridge → Aki post test vào kênh gated.
- [ ] Secret chỉ trong `.env` trên VPS, `.env` trong `.gitignore`.
