---
name: agent-sdk-migration
description: "Track 2 — chuyển claude -p subprocess sang Claude Agent SDK in-process; Hub + dream-brain đã xong, bridge/runner/cron chưa"
metadata: 
  node_type: memory
  type: project
  originSessionId: dfefdf60-3a56-4920-a80e-b4fece057360
---

**Đường B (Claude Agent SDK)** — `@anthropic-ai/claude-agent-sdk` v0.3.177 (npm). Đã verify (2026-06-13): SDK `query()` chạy được bằng **auth subscription hiện tại (KHÔNG cần ANTHROPIC_API_KEY)**, hỗ trợ stream (stream_event), tool (Bash), session_id, `permissionMode:'bypassPermissions'`, `appendSystemPrompt` (string), `additionalDirectories` (=`--add-dir`), `model`, `resume`, `abortController` (timeout). Message types map y hệt CLI stream-json: system/stream_event/assistant/user/result.

**Đã migrate sang SDK (verified):**
- `hub/server/src/index.ts` `streamClaude()` — chat web stream (đọc PERSONA file → appendSystemPrompt). Verified end-to-end, nhanh hơn spawn.
- `agent-machine/src/agent-brain-dream.ts` `sdkConsolidate()` — dream-per-persona 1-shot haiku.
- `agent-machine/src/runner.ts` `ClaudeRunner` + `claudeClassify` (salvage) — autopilot/sprint. Giữ `parseClaude` (đóng gói envelope y hệt), maxTurns/resume/salvage/allowedTools/vault. E2E test PASS (file tạo đúng trong workspace = cwd OK, decision advance, session+cost). Deployed (autopilot+worker restart).

- `bridge/lucy_bridge.py` — ✅ MIGRATED (2026-06-13, Bill chốt). Cài `python3-pip` (apt) + `claude-agent-sdk` (pip). Thêm `_run_claude_sdk`/`_run_claude_stream_sdk` (async + `asyncio.run(wait_for)`), `system_prompt={type:preset,preset:claude_code,append:<persona>}` = đúng --append-system-prompt-file; `add_dirs=[VAULT]`; `StreamEvent.event` dict thô parse như cũ. Giữ hàm spawn cũ đổi tên `_run_claude_spawn`/`_run_claude_stream_spawn` làm FALLBACK. Dispatcher chọn engine qua `LUCY_BRIDGE_ENGINE` (default sdk; =spawn để rollback). Verified standalone: stream + **resume session OK** + persona + tool. Restart bằng **detached delayed** (bridge spawn chính session đang chat → restart ngay = tự giết). Backup: `lucy_bridge.py.bak-presdk`.
  - **Rollback nhanh:** `cp lucy_bridge.py.bak-presdk lucy_bridge.py && pm2 restart lucy-bridge` (hoặc env `LUCY_BRIDGE_ENGINE=spawn`). Hàm SDK tự catch lỗi → trả message lỗi, KHÔNG chết câm.

**CHƯA migrate:**
- `cron_brief.sh`/`cron_tech.sh` — giá trị thấp, `claude -p` vẫn ổn.

**Lưu ý SDK quirk:** option `cwd` ÁP DỤNG ĐÚNG (đã verify pwd) — agent ghi sai chỗ chỉ khi brief mơ hồ để agent tự chọn path tuyệt đối. `m.usage.input_tokens` trong result message hay nhỏ (prompt-cache) — tin `total_cost_usd` hơn.

Liên quan [[lucy-hub-chat-sse-nginx]] [[lucy-bridge-replaces-hermes]]. SDK cài ở `hub/server` + `agent-machine` node_modules.
