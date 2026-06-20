---
name: jina-reader-finance-mcp
description: "X2 Jina Reader/Search trong web-tools + X3 finance MCP (binance/coingecko keyless, twelvedata scaffold) — flags + cách bật"
metadata: 
  node_type: memory
  type: project
  originSessionId: 48010496-06f4-4233-ad37-68d5f419a08f
---

X2 + X3 từ R2 research (2026-06-15), tất cả flag-gated, mặc định an toàn (live behavior không đổi tới khi bật flag).

X2 — Jina Reader/Search (`agent-machine/src/web-tools.ts`):
- Flag `LUCY_JINA_READER` (mặc định TẮT). Bật → `webFetch` dùng `r.jina.ai/<URL>` (markdown sạch), `webSearch` dùng `s.jina.ai/?q=`; lỗi/non-2xx → fallback DuckDuckGo/stripHtml cũ.
- Key Jina TÙY CHỌN qua `jinaKey()` (export mới ở embed.ts) — có key rate cao hơn, không bắt buộc. URL vẫn qua SSRF guard.

X3 — Finance MCP (`mcp-registry.ts`, scope persona `isFinance` = finance/analyst/marketing/researcher), hiện ở tab "Kết nối" qua GET `/mcp`:
- **binance** (live, KEYLESS, in-process `market-tools.ts`): `binance_price` + `binance_klines`. Tắt: `LUCY_MCP_BINANCE=off`. Host đổi: `BINANCE_REST_URL`.
- **coingecko** (live, KEYLESS, remote SSE `mcp.api.coingecko.com/sse`): đổi qua `COINGECKO_MCP_URL`.
- **twelvedata** (scaffold, CẦN `TWELVEDATA_API_KEY` + `LUCY_MCP_TWELVEDATA=on`): CK/forex/vàng XAU; endpoint `TWELVEDATA_MCP_URL`. Thiếu key → DOC-only.
- Tất cả vẫn sau master `LUCY_MCP` (mặc định TẮT). Smoke `smoke:mcp` Case J phủ.

⚠️ Cần chủ nhân: `TWELVEDATA_API_KEY` (twelvedata.com, free 800 credit/ngày) để bật CK/forex/vàng. X1 (reranker + matryoshka) đã xong vòng trước. Liên quan [[lucy-memory-phase1-hybrid-vector]] [[mcp-t4-core]] [[lane-agentic-tools]].
