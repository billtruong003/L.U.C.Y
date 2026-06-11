# Lucy — Neural Core (brain-viz) + roadmap mở rộng

Bản đồ não Lucy ở tab **BRAIN** của hub. **Telemetry-driven**: graph phản ánh state THẬT của hệ
(`GET /api/telemetry`), không phải hoạt hình trang trí. Render: three.js shader thuần
([web/src/components/BrainViz.tsx](../hub/web/src/components/BrainViz.tsx)) — node = khối năng lượng
volumetric (noise), dây thẳng có xung năng lượng chạy khi active, bouncy physics, kéo node được.

## Cấu trúc: core → zone → node
- **Core** `L.U.C.Y` ở tâm (metallic/energy, bob nhẹ).
- **Zone** = phân vùng lớn, toả quanh core. Node con cụm quanh zone của nó.
- **Node** = subsystem/agent/API/feed.

| Zone | Node LIVE (chạy thật) | Node PLANNED (ý tưởng, blueprint mờ) |
|---|---|---|
| **AGENTS** | Claude Sonnet, Claude Opus | Grok (xAI), Gemini Vision |
| **CHANNELS** | Telegram, Aki·Discord, Web Hub | Brief sáng |
| **VOICE** | MeloTTS | |
| **MONEY · DATA** | — | CoinMarketCap, Coin Watchlist, Gold XAU/SJC, Chứng khoán, Research Cron |
| **DEV** | — | GitHub, HuggingFace |

## "Chạy thật" nghĩa là gì (đã verify)
- Gửi 1 lệnh chat → job `claude -p` chạy → `/api/telemetry` báo `sonnet`/`opus` `active=true` →
  **zone AGENTS sáng + dây core→zone→node chạy hạt năng lượng** đúng lúc model làm việc.
- Lucy nói (TTS) → node **MeloTTS** (zone VOICE) sáng (`lastTtsAt` < 6s).
- Web Hub luôn active (đang phục vụ). Core sáng khi có bất kỳ job/voice nào.
- ⚠️ Telegram/Aki để 'live' nhưng CHƯA bắn telemetry (bridge chưa report) → hiện idle.
  Node **planned** = blueprint (mờ + khung wireframe), chưa hoạt động — là định hướng.

## Mở rộng: chỉ sửa 1 file
[integrations.json](../integrations.json) — thêm 1 dòng là có node:
```json
{ "id": "okx", "label": "OKX", "zone": "z_money", "group": "api", "status": "planned" }
```
- `zone`: `z_agents | z_channels | z_voice | z_money | z_dev`
- `group` (màu): `model | channel | voice | api`
- `status`: `planned` (blueprint mờ) | `live` (sáng đầy)
- Node hiện sau ~1.5s, KHÔNG cần restart.

## Cho 1 node "planned" → "live" thật
Phải bơm tín hiệu active vào `/api/telemetry` ([server/src/index.ts](../hub/server/src/index.ts)):
1. Có nguồn sự thật (job đang chạy / lần gọi API gần đây / cron đang tick).
2. Set `active`/`load` của leaf theo nguồn đó (giống cách `sonnet` đọc `jobs`, `voice` đọc `lastTtsAt`).
3. Đổi `status: 'live'`.

## Ý tưởng định hướng (roadmap brain)
- **MONEY·DATA**: wire CoinMarketCap/giá vàng/CK thật → node sáng khi cron research kéo data.
  `Research Cron` sáng khi job research chạy → đẩy report ra `CHANNELS`.
- **AGENTS**: thêm Grok (thân rẻ điều phối) / Gemini (vision đọc chart) khi cắm key → live.
- **CHANNELS**: `Brief sáng` sáng khi cron buổi sáng bắn Telegram. Telegram/Aki bơm activity khi
  bridge gọi `/api/telemetry` lúc xử lý tin.
- **Telemetry sâu hơn**: mỗi job mang zone/feature → dây chạy đúng nhánh; thêm per-agent latency,
  token dùng → độ sáng/độ dày dây theo tải thật.
- **Sub-agent fan/orch**: khi `/orch` chạy nhiều sub-agent → tạm thời sinh node con dưới AGENTS,
  mỗi sub-agent 1 node sáng tới khi xong → thấy "đàn agent" làm việc.
