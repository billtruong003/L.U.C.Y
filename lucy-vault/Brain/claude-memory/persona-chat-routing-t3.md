---
name: persona-chat-routing-t3
description: M3.5/T3 persona chat đa lượt + auto-routing LIVE (flag LUCY_PERSONA_CHAT) + cách restart coordinator KHÔNG mất env
metadata: 
  node_type: memory
  type: project
  originSessionId: 7f8122ae-dad8-41bf-9736-f13080ac5719
---

T3/M3.5 DONE (2026-06-15): persona "nói chuyện được + tự gọi đúng người".

- `agent-machine/src/persona-chat.ts`: `personaChat()` đa lượt (systemPrompt + agent-brain `Brain/agents/<id>.md` + laneModel riêng, nhớ history 12 lượt, allowConsult=false) · `personaRoute()` lai tag-overlap + embedding Jina (fusion 0.6 vec / 0.4 tag, loại kind=orchestrator).
- Coordinator endpoints `/persona-chat` + `/persona-route`, gated **flag LUCY_PERSONA_CHAT** (mặc định OFF; đã set =1 LIVE + thêm vào ecosystem.config.cjs).
- Hub: proxy `/api/persona/{chat,route}` (server) · tab Experts (`Personas.tsx`) = roster hero card (arc-reactor avatar) + thanh "🔮 Lucy tự chọn" + `PersonaChatPanel.tsx` (nút "Nhắn tin", slide-in glass).
- CHƯA: Telegram `@persona` — cần sửa `bridge/lucy_bridge.py` + restart lucy-bridge (CẤM trong vòng auto) → để chủ nhân.

⚠️ RESTART coordinator AN TOÀN (env phụ thuộc biến shell kế thừa: AM_DATA=/root/.agent-machine, caps… KHÔNG nằm trong ecosystem):
- TUYỆT ĐỐI KHÔNG `pm2 start ecosystem --only` hay `--update-env` từ shell trống → mất AM_DATA → mất cards/personas.
- Cách đúng để thêm 1 env var: source `/proc/<pid>/environ` (NUL-delimited, an toàn) vào shell → export var mới → `pm2 restart lucy-coordinator --update-env`. Xem [[pm2-live-services-not-ecosystem]].
