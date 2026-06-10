# LUCY — North Star & Plan (ĐỌC CÁI NÀY)

> **Single source of truth. Viết 2026-06-10.** Gom mọi thứ về 1 chỗ cho đỡ loãng.
> Thay `SPRINT_PLAN.md` (đã xoá) + phần business của [ROADMAP_TO_PEAK.md](ROADMAP_TO_PEAK.md) (gác lại).
> Chi tiết research nằm ở doc reference: [LUCY_ULTIMATE_INFRA](LUCY_ULTIMATE_INFRA.md) · [STEAL_FROM_HERMES](STEAL_FROM_HERMES.md) · [COST_MODEL](COST_MODEL.md) · [MODEL_COMPARISON](MODEL_COMPARISON.md).

---

## 1. VIỄN CẢNH — Lucy làm được gì

**North star:** *Lucy = trợ lý cá nhân BIẾT RÕ m + mọi dự án, tự làm việc bằng nhiều agent, chạm được cả
tech-life (code/mail/lịch/file/web), tự giỏi lên, chạy cả khi m ngủ — m lái từ điện thoại.*

**7 năng lực Lucy LÀM được:**
1. **Nhớ m & mọi dự án** — khỏi giải thích lại bao giờ.
2. **Giao 1 việc → nhiều agent tự chia nhau làm** song song, chỉ hỏi khi cần quyết.
3. **Chạm cả tech-life**: code · mail · lịch · file · web · notes.
4. **Tự giỏi lên** — học cách m làm, tự viết skill.
5. **Làm khi m ngủ** — job nền, phản ứng sự kiện (PR/mail), gộp memory đêm.
6. **Rẻ** — việc nhẹ chạy model free, não Claude, token tối ưu.
7. **Lái từ túi quần** — Telegram/voice, cả agent lẫn máy tính từ xa.

*Một ngày:* sáng Lucy tóm tắt (PR chờ duyệt + lịch + mail) → m giao "fix bug login radiant-bot + test" →
Lucy tự lập pipeline, nhiều agent làm, báo "xong, diff đây, push?" (không hỏi lại dự án là gì) → tối Lucy
gộp cái học vào não + tự viết skill "deploy radiant-bot".

---

## 2. NGUYÊN TẮC (để KHÔNG dàn trải)
- **1 line, làm xong từng cái** — không mở nhiều mặt trận cùng lúc.
- **Memory-first** — trí nhớ là MÓNG; 6 năng lực kia chỉ cộng dồn được khi Lucy NHỚ.
- **Mỗi milestone = 1 năng lực agent + 1 màn UI thấy được + ship được** (không build chìm 6 tuần rồi mới thấy).
- **UI: flow rõ — đẹp — xịn**, đủ control cho power-user; KHÔNG dumbed-down.

---

## 3. LỘ TRÌNH đầu → cuối (6 milestone — mỗi cái có UI)

| # | Lucy thêm năng lực | Build (gọn) | Màn UI (flow) | Done khi |
|---|---|---|---|---|
| **M1 Trí nhớ** ⭐ móng | `lucy-vault/` (md, git) + `claude -p --add-dir` + ghi-lại-sau-mỗi-việc + FTS5 recall | **"Bộ não"** — duyệt vault (m là ai · dự án · điều đã học) + ô search recall | Lucy đọc vault, không hỏi lại; `/recall` ra phiên cũ; m sửa được trí nhớ |
| **M2 Tay (MCP)** | mount MCP per-card: GitHub·Gmail·Calendar·Drive·Web(Playwright)·Notion | **"Kết nối"** — bật/tắt từng nguồn, thấy quyền rõ ràng | 1 card đọc được GitHub/mail/lịch/web |
| **M3 Tự học** | `SKILL.md` chuẩn agentskills.io + stage "self-improve" tự sinh/refine | **"Kỹ năng"** — skill đã học, dùng mấy lần, duyệt skill mới | Lucy tự mint 1 skill từ việc lặp |
| **M4 Chủ động** | cron tick + wake-gate + webhook + nightly "dream" | **"Lịch/Job"** — job định kỳ + trigger, kết quả đẩy Telegram | Job nền chạy, thức theo sự kiện, gộp memory đêm |
| **M5 Token/Cost** | cache-parity (từ M1) + tool-slim + nén qua OmniRoute + ledger gộp | **"Chi phí"** — token/cost per agent·ngày, tiết kiệm bao nhiêu | Token giảm đo được; context cha sạch |
| **M6 Đa mặt** | tách headless server; Telegram + voice(Whisper) + web adapter | **polish** — responsive, mobile, đẹp | Thêm 1 kênh không đụng não |

**Trung tâm UI đã có:** Board (Kanban card chạy qua stage, agent "nói" trong thread sống) — đây là điểm
nhấn. M1–M6 thêm tab xung quanh nó. ~1 tuần/milestone → **~6–7 tuần ra "Lucy life-cockpit core".**

> **Gác (mở lại sau M1–M5):** business/portal/content/tribulation. **Track song song (xen sau M2):** remote-control desktop.

---

## 4. UI/UX DIRECTION — xịn, flow rõ, đẹp

**Triết lý:** Lucy là **"phòng điều khiển đội agent của m"** — không phải chatbox. Khác biệt cao cấp =
**m XEM được agent đang làm gì real-time và lái chúng**, như Discord cho đội AI riêng.

- **Thẩm mỹ:** giữ **dark theme token-based đã có** (nền `#05070e`, accent cyan, viền calm) — premium, dễ nhìn lâu. KHÔNG màu mè, KHÔNG "AI slop".
- **Bố cục:** 1 cockpit, sidebar = **các năng lực** (Bộ não · Board · Kết nối · Kỹ năng · Lịch · Chi phí · Chat). Mỗi tab **đúng 1 flow rõ ràng**, không nhồi.
- **Flow nguyên tắc (signature UX):**
  1. **Agent "nói ra" mọi việc** — mỗi card có thread sống, agent post tiến độ/handoff/báo cáo; m đọc được "ai đang làm gì, tới đâu".
  2. **Duyệt đúng chỗ (HITL inline)** — khi cần quyết (gate/cost/loop), nút Duyệt/Trả-lại/Trả-lời ngay trong thread, không lạc.
  3. **Hiện đủ nhưng sạch** — cost · agent · stage · diff đều thấy, nhưng bố cục thoáng, ưu tiên cái đang cần.
- **Không dumbed-down:** đủ chiều sâu cho power-user (chỉnh pipeline, model, limit lúc chạy) — gói trong UI đẹp, không phải ẩn đi.

---

## 5. BƯỚC ĐẦU — execute ngay sau session
**M1, đúng 3 bước (1 buổi):**
1. Dựng `lucy-vault/` + seed `Context/USER.md` (Lucy biết m là ai) + `Projects/` cho dự án đang chạy.
2. Trỏ `runner.ts` + bridge: `claude -p --add-dir lucy-vault` (Lucy đọc được).
3. Hook `engine.submit`: sau mỗi việc, ghi cái học vào `Brain/inbox/` (Lucy nhớ dần).

Xong 3 bước → Lucy đã "biết m". Rồi mới thêm recall + "Bộ não" tab, rồi M2.
