# CL-2 — Tool Registry thống nhất + self-awareness manifest — DONE

**Ngày:** 2026-06-21 · **Flag:** `LUCY_TOOL_REGISTRY` (default OFF) · **tsc:** PASS · **smoke:** 15/15

## Kiến trúc đã dựng

Tham chiếu Hermes `tools/registry.py` (register + toolset lồng + dispatch + sanitize-error).
2 file mới + 4 file wire flag-gated:

- **`agent-machine/src/tools/registry.ts`** — core:
  - `ToolEntry { name, toolset, schema, description, handler, checkFn?, requiresEnv?, emoji?, maxResultChars? }`
  - `ToolCtx { ws, mode: 'chat'|'runner', allowed? }` — 1 handler, 2 luật sandbox theo `mode`.
  - `ToolRegistry`: `register()` (idempotent, ghi đè theo tên) · `registerToolset()` (nhóm lồng nhau)
    · `registerAlias()` · `resolveToolset()` (đệ quy + dedup + **chống lặp vòng** + lọc `available()`)
    · `toolDef()`/`laneToolDefs()` (ra định dạng OpenAI tool-calling) · `dispatch()` (try/catch →
    LUÔN trả string, lỗi = `ERROR: <sanitized>`) · `manifest()`.
  - `sanitizeError()` — cắt framing ```` ``` ````/`<![CDATA[]]>`/thẻ XML + cap ký tự (Hermes parity).
  - `available()` — gate theo `requiresEnv` (thiếu env → ẩn) + `checkFn()`.
  - `toolRegistryEnabled()` đọc flag; helper export `getLaneToolDefs/dispatchTool/getToolManifest`.

- **`agent-machine/src/tools/lane-tools.ts`** — **gom tool lane hiện có, VIẾT HANDLER 1 LẦN**:
  - File: `read_file/list_dir/write_file/edit_file` + `bash` — branch theo `ctx.mode`:
    - `chat`  = path tuyệt đối/tương đối + blacklist nhạy cảm (.ssh/.env/key…), `bash -lc` 60s, cap đọc 20000 (y `lane-chat.ts` cũ).
    - `runner`= bó CHẶT trong workspace + gate `persona.allowedTools` (Read/Write/Edit/Bash), `IS_SANDBOX=1` 120s, cap đọc 30000 (y `lane-runner.ts` cũ).
  - Web: `web_search/web_fetch` (dùng `web-tools.ts`). Market: `binance_price/binance_klines` (dùng `market-tools.ts`).
  - Toolset: `web`, `fs-rw`, `market`, `lucy-runner`=[fs-rw,bash] (5), `lucy-lane`=[web,fs-rw,bash] (7).
    ⚠️ Tên toolset KHÔNG trùng tên tool (`bash`) — nếu trùng cycle-guard sẽ cắt (đã sửa 1 lần khi smoke đỏ).

## Tool đã gom (1 nguồn)

`web_search · web_fetch · read_file · list_dir · write_file · edit_file · bash · binance_price · binance_klines`
+ `consult_expert` (đăng ký ở `lane-chat.ts` để tránh import vòng lane-tools↔lane-chat; handler gọi `consultExpert`).

## Wire (forward-only, flag OFF = đường cũ y nguyên)

- `lane-chat.ts`: flag ON → `tools = getLaneToolDefs('lucy-lane')` (+ consult cho main), dispatch qua `dispatchTool(..., {mode:'chat'})`. OFF → `CHAT_TOOLS`/`execChatTool` cũ. Giữ nguyên `seenTools` chống lặp.
- `lane-runner.ts`: flag ON → `getLaneToolDefs('lucy-runner')` lọc theo `allowed` y như cũ, dispatch `{mode:'runner', allowed}`. OFF → `ALL_TOOLS`/`execTool` cũ.
- `runner.ts` `buildSystemPrompt()`: flag ON → chèn `getToolManifest()` ở **vùng TĨNH-theo-persona** (sau `persona.systemPrompt`, TRƯỚC `digest/brain` động → giữ prompt-cache). OFF → `''` → prompt y hệt cũ.

## Cách bật flag

```bash
export LUCY_TOOL_REGISTRY=1   # 1|true|on. Mặc định OFF = lane đọc đường hard-code cũ.
```
(Code-only, KHÔNG restart trong task này. Bật live cần Bill restart proc liên quan.)

## Verify (bằng chứng thật)

- `npx tsc --noEmit` → **EXIT 0**.
- `npx tsx src/smoke-tool-registry.ts` → **15 pass / 0 fail**: resolveToolset lồng (7/5 tool đúng) · alias · cycle-guard · ToolDef format · dispatch read_file · runner CHẶN ngoài workspace · chat CHO path tuyệt đối · blacklist nhạy cảm · runner gate quyền · chuỗi trả khác mode (`đã ghi a.txt (3 ký tự)` vs path tuyệt đối) · tool lạ → ERROR · sanitizeError · manifest.
- Flag default OFF: `toolRegistryEnabled()===false`, `getToolManifest()===''` khi chưa register → buildSystemPrompt không đổi.
- (Cách test lane thật khi bật: `LUCY_TOOL_REGISTRY=1` rồi gọi `chatLaneAgentic`/coordinator `/chat-lane-agentic` — tool web/file/bash chạy y như cũ, dispatch đi qua registry.)

## Ví dụ manifest sinh ra (flag ON)

```
---
🧰 TOOL EM CÓ (tự thực thi được, đừng nói "không làm được"):
• 🔎 web_search — Tìm web (DuckDuckGo) → top kết quả {tiêu đề, URL}
• 🌐 web_fetch — Lấy nội dung 1 URL (text)
• 📄 read_file — Đọc file (path tuyệt đối hoặc tương đối từ workspace)
• 📁 list_dir — Liệt kê thư mục (path tuyệt đối hoặc tương đối)
• ✍️ write_file — Ghi/tạo file (path tuyệt đối hoặc tương đối từ workspace)
• ✏️ edit_file — Thay old_string → new_string trong file
• ⚡ bash — Chạy lệnh shell
• 📈 binance_price — Giá HIỆN TẠI + thống kê 24h của 1 cặp Binance (vd BTCUSDT)
• 🕯️ binance_klines — Nến OHLCV Binance
```

## Ràng buộc đã tôn trọng

- Flag default OFF · KHÔNG đổi sandbox/guard lane (workspace-only runner, blacklist chat giữ nguyên) ·
  KHÔNG đụng memory/token core · KHÔNG restart · KHÔNG git push · commit LOCAL.

## Còn lại (theo design TR-3→TR-6, KHÔNG làm trong CL-2)

- TR-4: cầu registry → MCP server (claude-path tái dùng cùng handler) = task CL-3 (đã có spec ở queue).
- TR-5: bash command-guard (`git push`/`rm -rf`) — hiện chỉ "khuyên".  TR-6: UI tab liệt kê tool từ registry.
- Khi flag chốt bật vĩnh viễn → có thể xoá đường hard-code cũ (`CHAT_TOOLS`/`ALL_TOOLS`/`execChatTool`/`execTool`).
