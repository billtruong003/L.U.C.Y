# Lucy — EXECUTION LOG (nhật ký đã làm) · phiên 2026-06-13 → 06-14

> Tất cả việc đã EXECUTE (manual + auto-build). Chi tiết kế hoạch: MASTER-SPEC.md. ✅ = xong + verify.

## PHẦN 1 — LÀM TAY (cùng Bill)

### Hạ tầng / fix dọc đường
- ✅ Fix cron tech-digest + định tuyến Discord (finance vs tech thread) · bỏ max-turns runner · bỏ budget cap · concurrency guard cron
- ✅ Fix nginx SSE "fail fetch" (proxy_buffering off + timeout 1200s cho /api/chat/stream)
- ✅ Queue chat web (gửi nhiều tin → xếp hàng, không mất) · chat hiện vô tab Tasks
- ✅ Fix bridge cắt tin dài (tin vừa-dài hiện thẳng chat chia nhiều phần, chỉ file khi bảng/cực dài)

### Section A — Thinking UI mới
- ✅ Timeline 💭thinking / 🔧tool-card (tên+tham số+kết quả, collapse) / ✅final · badge model · live status · avatar pulse · server emit tool_use/tool_result

### Dream / Galaxy
- ✅ Dream prune lớp 1: tự xoá pref retired >30d + dedup file trùng topic (pinned miễn, snapshot backup) — test PASS

### Agent SDK migration (Đường B) — bỏ spawn `claude -p`, in-process
- ✅ Hub `streamClaude` · dream-brain · runner `ClaudeRunner`+salvage · **bridge Telegram** (cài python3-pip + claude-agent-sdk, giữ fallback `LUCY_BRIDGE_ENGINE=spawn`, backup .bak-presdk) — tất cả verified, chạy auth subscription

### Phase E — Context & trí nhớ
- ✅ E1 chống tràn (Claude/SDK auto-compaction) · E2 recall bookend goal/done/pending · E3 badge cache%/ctx mỗi lượt chat

### Phase D bug
- ✅ D6 giữ status khi out web (sync khi focus + SSE đứt không lỗi đỏ) · D7 auto-route giữ context (phiên có context → không hạ model rẻ)

### Phase K (multi-agent) + J + L2 + M
- ✅ K3 visual brain agent (galaxy có chòm "Não agent" builder/eng/reviewer)
- ✅ J chat đa-phiên (store chats/<id>.json + sidebar ☰ + migrate chat.json cũ)
- ✅ L2 lane chat mang persona + history (verified gemini/nemotron nhớ qua lượt)
- ✅ M tool harness cho lane: web-tools.ts (web_search/web_fetch no-key DDG, SSRF-guard) + lane-chat.ts (vòng agentic web/file/bash) + coordinator /chat-lane-agentic + hub route tool-capable + tool-card #3. Verified Nemotron tự web_search→web_fetch giá BTC.
- ✅ K1 thêm persona marketing/finance/researcher · K2 consult_expert (sub-agent persona+brain, chặn đệ quy, tool-card)

### Automation
- ✅ auto-build.py (Agent SDK Python): tự chạy task theo MASTER-SPEC khi Bill vắng. can_use_tool chặn lệnh nguy hiểm (rm -rf/git push/restart bridge), đo cost, báo Telegram từng task, dừng khi cần Bill. pm2 `lucy-autobuild`.

### Tài liệu kế hoạch
- MASTER-SPEC.md (canonical) · VISION-JARVIS.md · PLAN-ALL.md · ROADMAP-D-PLUS / NEXT / MULTIAGENT-PERSONA · PHASE-E-OVERVIEW · PHASE-FGH-DETAIL · PHASE-L-UNIFIED-CONTEXT · PHASE-M-UNIVERSAL-TOOLS · BEYOND-HERMES-IDEAS

## PHẦN 2 — AUTO-BUILD (Lucy tự chạy, Bill vắng)

### Batch 1 (8 task, ~$26.42, xong 02:43 14/06)
1. ✅ L4 catalog scrape — refreshOpenRouterCatalog() fetch /models lúc startup + /llm/catalog-refresh; 45 model (21 curated + 24 discovered)
2. ✅ L3 compressor lane — token-aware sliding window (5000 tok, min 6 verbatim, older→summary) thay cap cứng 24 msg
3. ✅ consult_expert cho claude-path — qua in-process MCP (createSdkMcpServer) + coordinator /consult-expert; verified Expert Shiro trả lời
4. ✅ bridge run_lane history+tool — lane Telegram có history per (chat_id,model) + tool agentic (active sau bridge restart)
5. ✅ F1 dọn smoke đỏ — tách waitKind loop vs stuck trong engine.ts; smoke 20/20, verify-gate-loop 7/7, conc 7/7
6. ✅ F2 CI gate — .github/workflows/ci.yml (typecheck 3 package + smoke 20/20); fix @types/three + Planner.tsx
7. ✅ #4-infra watcher framework — watcher.ts (health/disk/process/price + cooldown + Telegram alert) + CLI + watchers.json (3 system enabled). Cần Bill: thêm cron */30
8. ✅ BH-F RSI watcher — kind rsi, CoinGecko RSI(14) Wilder; BTC enabled (alert <30/>70, cooldown 12h); verify BTC RSI=26 triggered

### Batch 2 (đang chạy — bắt đầu 02:45 14/06)
- ⏳ đang làm vòng 1/8 (task auto-able tiếp: F3 tách engine.ts / F4 types / BH-D routing tự học / BH-B galaxy node thật...). Báo Telegram từng task.

## CHỜ BILL QUYẾT (auto-build tự bỏ qua)
- ⏸️ **N — Jarvis UI** (chọn hướng 1 incremental / 2 tái thiết kế lớn / 3 mockup trước)
- K4 persona registry UI (UX) · cron watcher */30 (Bill bật) · price-watcher set ngưỡng

## CÒN LẠI (auto-able, batch sau)
F3 tách engine.ts · F4 types chung · F5 e2e test · BH-D routing tự học · BH-B galaxy node→điểm thật · BH-G replay/explainability · G/H · cron lọc tin xàm
