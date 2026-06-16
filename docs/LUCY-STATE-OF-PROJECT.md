---
title: "LUCY — TỔNG KẾT DỰ ÁN (state of project)"
date: 2026-06-15
author: Lucy
status: overview
---

# LUCY — Hiện có gì, xịn tới đâu (đọc cái này để nắm toàn cảnh)

> Lucy = trợ lý cá nhân kiểu Jarvis của chủ nhân, chạy 24/7 trên VPS, điều khiển qua *Telegram* + *web Hub* (http://14.225.255.73). Ký hiệu: ✅ live · 🚩 có nhưng tắt mặc định (flag) · 🧪 dry-run (chờ duyệt) · 🔌 scaffold (chờ cắm key).

## 0. TL;DR — xịn tới đâu
Lucy giờ là **một hệ khá hoàn chỉnh**: *nhớ xuyên phiên* (vector đa ngữ), *nói chuyện* qua Telegram + web, *đội nhiều agent tự build code*, *báo cáo thị trường/tin tự động*, *bộ "tay" MCP* (file/web/git/tài chính) sẵn sàng, và *web Hub đại tu xong* (theme Jarvis Cockpit + galaxy 3D). Còn thiếu: nối mail/lịch/GitHub thật (chờ key), và vài thứ "nice-to-have" bên dưới.

## 1. Kiến trúc (đơn giản)
- **lucy-bridge** (Telegram ↔ Claude Agent SDK) — chủ nhân chat ở đây.
- **lucy-hub** (web :80) — command center.
- **lucy-coordinator** (:8780) — não điều phối: recall/memory/persona/MCP/lane.
- **lucy-vps-worker** — chạy card build (multi-agent).
- **lucy-autopilot** — Lucy tự duyệt việc ban đêm.
- **lucy-vault** — bộ não markdown (1 nguồn sự thật).
- Chạy bằng *Claude Max subscription* (không tốn token API), việc nhẹ đẩy *model free* (Nemotron/Gemini/DeepSeek).

## 2. TÍNH NĂNG ĐẦY ĐỦ (kèm ví dụ)

### A. TRÍ NHỚ 🧠
- ✅ **Recall xuyên phiên** — trước mỗi câu, Lucy tự tra vault chèn mẩu liên quan. *VD:* phiên mới hỏi "ngưỡng RSI BTC mình chốt?" → nhớ ra "RSI<30/>70, cooldown 12h".
- ✅ **Hybrid FTS5 + vector** (sqlite-vec + Jina v5 đa ngữ) — tìm theo NGHĨA. *VD:* hỏi tiếng Anh "who is the owner" → kéo đúng note hồ sơ tiếng Việt.
- ✅ **Episodic** — nhớ lại hội thoại cũ. *VD:* "hôm trước mình bàn gì về Jina?" → kéo turn cũ.
- ✅ **Galaxy 3D** — bản đồ tri thức (quả cầu, time-travel, 2D fallback máy yếu).
- 🧪 **Consolidation + Forgetting** (Mem0/Zep-style) — gộp trùng + vô hiệu fact mâu thuẫn; *đang DRY-RUN*, chờ chủ nhân bật `LUCY_CONSOLIDATE_APPLY`.
- ✅ **Secret-redaction** — key/token bị scrub trước khi embed/lưu.

### B. HỘI THOẠI 💬
- ✅ **Telegram bridge** đa lượt + recall + lưu episodic.
- ✅ **Hub chat** SSE streaming + đa phiên (sidebar ☰).
- ✅ **Lane free-model có tool** — model rẻ tự web_search/web_fetch/bash. *VD:* chọn Nemotron hỏi "giá BTC?" → nó tự tra web ra số thật.
- ✅ **Persona chat + auto-routing** 🚩 — nhắn thẳng 1 chuyên gia / Lucy tự chọn. *VD:* "@finance phân tích vàng" hoặc tự route câu tài chính → persona finance.
- ✅ **consult_expert** — Lucy gọi 12 expert (finance/marketing/security/devops...) khi cần góc sâu.

### C. ĐỘI AGENT TỰ BUILD 🤖
- ✅ **Card pipeline** (Kanban) — giao việc → nhiều agent làm theo stage (build→review→deploy).
- ✅ **17 persona** (anime crew + 12 expert), não nghề riêng học dần.
- ✅ **Autopilot trực đêm** — Lucy tự đẻ sprint + tự duyệt (trừ deploy/security/secret để chủ nhân).
- ✅ **Routing tự học (BH-D)** — học từ feedback chọn model tốt dần.
- ✅ **Token-guard** — sắp cạn quota → tự park + báo, không fail cứng.
- 🚩 **Skill engine** — match trigger nạp SKILL.md; self-improve *chỉ đề xuất* (gated).
- ✅ **auto-build.py** — Lucy tự build feature theo plan khi chủ nhân vắng (chính cái dựng cả đợt này).

### D. "TAY" — MCP TOOLS 🔌
- ✅ Framework mount MCP per-persona (flag `LUCY_MCP` mặc định TẮT cho an toàn).
- ✅ Core no-auth: filesystem · web · git (read-only) · memory.
- 🔌 GitHub / Google (Gmail·Calendar·Drive) / Notion — *scaffold sẵn, chờ chủ nhân cắm key*.
- ✅ Tài chính: CoinGecko (keyless) · Binance REST · 🔌 Twelve Data (CK/forex/vàng, chờ `TWELVEDATA_API_KEY`).

### E. WEB HUB (đại tu xong) 🎨
- ✅ **Theme "Jarvis Cockpit"** — glass-minimalism + hover-reveal, cyan+gold, dark.
- ✅ **Nav gom nhóm + Cmd+K** command palette.
- ✅ **Galaxy sphere** (perf: render-on-demand, 2D fallback) · **Persona roster** RPG · **Tasks kanban** · **Connect (MCP)** · **Skills**.
- 🚩 **Trang chủ Reactor** (arc-reactor + vòng đo metric thật) — bật ở Settings.
- ✅ **Responsive** (rail co, bottom-sheet, mobile) + **a11y** (keyboard, aria, reduced-motion).

### F. BÁO CÁO TỰ ĐỘNG 📰
- ✅ **Daily brief thị trường** (7h+17h) — crypto/vàng/CK/macro → Telegram + web report.
- ✅ **Tech digest** + **VN brief** (chứng khoán VN + tin VN) — cron riêng.
- ✅ **Dream 2h sáng** — gộp memory + sinh "preference".
- ✅ **Watchers** — health/disk + RSI BTC (alert quá mua/bán); cần chủ nhân bật cron */30 + ngưỡng giá.

## 3. ĐÁNH GIÁ
**Mạnh:** trí nhớ thật (vector đa ngữ) + multi-agent + báo cáo tự động + UI đẹp/đo được — hiếm trợ lý cá nhân solo nào có đủ combo này. Kỷ luật tốt: mọi thứ flag-gated, không phá data, chạy subscription (rẻ).
**Yếu/đang dở:** (a) "tay" mail/lịch/github chưa nối thật (chờ key); (b) consolidation/forgetting còn dry-run; (c) Dashboard chưa có time-series/sparkline; (d) repo có folder rác (hermes/voice/dashboard cũ); (e) Telegram đôi khi lỗi parse markdown.

## 4. NICE-TO-HAVE (đề xuất)
1. **Bật "tay" thật**: cắm GitHub token + Google OAuth → Lucy đọc mail/lịch/repo (biến đổi lớn nhất).
2. **Nối feed thị trường vào Hub** (Reactor ring + Dashboard market block) qua finance MCP — giờ số thị trường mới ở Telegram.
3. **Bật consolidation/forgetting** sau khi xem dry-run diff → memory tự gọn.
4. **Dashboard time-series** (token/cost/market 7d/24h) — đã defer ở S3.
5. **Reranker Jina** wire vào recall (đã có client, tăng độ chính xác).
6. **Nút 👍/👎** trong Hub cho routing tự học (backend có, UI chưa).
7. **Watcher cron */30** + ngưỡng giá cảnh báo (chủ nhân set).

## 5. RESTRUCTURE FOLDER (gọn lại)
Top-level hiện: `agent-machine bridge dashboard docs hermes hub lucy-vault references skills tools voice workspace __pycache__`.
- 🗑️ **Dọn/archive:** `hermes/` (đã nghỉ hưu) · `voice/` (chưa dùng) · `dashboard/` (nếu trùng hub) · `__pycache__/` · `references/` (gom vào docs/_ref). → tạo `_archive/` cho gọn, không xoá cứng.
- 📁 **docs/** 49 file đang phẳng → chia `docs/{memory,ui,mcp,ops,research,_archive}/`.
- 📁 **agent-machine/src** 124 file phẳng → gom `src/{memory,engine,lane,mcp,skill,cron,cli}/` (refactor dần, không gấp).
- ⚠️ vault có ~15.6k file .md — nên kiểm xem có lẫn rác/clone không (dọn để recall sạch).
> Làm thành 1 sprint "dọn nhà" riêng, có git commit từng bước để revert được.

## 6. PHASE SAU — theo ĐÚNG roadmap M1–M6 (NORTH_STAR.md)
> Cập nhật trạng thái thật sau đợt build 14-15/06 (nhiều mốc đã nhảy vọt so với bảng gốc):
- **M1 Trí nhớ** ✅ XONG + VƯỢT KẾ HOẠCH (gốc chỉ FTS5; giờ có vector Jina + episodic + consolidation/forgetting dry-run). *Còn:* bật `LUCY_CONSOLIDATE_APPLY` sau khi xem diff + wire reranker.
- **Phase 1.5 Đa-model + Dashboard** ✅ (skill-loader đã wire ở M3).
- **Phase 1.6 Lõi điều phối** ✅ (C1 token-guard · C2 stuck-triage · C3 size-gate · C4 não per-agent — đều xong).
- **M2 Tay (MCP)** 🔧 ~70%: framework + no-auth (fs/web/git/memory) ✅ + tài chính (CoinGecko/Binance) ✅ + tab "Kết nối" ✅. *CÒN:* cắm creds GitHub/Google/Notion để BẬT + Playwright/browser. ⭐ ưu tiên 1 (biến đổi lớn nhất).
- **M3 Tự học** ✅ skill engine (SKILL.md + loader + seed) + persona chat/routing. *Còn:* self-improve mới ở dry-run (bật `LUCY_SKILL_LEARN` khi tin).
- **M4 Chủ động** 🔧 1 nửa: cron_dream ✅ + watchers (health/disk/RSI) ✅ + brief/tech/VN ✅. *CÒN:* wake-gate + webhook *phản ứng sự kiện* (mail/PR tới → tự xử) + watcher cron */30 + ngưỡng giá. ← năng lực lớn còn thiếu.
- **M5 Token/Cost** 🔧: Dashboard cost/metrics ✅ + token-guard ✅. *Còn:* time-series/sparkline (7d/24h) + ledger gộp + tool-slim/nén.
- **M6 Đa mặt** 🔧: mobile polish ✅ (UI refactor responsive). *Còn:* voice (Whisper) + remote control. (xa)
- **(ngoài M)** Đại tu UI "A+" ✅ XONG đợt này · *Cleanup/restructure folder* (mục 5) = sprint "dọn nhà".

**Thứ tự đề xuất:** M2 (cắm tay) → M4 (chủ động) → M5 (cost time-series) → cleanup → M6 (voice/remote). Memory consolidation apply xen vào khi rảnh.
