---
title: "M2 — TAY (MCP tools) · EXECUTION PLAN"
date: 2026-06-14
author: Lucy
status: execution-plan
parent: MCP_ARCHITECTURE.md
---

# M2 — Cho Lucy "cái tay": MCP tools (mail/lịch/drive/github/web/file)

> Worker dùng Claude Agent SDK (in-process) → SDK nhận `mcpServers` (đã dùng cho consult_expert). M2 = mount MCP per-persona/per-card qua SDK. KHÔNG nhồi hết (vỡ cache/token) — per-task scope.
> **Đêm nay (autonomous):** build FRAMEWORK + tool KHÔNG cần auth. Tool cần creds (Google/GitHub/Notion) → scaffold config + DOC, KHÔNG block, để sáng chủ nhân cắm key.

## Nguyên tắc an toàn (đêm)
- KHÔNG cài server NẶNG tự động (Playwright/chromium ~hàng trăm MB trên VPS 1.9GB) → để optional, flag tắt mặc định.
- KHÔNG restart lucy-bridge. Mỗi task tsc+smoke gate. Flag bật/tắt từng server.
- Tool ghi/xoá nguy hiểm (bash/filesystem write ngoài repo) → giữ guard như autopilot.

## Task breakdown

### M2.1 — MCP mount framework ⭐ (làm trước, no-auth)
- `mcp-registry.ts`: khai báo server (id, transport stdio/http, command/args, env-key cần, scope[], enabled-flag, persona-allow[]).
- Hàm `mcpConfigFor(persona, card)` → trả `mcpServers` object cho SDK `query()` (chỉ server persona được phép + enabled + đủ creds). Sort cố định (giữ prompt-cache).
- Wire vào worker/runner: khi chạy card → mount mcpServers tương ứng.
- Circuit-breaker nhẹ: server lỗi N lần → tắt phiên đó (không đốt token retry).
- Smoke: framework trả config đúng theo persona, server thiếu creds bị loại.

### M2.2 — Core no-auth servers (build + wire + smoke)
- **Filesystem** (`@modelcontextprotocol/server-filesystem`, scope = repo/workspace) — đọc/ghi file trong scope.
- **Fetch** (url→markdown) — hoặc tái dùng web-tools.ts đã có.
- **Git** (local repo: status/diff/log/commit — KHÔNG push tự động).
- **Time / Sequential-thinking** (nhẹ, optional).
- Mỗi cái: enabled-flag, smoke mount-thử (không cần mạng nếu được).

### M2.3 — Basic Memory MCP → lucy-vault (nối M1)
- Mount server đọc/ghi `lucy-vault` qua MCP (hoặc expose recall/episodic đã có thành MCP tool nội bộ) → agent trong pipeline cũng recall được như chat. Tận dụng coordinator /recall sẵn.

### M2.4 — GitHub connector (SCAFFOLD — cần token sáng)
- Config server `github/github-mcp-server` (hoặc `gh` CLI wrapper). Đọc token từ env `GITHUB_TOKEN` (.env.llm). enabled CHỈ khi có token.
- Đêm: cài `gh` CLI + viết wrapper + config, để `enabled=false` tới khi chủ nhân `gh auth login` / nhập token. DOC bước auth.

### M2.5 — Google Workspace (Gmail/Calendar/Drive/YouTube) ✅ LIVE (G1+G2)
- **Adapter in-process:** `agent-machine/src/google-mcp.ts` (server id `google`, status `live`). OAuth refresh access_token từ `GOOGLE_REFRESH_TOKEN` + client (`.gcp-oauth.json`) qua `token_uri` grant_type=refresh_token; cache theo `expires_in`, tự refresh khi 401 (retry 1 lần). **KHÔNG log/echo token.**
- **Tools READONLY:** `gmail_search(query,max)` · `gmail_read(id)` · `calendar_upcoming(max)` · `drive_search(query)` · `youtube_my_channel` · `youtube_search(query)`. Trả gọn (from/subject/snippet · tiêu đề+giờ · tên video/subs).
- **Bật:** `LUCY_MCP=1` + `LUCY_MCP_GOOGLE=on` + `GOOGLE_REFRESH_TOKEN` trong `.env.llm` (đã set). Gate creds = `GOOGLE_REFRESH_TOKEN`; backstop `googleConfigured()` (cần cả client file). Lỗi refresh → google bị loại phiên đó, không nổ.
- **Verify live (G2):** `npx tsx src/smoke-google-live.ts` → gmail_search('newer_than:7d',3) + youtube_my_channel (BillDev, 11 subs) + calendar_upcoming OK, KHÔNG in token. Smoke logic: `smoke-mcp.ts` 47/47 pass.
- **Thay thế:** MCP claude.ai `mcp__claude_ai_Gmail/...` (cần bấm authenticate mỗi phiên) — KHÔNG cần nữa, adapter tự refresh headless.

### M2.6 — Notion / Web(Playwright) (OPTIONAL, defer)
- Notion: scaffold config + env `NOTION_TOKEN`.
- Playwright: chỉ ghi DOC cách bật (nặng, không cài tự động đêm).

### M2.7 — UI "Kết nối" (tab) — trạng thái + bật/tắt server
- Tab Hub liệt kê MCP server: tên · trạng thái (live/cần-creds/tắt) · toggle · scope. (Có thể để sau cùng nếu hết giờ.)

## ✅ TRẠNG THÁI (2026-06-15, T4)
- **M2.1 ✅** `agent-machine/src/mcp-registry.ts` — `MCP_REGISTRY` + `mcpConfigFor(persona,ctx)` (dựng `mcpServers` cho SDK) + `mcpPlanFor` (chẩn đoán cho UI) + circuit-breaker (`mcpNoteFailure`/`mcpTripped`/`mcpResetBreaker`). Gating: master `LUCY_MCP` (mặc định TẮT) → per-server `LUCY_MCP_<ID>` (mặc định = live) → creds (`envKeys`) → persona-scope (`allow`). Sort id → prompt-cache ổn định. Wire `runner.ts`.
- **M2.2 ✅** core no-auth: `fs` (stdio `@modelcontextprotocol/server-filesystem`, scope workspace+repo, npx tự kéo) · `web` (SDK in-process, tái dùng `web-tools.ts`, SSRF-guard) · `git` (SDK in-process, status/diff/log READ-ONLY, KHÔNG commit/push, chỉ persona code).
- **M2.3 ✅** `memory` (SDK in-process: `memory_recall`=vault `hybridSearch`, `memory_episodic`=turn hội thoại; cần `LUCY_VAULT`).
- Gate: tsc 3 pkg sạch + `npm run smoke:mcp` 20/20 + lucy-vps-worker restart online (KHÔNG đụng lucy-bridge).
- **CÁCH BẬT** (khi muốn dùng): `LUCY_MCP=1` (master) trong env worker; tắt 1 server: `LUCY_MCP_WEB=off`. Mặc định TẮT để live an toàn.
- **CÒN (T5):** M2.4 GitHub scaffold + M2.5 Google/Notion scaffold + M2.7 tab "Kết nối" + endpoint coordinator `/mcp`.

## Done đêm = M2.1+M2.2+M2.3 chạy thật (no-auth) + M2.4/2.5/2.6 scaffold + DOC auth cho sáng. Mỗi task tsc/smoke gate, flag, không bridge.
## Sáng chủ nhân cần: `gh auth` / GITHUB_TOKEN · Google OAuth (bấm authenticate) · NOTION_TOKEN (nếu dùng).
