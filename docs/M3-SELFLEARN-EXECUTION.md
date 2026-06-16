---
title: "M3 — TỰ HỌC (skill engine + self-improve) · EXECUTION PLAN"
date: 2026-06-14
author: Lucy
status: execution-plan
parent: NORTH_STAR.md
---

# M3 — Lucy tự giỏi lên: skill engine + self-improve

> North Star #4: "học cách m làm, tự viết skill". Nối với agent-brain (não nghề per-persona đã có) + dream/consolidation.
> **An toàn:** skill tự sinh = ĐỀ XUẤT (dry-run/inbox), chủ nhân/dream duyệt mới thành "active". KHÔNG tự ghi skill chạy production mà chưa duyệt.

## Task breakdown

> ✅ T6 (2026-06-15): M3.1+M3.2+M3.3+M3.4+M3.6 LIVE. M3.2-Jina (embedding match trong loader) DEFER — `buildSystemPrompt` sync trong hot-path runner; async-hoá để gọi Jina rủi ro live + phá prompt-cache. Keyword progressive-disclosure đã đủ + LIVE.

### M3.1 — Chuẩn SKILL.md + store ⭐ (làm trước) ✅ (2026-06-15)
- Định dạng `SKILL.md` (chuẩn agentskills.io): frontmatter `name · description · triggers[] · tools[] · when_to_use` + body (các bước/checklist). 1 file = 1 skill.
- Thư mục `agent-machine/skills/` (hoặc `lucy-vault/Brain/skills/`) + INDEX (id→desc→triggers) để match nhanh.
- Loader đọc + validate frontmatter; smoke parse vài skill mẫu.

### M3.2 — Skill-loader (progressive disclosure) ✅ (2026-06-15, Jina DEFER)
- Khi agent nhận card/turn → match trigger (keyword/embedding qua Jina sẵn có) với INDEX → nạp ĐÚNG 1-2 SKILL.md liên quan vào prompt (không nhồi hết → giữ token rẻ).
- Tận dụng recall/embed đã có để match theo nghĩa.
- Flag `LUCY_SKILLS` bật/tắt. Smoke: card "deploy X" → load skill deploy.

### M3.3 — Self-improve stage (sinh/refine skill) — DRY-RUN gated ✅ (2026-06-15)
- Sau khi 1 card DONE + review tốt (hoặc dream đêm): agent (model rẻ) nhìn lại "việc vừa làm có thành pattern tái dùng không?" → ĐỀ XUẤT skill mới / cập nhật skill cũ → ghi vào `Brain/inbox/` (như brain-signal) hoặc `skills/_proposed/`.
- Chủ nhân/dream duyệt → move sang active. KHÔNG auto-active.
- Gated `LUCY_SKILL_LEARN` (mặc định chỉ đề xuất, không ghi đè).

### M3.4 — Seed skill từ việc đã làm ✅ (2026-06-15)
- Sinh sẵn vài SKILL.md từ pattern THẬT trong repo/vault (vd "rehost Lucy", "thêm endpoint coordinator", "auto-build 1 phase", "deploy không đụng bridge") để có thư viện khởi đầu hữu dụng ngay.

### M3.5 — PERSONA: chat trực tiếp + auto-routing ✅ (2026-06-15) ⭐ (chủ nhân yêu cầu)
> ĐÃ LÀM: `persona-chat.ts` (personaChat đa lượt mang systemPrompt+agent-brain+laneModel, nhớ history; personaRoute lai tag+embedding Jina) · coordinator `/persona-chat` + `/persona-route` (flag LUCY_PERSONA_CHAT=1 LIVE) · hub proxy `/api/persona/{chat,route}` · tab Experts: roster hero card + thanh auto-route + PersonaChatPanel ("Nhắn tin"). Verify live OK. CHƯA: Telegram @persona (cần restart lucy-bridge → chờ chủ nhân).
> Nối K1/K2 (consult_expert one-shot đã có) + K4 (registry) + U5 (roster). Biến roster "trang trí" thành 12 chuyên gia *nói chuyện được + tự gọi đúng người*.
- **Chat trực tiếp 1 persona:** endpoint coordinator `/persona-chat {personaId, message, history}` → chạy phiên lane/claude mang ĐẦY ĐỦ danh tính persona (systemPrompt + agent-brain `agents/<id>.md` đã học + laneModel riêng + tool theo scope). Multi-turn (khác consult_expert one-shot), history riêng per persona.
- **Auto-routing:** endpoint `/persona-route {question}` → chọn persona hợp nhất = match tags + embedding (Jina sẵn) giữa câu hỏi ↔ mô tả persona → trả `{personaId, confidence, why}`. Mode: auto (tự route) hoặc suggest (gợi ý để chủ nhân chọn).
- **Hub UI:** card persona (U5 roster) thêm nút **"Nhắn tin"** → mở panel chat với persona đó (avatar + danh tính + history riêng). Thêm toggle **"Lucy tự chọn chuyên gia"** (auto-route) ở khung chat chính.
- **Telegram:** gọi persona qua cú pháp `@finance <câu hỏi>` hoặc `/ask <persona> <câu hỏi>` → route vào /persona-chat. Không gõ tên → Lucy auto-route nếu bật.
- Flag `LUCY_PERSONA_CHAT`. Smoke: /persona-chat trả lời đúng giọng persona + nhớ history; /persona-route câu tài chính → 'finance'.

### M3.6 — Hiển thị (tab "Kỹ năng") — OPTIONAL ✅ (2026-06-15)
- Tab Hub liệt kê skill: active vs proposed, trigger, lần dùng. Duyệt proposed → active. (Để sau nếu hết giờ.)

## Done đêm = M3.1+M3.2 chạy thật + M3.3 (chỉ đề xuất, dry-run) + M3.4 seed skill + M3.5 persona chat+routing. Mỗi task tsc/smoke gate, flag, không bridge, không auto-active skill.
