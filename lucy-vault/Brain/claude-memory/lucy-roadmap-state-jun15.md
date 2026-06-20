---
name: lucy-roadmap-state-jun15
description: "Trạng thái roadmap Lucy 2026-06-15 + quyết định execute (nhóm-1 auto, M2 chờ creds, defer M6/cleanup)"
metadata: 
  node_type: memory
  type: project
  originSessionId: dfefdf60-3a56-4920-a80e-b4fece057360
---

Chốt phiên 2026-06-15 (xem `docs/LUCY-STATE-OF-PROJECT.md` + `docs/LUCY-BACKLOG.md`). Roadmap NORTH_STAR M1-M6:
- ✅ XONG: M1 trí nhớ (+vector Jina v5/episodic/consolidation+forgetting dry-run), Phase 1.5/1.6, M3 skill+persona, UI refactor "A+" S1-S5 (theme Jarvis Cockpit), X1-X3 (Jina reranker LUCY_RERANK + reader/search LUCY_JINA_READER + matryoshka + finance MCP CoinGecko/Binance/TwelveData-scaffold).
- 🔧 M2 Tay: **GitHub + TwelveData ĐÃ BẬT LIVE (2026-06-15)** — GITHUB_TOKEN (billtruong003) + TWELVEDATA_API_KEY cắm `.env.llm`, `LUCY_MCP=1`+`LUCY_MCP_GITHUB=on`+`LUCY_MCP_TWELVEDATA=on`, worker restart, verify mcpConfigFor: builder→github, finance→twelvedata/binance/coingecko. **Notion = chủ nhân KHÔNG dùng.** **Google OAuth XONG + VERIFY (2026-06-15):** client_id/secret ở `.gcp-oauth.json` (mode 600, project strong-market-431107-n6), exchange code → GOOGLE_REFRESH_TOKEN + GOOGLE_ACCESS_TOKEN ở `.env.llm`. Verify đọc thật: Gmail truongbill003@gmail.com (20.601 mail), Calendar (event "Gym"), YouTube kênh "BillDev" 11 subs. Scope readonly: gmail/calendar/drive/youtube. **Adapter google MCP ✅ WIRE + LIVE (autobuild 2026-06-15 G1+G2):** `agent-machine/src/google-mcp.ts` server id `google` status live, refresh-token aware (tự refresh access_token, retry 401, KHÔNG echo token), tools readonly gmail_search/read·calendar_upcoming·drive_search·youtube_my_channel/search; flag `LUCY_MCP_GOOGLE=on` + GOOGLE_REFRESH_TOKEN ở `.env.llm`; worker restart, mcpConfigFor engineer mount google. Verify live `smoke-google-live.ts` Gmail/YouTube(BillDev 11 subs)/Calendar OK. Chi tiết [[mcp-t4-core]]. Muốn YouTube *quản lý* (ghi) → thêm scope `youtube` sau.
- 🔧 M4 chủ động: cron_dream/watchers/brief xong; còn webhook event (mail/PR) — phụ thuộc M2.
- 🔧 M5 cost: dashboard có; còn time-series/sparkline (đang làm ở nhóm-1).

**Quyết định execute (chủ nhân 2026-06-15):**
- Chạy **NHÓM 1** auto (an toàn, không creds): M5 sparkline + sanitize Telegram brief + trim .snapshots + verify reranker. (auto-build opus đang chạy.)
- **M2** chờ chủ nhân cắm key (tự nhập .env.llm, không paste chat).
- ⏸️ **DEFER (chưa cần, HỎI LẠI sau):** M6 voice/remote (tốn token) + sprint dọn-nhà/restructure folder. Đừng tự làm 2 cái này.

## ✅ CẬP NHẬT 2026-06-16 — gỡ "tạm dừng", chủ nhân quay lại xử task block
**Đã EXECUTE (task đơn-giản đang-chờ-block):** restart `lucy-bridge` 1 lần (tiến trình chạy bản cũ 46h, file đã sửa 00:26) → giờ LIVE: `/new` (xoá session --resume + lane hist = bắt đầu ngữ cảnh trắng, KHÔNG đốt token tích luỹ) · `/stop` (bắt ngay trong poll, xoá hàng đợi) · episodic_log Py · @persona lane · recall-prefetch bridge. Restart an toàn: Hermes KHÔNG poll bot (bridge chạy 46h không 409), creds đầy đủ trong env pm2 (/proc verify), plain `pm2 restart` giữ env. Verify: online + loop_err đứng yên ~45s = poll OK. embed.ts đã sạch "1024" (cleanup cũ đã xong). **Quy tắc /new cho chủ nhân: gõ `/new` mỗi khi đổi chủ đề để khỏi đốt token ngữ cảnh cũ.**

**TASK CÒN LẠI (lưu não — lần sau hỏi tới thì nhớ, KHÔNG có cái nào "đơn giản execute" nữa, đều medium/cần-duyệt):**
- 🔑 *Cần chủ nhân quyết/creds:* watcher cron */30 ngưỡng giá (set coin+mức) · reviewer-spec (nối pipeline hay xoá?) · multi-device session (3 hướng) · UI Reactor-home bật mặc định? · M3.6 đại tu UI/Jina (chọn R1/R2). Notion = BỎ (chủ nhân không dùng).
- 🧪 *Flag chờ duyệt (xem dry-run trước khi bật):* `LUCY_CONSOLIDATE_APPLY` (gộp/quên memory thật) · `LUCY_SKILL_LEARN` (tự ghi skill thật).
- 🤖 *Lucy tự làm được nhưng MEDIUM (cần 1 sprint, hỏi trước khi làm):* M4 webhook mail/PR (giờ ĐÃ unblock vì Google+GitHub live) · M4 wake-gate · M4 brief cá-nhân-hoá theo watchlist · M5 ledger cost gộp per agent/model + cảnh báo ngưỡng · M5 tool-slim/nén context · Matryoshka tune · audit vault 15.6k file.
- ⏸️ *DEFER (chủ nhân chốt — đừng tự làm):* M6 voice/remote · sprint dọn-nhà/restructure folder · Jina omni đa-phương-thức ảnh (chờ xong đại tu UI).

## ⏸️⏸️ (LỊCH SỬ) BUILD-TIẾP LUCY = TẠM DỪNG cuối phiên 2026-06-15 — ĐÃ GỠ ở mục Jun-16 trên
Chủ nhân sẽ start session mới hỏi việc KHÁC; vụ xây Lucy để sau. Nhóm-1 (M5 sparkline + sanitize Telegram + trim snapshots + reranker) ĐÃ XONG. **Khi quay lại build tiếp → đọc `docs/LUCY-BACKLOG.md` (checklist M2-M6) + `docs/LUCY-STATE-OF-PROJECT.md`.** Còn lại chính: M4 chủ động (webhook mail/PR — giờ có Google+GitHub rồi nên làm được) · M5 ledger gộp · bật consolidation/skill-learn (xem diff) · cleanup folder · M6 (defer). M2 Tay = GitHub✅ Tài-chính✅ Google/YouTube✅ — gần đủ bộ.

**Lưu ý:** vault 15.6k file .md = 94% là `.snapshots` backup (recall KHÔNG index → không chậm); não thật ~880 (Brain 576 + Daily 297). Cron đã fix claude-root (xem [[claude-root-permission-flag]]). Liên quan [[lucy-hub-ui-redesign]] [[mcp-t4-core]] [[lucy-longterm-memory-buildout]].
