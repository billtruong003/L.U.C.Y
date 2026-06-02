# Lucy — Personal AI

> Con personal AI luôn-bật của Bill — giúp ra quyết định tài chính (coin/vàng/macro/alpha) và làm content,
> nói chuyện bằng **giọng anime girl** qua Discord voice + Telegram. Chạy trên VPS Ubuntu, não là **Hermes Agent** + Claude.

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
   ┌────▼────┐  Hermes Agent (VPS) + Claude/model rẻ + skills + memory
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
└── hermes/      # config/profile Hermes Agent
```

## Kỷ luật

🔐 Secrets (model keys / Telegram token / sau này key sàn) **chỉ trên VPS, không paste chat**. Key sàn = read-only.
⚠️ Không tự trade tiền thật cho tới khi tin pipeline (xem FEATURES §money spectrum).
