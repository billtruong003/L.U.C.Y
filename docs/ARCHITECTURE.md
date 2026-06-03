# Lucy — Architecture

> Lucy ngồi **trên** Hermes Agent và **nối** radiant-bot. Folder này giữ phần custom của Bill
> (skills, voice, bridge, dashboard, config) — Hermes core cài riêng bằng installer của nó.
>
> **Não (chốt 2026-06-03):** thân = Hermes chạy **grok-4.1-fast-reasoning** (xAI thẳng, ~$10/năm);
> não thật = **Claude Code** triệu hồi bằng command **`!c`**. Đã bỏ OmniRoute. Chi tiết: [BRIDGE_CLAUDE_CODE.md](BRIDGE_CLAUDE_CODE.md).

---

## 1. Lớp lang

```
┌───────────────────────────── VPS Ubuntu ─────────────────────────────┐
│                                                                       │
│   Telegram gateway ◄──► HERMES AGENT (THÂN, always-on)                │
│   (chat + 🎙️ voice)     │  model: grok-4.1-fast (xAI) │ memory │ skills│
│                          │      └─ `!c` ──► claude -p (NÃO: Claude Code, OAuth riêng)
│                          ▼                        ▼          ▼         │
│   lucy/voice  ──────►  Telegram voice note (STT/TTS anime)  lucy/skills│
│   lucy/bridge ──────►  control API client                             │
│   lucy/hermes ──────►  Hermes config/profile (grok, xAI)              │
│   web dashboard ────►  hermes dashboard --host (IP + OAuth login + Chat tab + Cron)
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
| `hermes/` | Profile/config Hermes (grok-4.1-fast xAI thẳng, gateway, schedule) | yaml/json config |

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
| Não | LLM router (Groq/Gemini) | thân grok-4.1-fast + `!c` Claude Code |

## 5. Tham chiếu
- **Não/cầu nối (grok + `!c` Claude):** [BRIDGE_CLAUDE_CODE.md](BRIDGE_CLAUDE_CODE.md) · config [../hermes/config.yaml](../hermes/config.yaml)
- **Web dashboard** (IP+login+prompt+cron): [../hermes-agent/website/docs/user-guide/features/web-dashboard.md](../hermes-agent/website/docs/user-guide/features/web-dashboard.md)
- Blueprint hybrid tổng: [`../radiant-bot/docs/PERSONAL_AI_HERMES.md`](../../radiant-bot/docs/PERSONAL_AI_HERMES.md)
- Hermes Agent: https://github.com/NousResearch/hermes-agent · source clone: [../hermes-agent/](../hermes-agent/)
- Agent Skills: https://agentskills.io
