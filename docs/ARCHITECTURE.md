# Lucy — Architecture

> Lucy ngồi **trên** Hermes Agent và **nối** radiant-bot. Folder này giữ phần custom của Bill
> (skills, voice, bridge, dashboard, config) — Hermes core cài riêng bằng installer của nó.

---

## 1. Lớp lang

```
┌───────────────────────────── VPS Ubuntu ─────────────────────────────┐
│                                                                       │
│   Telegram gateway ◄──► HERMES AGENT (core, cài bằng installer)       │
│   (chat + 🎙️ voice)     │   model: Claude + rẻ  │  memory  │ skills  │
│                          ▼                        ▼          ▼         │
│   lucy/voice  ──────►  Telegram voice note (STT/TTS anime)  lucy/skills│
│   lucy/bridge ──────►  control API client                             │
│   lucy/hermes ──────►  Hermes config/profile                          │
│   lucy/dashboard ───►  brain-viz (web) + telemetry collector          │
└───────────────────────────────────────┬───────────────────────────────┘
                                         │ HTTPS REST + HMAC
                                         ▼
                              radiant-bot (Discord)  →  Aki posts/acts
```

## 2. Các phần trong folder

| Folder | Vai trò | Công nghệ dự kiến |
|---|---|---|
| `skills/` | Agent Skills (agentskills.io `SKILL.md`) cho 6 research tracks | Python/TS skill packages |
| `voice/` | **Telegram** voice note: STT-in + TTS anime-voice reply | Hermes transcribe + ElevenLabs/GPT-SoVITS + ffmpeg |
| `bridge/` | Gọi control-API radiant-bot (HMAC) — đẩy báo cáo, ra lệnh Aki | fetch + HMAC |
| `dashboard/` | Web brain-viz + WebSocket telemetry | React + three.js/canvas |
| `hermes/` | Profile/config Hermes (model routing, gateway, schedule) | yaml/json config |

## 3. Seam với radiant-bot (control API)

- Mở rộng REST sẵn có của radiant-bot (`POST /api/contribute` + HMAC) → `POST /api/agent/*`.
- Tái dùng CLI dispatcher (`radiant-bot/src/cli/dispatcher.ts` + services: send/notify).
- **Luồng báo cáo:** Lucy research → `bridge` POST → radiant-bot → Aki phát vào kênh Trưởng Lão + Tiên Nhân.
- **Luồng ra lệnh:** Telegram → Hermes → `bridge` POST → Aki thực thi trong Discord.
- **An ninh:** khóa Telegram user ID của Bill + HMAC + whitelist hành động Aki.

## 4. Phân vai 2 bot (tránh lẫn)

| | Aki (radiant-bot) | Lucy (folder này) |
|---|---|---|
| Vai | persona text cộng đồng | personal AI có giọng nói |
| Kênh | Discord text | Telegram (chat + voice) |
| Đối tượng | cả server | riêng Bill (+ báo cáo cho elder/tiên nhân) |
| Não | LLM router (Groq/Gemini) | Hermes + Claude |

## 5. Tham chiếu
- Blueprint hybrid tổng: [`../radiant-bot/docs/PERSONAL_AI_HERMES.md`](../../radiant-bot/docs/PERSONAL_AI_HERMES.md)
- Hermes Agent: https://github.com/NousResearch/hermes-agent
- Agent Skills: https://agentskills.io
