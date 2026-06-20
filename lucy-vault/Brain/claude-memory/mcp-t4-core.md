---
name: mcp-t4-core
description: T4 MCP core — registry+gating dựng mcpServers cho SDK per-persona; core no-auth fs/web/git/memory; flag LUCY_MCP mặc định TẮT
metadata: 
  node_type: memory
  type: project
  originSessionId: 92ce5b4f-3f19-4aaf-b82f-bb2338aed3dd
---

T4 (2026-06-15) — "cái TAY" cho agent-machine: `agent-machine/src/mcp-registry.ts`.

- `MCP_REGISTRY` khai báo server; `mcpConfigFor(persona, {workspace,repoRoot,vault})` → object `mcpServers` cho SDK `query()`; `mcpPlanFor` = chẩn đoán (cho UI Kết nối T5). Wire ở `runner.ts` (gộp `mcpAllowedTools` vào allowedTools, chỉ truyền mcpServers khi master bật).
- Gating tầng: master `LUCY_MCP` (**mặc định TẮT** → mcpConfigFor trả {} → runner y hệt cũ, live an toàn) → per-server `LUCY_MCP_<ID>` (mặc định = status live) → creds `envKeys` → persona-scope `allow`. Sort id ổn định prompt-cache. Circuit-breaker 3-lỗi (`mcpNoteFailure`/`mcpTripped`/`mcpResetBreaker`).
- Core no-auth (status live): `fs`=stdio `@modelcontextprotocol/server-filesystem` (scope workspace+repo, npx tự kéo) · `web`=SDK in-process tái dùng `web-tools.ts` (`web_fetch`/`web_search`, SSRF-guard) · `git`=SDK in-process READ-ONLY (`git_status`/`git_diff`/`git_log`, KHÔNG commit/push, chỉ persona code) · `memory`=SDK in-process (`memory_recall` vault hybridSearch + `memory_episodic` turn, cần LUCY_VAULT).
- SDK in-process dùng `createSdkMcpServer`+`tool`+zod4 (zod 4.4.3 khớp peer ^4 của SDK).
- Gate: tsc 3 pkg sạch · `npm run smoke:mcp` 20/20 · lucy-vps-worker restart online (env preserve qua pm2 dump, KHÔNG đụng lucy-bridge).
- Bật khi cần: `LUCY_MCP=1` env worker; tắt 1 server `LUCY_MCP_WEB=off`.
- T5 ✅ (2026-06-15): scaffold `github` (stdio server-github, env GITHUB_TOKEN→GITHUB_PERSONAL_ACCESS_TOKEN, persona code, mặc định tắt) + `notion` (stdio @notionhq/notion-mcp-server qua OPENAPI_MCP_HEADERS, env NOTION_TOKEN) + `google` DOC-only (build→null, OAuth cần chủ nhân bấm authenticate). `mcpRegistryOverview()` cho UI (state live/needs-creds/disabled/master-off/tripped, ưu tiên creds trước flag). Endpoint coordinator `GET /mcp` + proxy hub `GET /api/mcp` (auth-gated) + `amMcp()`. Tab "Kết nối" `Connect.tsx` (glass list READ-ONLY, không toggle giả — bật = env-flag worker). smoke:mcp 35/35. **Cần chủ nhân: GITHUB_TOKEN / Google OAuth / NOTION_TOKEN → cắm env worker + LUCY_MCP=1 + LUCY_MCP_<ID>=on.**
- **G1+G2 ✅ (2026-06-15): Google Workspace LIVE** — `agent-machine/src/google-mcp.ts` server id `google` status **live** (thay stub DOC-only cũ). OAuth refresh access_token từ `GOOGLE_REFRESH_TOKEN` + client `.gcp-oauth.json` (token_uri grant_type=refresh_token), cache theo expires_in, tự refresh khi 401 retry-1, **KHÔNG log/echo token**. Tools READONLY: `gmail_search`/`gmail_read` · `calendar_upcoming` · `drive_search` · `youtube_my_channel`/`youtube_search`. Gate creds=`GOOGLE_REFRESH_TOKEN` + backstop `googleConfigured()` (cần client file). Bật: `.env.llm` đã có `LUCY_MCP=1`+`LUCY_MCP_GOOGLE=on`+refresh token. Verify live: `npx tsx src/smoke-google-live.ts` → Gmail/YouTube(BillDev 11 subs)/Calendar OK no-token; `smoke-mcp.ts` 47/47. Restart lucy-vps-worker (KHÔNG lucy-bridge), mcpConfigFor engineer mount [fs,git,github,google,memory,web]. **KHÔNG cần MCP claude.ai authenticate nữa** (adapter headless).
- CÒN T6: Skill engine (SKILL.md store + loader progressive-disclosure + self-improve đề xuất + tab Kỹ năng). Xem [[persona-chat-routing-t3]], [[lane-agentic-tools]].
