---
title: "LUCY — BACKLOG (task còn lại theo kế hoạch M1-M6)"
date: 2026-06-15
author: Lucy
status: backlog
---

# Task CÒN LẠI theo kế hoạch (NORTH_STAR M1-M6 + memory + cleanup)

> Ký hiệu: 🔑 cần chủ nhân (creds/quyết định) · 🤖 Lucy tự làm được · 🧪 bật flag sau khi duyệt.

## M2 — TAY (MCP) — ~70%, ưu tiên 1
- [ ] 🔑 Cắm **GITHUB_TOKEN** (hoặc `gh auth`) → bật GitHub MCP (đọc repo/PR/issue).
- [ ] 🔑 **Google OAuth** (Gmail·Calendar·Drive) → bật đọc mail/lịch/file.
- [ ] 🔑 **NOTION_TOKEN** (nếu dùng Notion).
- [ ] 🔑 **TWELVEDATA_API_KEY** → bật CK/forex/vàng (CoinGecko/Binance đã keyless).
- [ ] 🤖 Sau khi có creds: bật `LUCY_MCP=1` + verify từng tool live (smoke gọi thật).
- [ ] 🤖 Web/Browser MCP (Playwright cloud/Browserbase — tránh Chromium local nặng).

## M4 — CHỦ ĐỘNG — 1 nửa
- [ ] 🤖 **Webhook/event-driven**: mail mới / PR mới → Lucy tự tóm tắt + đề xuất xử (cần M2 mail/github trước).
- [ ] 🤖 **Wake-gate**: Lucy tự "thức" phản ứng sự kiện thay vì chỉ cron cố định.
- [ ] 🔑 **Watcher cron */30** + ngưỡng giá cảnh báo (chủ nhân set coin/mức) — watcher framework đã có.
- [ ] 🔑 **Cron lọc tin xàm mỗi tối** — cần chủ nhân duyệt "công thức cronjob" trước.
- [ ] 🤖 Brief cá nhân hoá (theo watchlist chủ nhân thay vì generic).

## M5 — TOKEN/COST
- [x] 🤖 **Dashboard time-series + sparkline** (token/cost 7d/24h/30d) — ✅ N1.1: `buildSeries` bucket ledger (24h/giờ, 7d/30d/ngày, zero-fill=số thật) → `/metrics.series` → Sparkline SVG + range-toggle. Live: 7d 36.5M/$99, 30d 37.6M/$146.8.
- [ ] 🤖 Ledger cost gộp (per agent/model/card) + cảnh báo ngưỡng.
- [ ] 🤖 Tool-slim + nén context (giảm token mỗi turn).

## M6 — ĐA MẶT (xa)
- [ ] 🤖 Voice (Whisper) input/output.
- [ ] 🤖 Remote control (điều khiển agent + máy từ xa).
- [x] Mobile polish — ✅ làm ở UI refactor (responsive S2/S5).

## MEMORY (M1+) — bật nốt phần dry-run
- [ ] 🧪 Bật **LUCY_CONSOLIDATE_APPLY** sau khi xem dry-run diff (gộp/quên memory thật).
- [x] 🤖 Wire **Jina reranker** vào recall — ✅ N1.4 verify: `maybeRerank` đã nối ở MỌI return path của `hybridSearch` (flag `LUCY_RERANK`, lỗi→giữ RRF). smoke-vector PASS (gold lên đầu + lỗi không nổ).
- [ ] 🤖 **Matryoshka** tune (cắt chiều tiết kiệm RAM khi vault phình).
- [ ] 🤖 **Omni đa phương thức**: index ảnh/chart/mockup → search bằng chữ (phục vụ UI + tài chính).
- [ ] 🤖 Dọn comment sai "dim 1024" → 768 trong `embed.ts`.

## M3 — TỰ HỌC — bật nốt
- [ ] 🧪 Bật **LUCY_SKILL_LEARN** (self-improve ghi skill thật) sau khi tin.
- [ ] 🤖 **@persona trên Telegram** cần **restart bridge** để code lane mới có hiệu lực (giờ chỉ live ở Hub).

## UI — phần treo
- [ ] 🔑 Quyết **Trang chủ Reactor** (flag `lucy.reactorHome`): bật mặc định hay bỏ? (bật ở Settings xem vibe).
- [x] 🤖 Dashboard sparkline — ✅ gộp vào N1.1 (M5).

## ⏸️ DEFER (chủ nhân 2026-06-15 — chưa cần, để dành, HỎI LẠI sau)
- **M6 Voice/Remote** — tốn token build, chủ nhân chưa cần. Đừng tự làm; chờ chủ nhân yêu cầu.
- **Sprint "dọn nhà" (restructure folder)** — chưa gấp; làm khi rảnh, sprint riêng có git revert.

## CLEANUP / OPS
- [ ] 🤖 **Restructure folder**: archive `hermes/voice/dashboard cũ/__pycache__`, chia `docs/` + `agent-machine/src/` thành thư mục con (sprint "dọn nhà", git từng bước).
- [ ] 🤖 **Audit vault ~15.6k file .md** — lọc rác/clone để recall sạch.
- [x] 🤖 **Telegram markdown parse** — ✅ N1.2: `bridge/lib/tg_send.sh` (sanitize cân bằng */_/` + nếu parse lỗi → tự gửi lại PLAIN không mất tin); wire vào cron_brief/cron_tech/cron_vn.
- [x] 🤖 **Trim .snapshots** — ✅ N1.3: prune giữ 30 bản mới nhất (theo mtime) tự động trong `dream.ts:snapshot()`; one-time trim 59→30 dir (rollback-only, không index).
- [ ] 🤖 Restart bridge 1 lần để áp: episodic_log Py + @persona + recall-prefetch bridge (xác nhận đã live chưa).

## QUYẾT ĐỊNH TREO (cần chủ nhân)
- [ ] 🔑 **reviewer-spec**: nối dây vào pipeline (2-stage review) hay xoá?
- [ ] 🔑 **Multi-device session** (bảo mật): hướng (1) Hub xem+thu hồi phiên/thiết bị · (2) Telegram khoá device · (3) cả hai?
- [ ] 🔑 **đại tu UI / Jina research (M3.6)**: đã có proposal R1+R2 — chọn execute phần nào.

## ✅ ĐÃ XONG (tham chiếu)
M1 trí nhớ (+vector/episodic) · Phase 1.5/1.6 · M3 skill+persona · MCP core+tài chính · UI refactor A+ (S1-S5) · brief/tech/VN cron (đã fix claude-root) · galaxy sphere+2D · X1-X3 (Jina reranker/reader/matryoshka + finance MCP).

→ **Thứ tự đề xuất:** M2 (cắm creds) → M4 (chủ động) → M5 (cost) → cleanup → M6.
