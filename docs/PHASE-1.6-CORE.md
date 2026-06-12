# PHASE 1.6 — Lõi điều phối thông minh (M-core)

> **Viết 2026-06-12.** Chèn GIỮA Phase 1.5 (đa-model + Dashboard — đang đóng) và M2 (MCP).
> Lý do thứ tự: *agent có não rồi mới giao thêm tay (MCP)*. Giao tay trước = đốt token nhanh hơn.
> Neo: [NORTH_STAR.md](NORTH_STAR.md) · [AUTOPILOT.md](AUTOPILOT.md) · [SPRINT-01.md](SPRINT-01.md).

## 0. Vấn đề (Bill, 12/6)
Pipeline kiểu "công ty" đã đẹp, nhưng thiếu **trí phán đoán ở giữa**. Sub-agent không có "não" theo nghĩa đen:
- task quá to → không process được, agent húc nhiều lần → **đốt token vô ích**;
- lỗi hạ tầng (rate-limit) bị tính như task-fail → **retry cháy token + Bill không biết**;
- mọi agent share 1 active.md → **không ai giỏi lên ở nghề của mình** → lặp lỗi.

"Bộ mặt đẹp, lõi mỏng." Phase 1.6 = đắp lõi. Lucy (orchestrator) chính là cái não ở giữa.

## 1. Bốn cơ chế lõi

### C1 — Phân loại lỗi + rate-limit → PARK + báo 1 tin (model free)  ⭐ làm trước (cứu token ngay, nhẹ)
- **Vấn đề lõi:** 429/quota bị xử như fail → retry đốt token; Bill mù tin.
- **Cơ chế:** lane-runner/runner bắt 429/quota/timeout → phân loại `rate-limit` (KHÁC `fail`). Card → trạng thái `parked` (không retry ngay, hẹn giờ thử lại / chờ provider khác trong FALLBACKS). Đồng thời bắn **đúng 1 tin Telegram** cho Bill (soạn bằng `deepseek-flash-v4-free` — kênh Telegram đã có sẵn trong `notify.ts`).
- **Data-flow:** `llm-lane.ts` (đã có FALLBACKS → thêm nhãn lỗi) · `error-stats.ts` (category `llm-error` đã có) · `notify.ts` (đã có khung Telegram → thêm kênh) · engine thêm status `parked` + retry-after.
- **Tiết kiệm token:** 0 retry vô ích khi 429; tin báo bằng model $0.
- **Effort:** vừa · **cho:** Chủ nhân (được báo) + Em (không kẹt im lặng).

### C2 — Stuck-detector → Lucy tự triage + split  ⭐ trái tim của idea
- **Vấn đề lõi:** task to / agent húc N lần không ra → loop đốt token, kẹt.
- **Cơ chế:** engine đã đếm `maxStageVisits` + rework. Khi card chạm ngưỡng (vd rework ≥2 hoặc visit ≥ N mà vẫn fail/rework) → KHÔNG đẩy thẳng `waiting_human`. Gọi **triage pass** (opus, Lucy-director) đọc history+reports → quyết: (a) **split** thành 2–3 subtask atomic (đẻ card con `blockedBy`) rồi re-delegate đúng cỡ; (b) nâng persona/model mạnh hơn; (c) thật sự cần Bill → escalate (có lý do).
- **Data-flow:** `engine.ts` hook `onStuck` → module mới `triage.ts` · tạo card con qua `engine.createCard(...blockedBy)` · input = `card.history` + `reports`.
- **Tiết kiệm token:** chặn húc-đầu; chia nhỏ cho model rẻ làm được thay vì opus húc cả khối.
- **Effort:** vừa-lớn · **cho:** Em (tự xử thay Bill) + Chủ nhân (bớt bị hỏi).

### C3 — Task-size gate: decompose-first
- **Vấn đề lõi:** quăng nguyên task bự cho lane model không-não → fail chắc.
- **Cơ chế:** siết stage spec (Kurisu/architect, opus) — task lớn PHẢI ra danh sách subtask atomic trước khi tới executor; executor chỉ nhận mảnh. (Tận dụng pipeline `feature` đã có architect.)
- **Data-flow:** pipeline spec-stage + engine gate (tái dùng ý verify-gate).
- **Tiết kiệm token:** tránh fail-rồi-rework cả khối.
- **Effort:** vừa · **cho:** Chủ nhân (chất lượng) + Em.

### C4 — Não riêng từng agent (học dần như Lucy)
- **Vấn đề lõi:** share 1 active.md → không persona nào giỏi lên ở nghề mình → lặp lỗi.
- **Cơ chế:** mỗi card xong → rút 1–2 bài học theo nghề persona → ghi `Brain/agents/<personaId>.md` (dream theo-persona). Lần sau persona chạy → `readActiveDigest()` prepend thêm **brain riêng** của persona. Galaxy/dream gộp như cũ.
- **Data-flow:** `runner.ts`/`lane-runner.ts` thêm `readAgentBrain(personaId)` · nguồn = `error-stats` (lỗi hay gặp của persona) + reports · sinh qua dream-per-persona.
- **Tiết kiệm token:** agent bớt lặp lỗi cũ → ít rework theo thời gian.
- **Effort:** lớn · **cho:** Em + đội agent của em (đúng tinh thần "môi trường cho nhân viên phát triển").

## 2. Thay / Thêm / Bớt trong kế hoạch hiện có
- **THÊM:** Phase 1.6 này, chèn trước M2.
- **ĐỔI vai Dashboard:** các panel "cho Lucy" (🌙 nhật ký trực đêm · ⏳ runway/burn · 🆘 hàng đợi cần-Bill · Agent Insights) **không còn trang trí** — chúng là **cửa sổ nhìn vào lõi 1.6**. Build SONG SONG: mỗi cơ chế lõi xong → 1 panel soi nó.
- **ĐẨY LÊN (prerequisite):** wire `turn-log` vào runner + `error-stats` sống thật — vì đó là **data nền** cho C2 (stuck) và C4 (per-agent brain). Không còn optional.
- **HOÃN:** M2 (MCP) lùi sau 1.6.
- **GỘP:** C4 nuốt một phần M3 (tự học) — M3 thu lại còn "SKILL.md chuẩn".

## 3. Thứ tự đề xuất
turn-log/error-stats (nền) → **C1** (cứu token, nhẹ) → **C2** (triage/split, lõi) → **C3** (size-gate) → **C4** (per-agent brain, nặng) — mỗi bước kèm 1 panel Dashboard.

## 4. Quyết định cần Bill
1. ~~Kênh báo rate-limit~~ → **CHỐT: Telegram** (notify.ts đã có khung, $0 rủi ro).
2. Có viết Phase 1.6 vào NORTH_STAR + đẻ **SPRINT-02** (card hoá C1–C4) ngay không? *(chờ Bill)*
