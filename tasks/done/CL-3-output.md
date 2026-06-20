# CL-3 — Cầu Registry ↔ MCP (1 handler 2 đầu ra) — DONE ✅

**Phụ thuộc:** CL-2 (Tool Registry) đã xong & commit (a3a9819) — registry có sẵn, KHÔNG chế tạm.

## Làm gì
1 tool khai báo MỘT lần ở CL-2 registry (`src/tools/registry.ts` + `lane-tools.ts`) giờ chạy
được ở **cả 2 path**, dùng **chung 1 handler** + chung `sanitizeError`:

- **lane (tool-call OpenAI):** `getLaneToolDefs(toolset)` + `dispatchTool()` — đã có từ CL-2.
- **claude (MCP in-process):** adapter mới `registryMcpServer(toolset, ctx)` → `createSdkMcpServer`.

## File
- **MỚI** `src/tools/registry-mcp.ts` (adapter):
  - `jsonSchemaToZodShape()` — chuyển `e.schema` (JSON Schema phẳng của registry) → ZodRawShape
    mà SDK `tool()` cần (required→bắt buộc, còn lại `.optional()`).
  - `registryMcpServer(toolsets, ctx, opts?)` — resolve toolset → map mỗi `ToolEntry` thành
    `tool(name, desc, zodShape, async a => T(await dispatchTool(name, a, ctx)))` → 1 SDK MCP server.
    **Cùng `e.handler`** với lane (qua `dispatchTool`). Toolset rỗng → trả `null` (không vỡ).
  - `registryBothPaths()` — tiện ích chứng minh "1 handler 2 đầu ra" (trả `{laneDefs, mcpServer}`).
  - `REGISTRY_MCP_DEFAULT_TOOLSETS = ['web','fs-rw']` — nhóm no-auth thử nghiệm (KHÔNG gồm bash).
- **SỬA** `src/mcp-registry.ts` — THÊM 1 spec `id:'registry'` (ADDITIVE, không đụng 13 server cũ,
  giữ nguyên per-persona allow + circuit-breaker + `mcpConfigFor`).
  - `status:'scaffold'` → `serverEnabled` mặc định `false` ⇒ **TẮT kể cả khi `LUCY_MCP=1`**.
  - `build: ctx => registryMcpServer(['web','fs-rw'], {ws: ctx.workspace, mode:'runner'}, {name:'registry'})`.
  - mode `runner` ⇒ fs bó CHẶT trong workspace (`resolveRunner`), không thoát ra ngoài.
- **MỚI** `src/smoke-registry-mcp.ts` + script `npm run smoke:registry-mcp`.

## Cách 1 handler phục vụ 2 path
`ToolEntry.handler` viết 1 lần trong `lane-tools.ts`. lane gọi qua `dispatch()`; MCP cũng gọi qua
chính `dispatchTool()` (bọc kết quả string vào `{content:[{type:'text',text}]}` cho SDK). Schema
khai 1 lần (JSON Schema) → lane dùng nguyên, MCP convert sang Zod. Đổi/thêm tool = sửa 1 chỗ.

## Tool đã thử (qua adapter)
`web_search`, `web_fetch` (toolset web) + `read_file`, `list_dir`, `write_file`, `edit_file`
(toolset fs-rw) = 6 tool no-auth. `bash`/`market` KHÔNG đưa vào nhóm thử (an toàn).

## Cách BẬT + verify
- Mặc định: cả `LUCY_MCP` và `LUCY_MCP_REGISTRY` OFF → `mcpConfigFor` KHÔNG có `registry`,
  runner chạy y như cũ.
- Bật thử: `LUCY_MCP=1` **và** `LUCY_MCP_REGISTRY=on` (cần CẢ HAI). Bật xong tool registry
  xuất hiện dưới prefix `mcp__registry__<tool>` cho mọi persona.

## Verify (đã chạy thật)
- `npx tsc --noEmit` → **EXIT 0** (PASS).
- `npm run smoke:registry-mcp` → **12 pass / 0 fail**:
  - A: `LUCY_MCP` OFF → không có server `registry` (hành vi cũ).
  - B: `LUCY_MCP=1` mà `LUCY_MCP_REGISTRY` chưa set → vẫn KHÔNG mount (scaffold default off).
  - C: cả 2 flag ON → mount + build được server.
  - D: cùng toolset ra 6 lane def + mcpServer non-null (1 handler 2 path).
  - E: zod shape required/optional đúng. F: toolset lạ → null không vỡ.
- `npx tsx src/smoke-mcp.ts` (path MCP cũ) → **47 pass / 0 fail** — không phá gì.

## Ràng buộc giữ đúng
FLAG-GATED default OFF · ADDITIVE · forward-only · không đụng memory/token core ·
KHÔNG restart · KHÔNG git push (commit local) · không import vòng (mcp-registry → registry-mcp,
không ngược lại).
