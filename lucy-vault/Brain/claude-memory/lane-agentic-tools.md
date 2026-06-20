---
name: lane-agentic-tools
description: "Phase M — lane model rẻ (Nemotron…) trong hub chat giờ CÓ tool (web/file/bash) qua vòng agentic, như Hermes"
metadata: 
  node_type: memory
  type: project
  originSessionId: dfefdf60-3a56-4920-a80e-b4fece057360
---

**Phase M (2026-06-13)** — model rẻ/free trong chat Hub giờ "biết dùng máy/web" như Hermes.

- `agent-machine/src/web-tools.ts`: `webFetch(url)` + `webSearch(query)` — no-key (DuckDuckGo lite scrape, UA trình duyệt thật bắt buộc — UA "bot" bị DDG trả rỗng), SSRF-guard chặn host nội bộ. HTML→text.
- `agent-machine/src/lane-chat.ts`: `chatLaneAgentic(model, messages, ws, {onTool})` — vòng agentic (callLLMRaw + tools) cho LANE chat. Tool: web_search/web_fetch/read_file/list_dir/bash/write_file/edit_file, sandbox trong `ws` (safePath, bash không thoát ws). Trả `{answer, trace, usage}`.
- Coordinator endpoint `POST /chat-lane-agentic` {model, messages} → chatLaneAgentic (ws = LUCY_WORKDIR || ~/lucy-workspace).
- Hub `/api/chat/stream`: model lane tool-capable (M4: từ `routeTable` tool-calling/agentic-code/reasoning/long-context) → đi `/chat-lane-agentic`, stream `trace` thành tool_use/tool_result SSE (card #3 minh bạch); else chat thuần `/chat-lane`. Lane luôn mang persona+history (L2 — `buildLaneMessages`).
- Verified: Nemotron (`or-nemotron-super`) tự web_search→web_fetch lấy giá BTC thật + nguồn CoinMarketCap. smoke:lane PASS.

**K2 (2026-06-14)** — thêm tool `consult_expert(persona, question)` vào `lane-chat.ts`: spawn sub-agent với persona (config/personas/*.json) + brain (readAgentBrain) → tổng hợp → hiện tool-card. Sub-agent `allowConsult=false` chặn đệ quy. K1: thêm persona marketing/finance/researcher. Verified: nemotron tự consult_expert(finance) → tổng hợp xu hướng vàng. → multi-agent expert (CF-3) chạy ở lane chat.

Liên quan [[agent-sdk-migration]]. Claude-path (subscription) đã có tool sẵn qua SDK — M/K2 là cho LANE (free). Follow-up: consult cho claude-path (SDK custom tool/MCP), bridge run_lane history+tool (Telegram chính dùng claude-path đủ tool).
