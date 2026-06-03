# L.U.C.Y — Personal AI

> **L.U.C.Y** — *Literally Understands Crypto, Y'know.* 😎
>
> Con personal AI luôn-bật của Bill — giúp ra quyết định tài chính (coin/vàng/macro/alpha) và làm content,
> nói chuyện bằng **giọng anime girl** qua Telegram. Chạy trên VPS Ubuntu. **Thân** = Hermes chạy
> grok-4.1-fast (rẻ, always-on); **não** code = Claude Code triệu hồi bằng `!c`. (Chốt 2026-06-03.)

> _"Tôi á? Literally Understand Crypto, Y'know. Còn sếp thì mua đỉnh bán đáy."_ — Lucy

**Status:** Prep / scoping — chưa code. Đây là folder dự án; docs neo trong `docs/`.

---

## Lucy là ai

Persona: cô trợ lý AI sắc sảo, mê data + thị trường — vibe netrunner (Edgerunners), nhưng là **của riêng Bill**.
Khác với **Aki** (persona text trong cộng đồng Discord radiant-bot), Lucy là **personal AI có giọng nói trên Telegram**,
line riêng, và là "bộ não kiếm tiền" always-on. (Discord chỉ nhận text của Aki, không có voice.)

## Nó ngồi ở đâu trong hệ

```
📱 Telegram (riêng Bill) ─ full service: chat + ra lệnh + thao tác + 🎙️ VOICE (giọng anime girl, async voice note)
        │
   ┌────▼────┐  Hermes (VPS) · thân=grok-4.1-fast · `!c`→Claude Code · skills · memory
   │  LUCY   │
   └────┬────┘
        │ control API (HMAC)
   ┌────▼────────┐
   │ radiant-bot │  Aki phát báo cáo (CHỈ text) vào kênh Trưởng Lão + Tiên Nhân
   └─────────────┘
```

## Docs

| Doc | Nội dung |
|---|---|
| [docs/FEATURES.md](docs/FEATURES.md) | **Tất cả tính năng** muốn có (tránh miss) — kèm trạng thái |
| [docs/MONEY_PLAYBOOK.md](docs/MONEY_PLAYBOOK.md) | **Hướng tiền → execute** — 3 kênh, ideas I1-I5, soi khớp docs |
| [docs/BRIDGE_CLAUDE_CODE.md](docs/BRIDGE_CLAUDE_CODE.md) | **Kiến trúc não**: thân grok-4.1-fast + `!c` triệu hồi Claude Code (giá, tiered, isolation) |
| [docs/LOCAL_HUB.md](docs/LOCAL_HUB.md) | **Local web hub** (tầng nặng): cổng web bảo mật 2FA + sections Chat/Tasks/Projects + brain-viz, ra lệnh Claude |
| [docs/DEPLOY.md](docs/DEPLOY.md) | **Host: LOCAL vs VPS chạy gì, chạy sao** — 2 tầng, process, tunnel, secrets |
| [docs/VOICE.md](docs/VOICE.md) | Voice stack chi tiết: activation + STT + TTS giọng anime + Ubuntu |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Hermes + bridge radiant-bot + skills + dashboard |
| [docs/SETUP.md](docs/SETUP.md) | Deploy VPS Ubuntu (outline, prerequisites) |

Blueprint tổng (hybrid Hermes ↔ radiant-bot): [`../radiant-bot/docs/PERSONAL_AI_HERMES.md`](../radiant-bot/docs/PERSONAL_AI_HERMES.md).

## Folder

```
lucy/
├── docs/        # tài liệu (neo ý tưởng)
├── skills/      # custom Agent Skills (agentskills.io) — coin/gold/macro/alpha/content
├── voice/       # Discord voice layer (STT + TTS anime + wake word)
├── bridge/      # client gọi control-API radiant-bot
├── dashboard/   # web brain-viz (energy core + LLM wires)
├── hermes/      # config/profile Hermes (grok-4.1-fast xAI)
└── hermes-agent/ # (gitignored) source Hermes upstream — clone tham chiếu, KHÔNG commit
```

## Kỷ luật

🔐 Secrets (model keys / Telegram token / sau này key sàn) **chỉ trên VPS, không paste chat**. Key sàn = read-only.
⚠️ Không tự trade tiền thật cho tới khi tin pipeline (xem FEATURES §money spectrum).
