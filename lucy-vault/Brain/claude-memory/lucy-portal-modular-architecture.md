---
name: lucy-portal-modular-architecture
description: "Cổng dự án Lucy = registry-driven 3 lớp (KHÔNG hardcode HTML tĩnh), đặt ở /lucy/; automation tự đẩy project vào"
metadata: 
  node_type: memory
  type: project
  originSessionId: 27ed6e4a-400b-439e-a63d-d4d902b6751a
---

Cổng gom hết link dự án Lucy — chốt 2026-06-19, độc lập hub chính (lucy-hub :8800 đã quá tải, để yên, redesign sau). Đặt ở route `/lucy/` (Bill chọn, KHÔNG nhét vào `/reports/` — `/reports/` chỉ dành daily report).

**Kiến trúc bắt buộc: data-driven 3 lớp, KHÔNG trang tĩnh hardcode** (vì Bill sẽ lên cron auto đẻ mỗi ngày 1 web-app/template + spam automation liên tục → cổng phải tự hấp thụ project mới, 0 sửa tay):
- **Lớp 1 — Registry (nguồn sự thật):** 1 manifest JSON / 1 project: `{slug,title,type:web|report|idea|template,url,status,thumb,tags,summary,createdAt}`. 1 file/project (KHÔNG gom 1 file lớn → spam song song không đụng nhau). Đề xuất chỗ: `/var/www/lucy/registry/*.json`.
- **Lớp 2 — Builder (render):** script quét toàn bộ manifest → gom theo `type` → sinh cổng. Template tách rời data. Thêm loại khu mới = thêm 1 `type`, không sửa lõi.
- **Lớp 3 — Ingest (cửa automation):** CLI `portal register <manifest>` / `portal remove <slug>`. Cron đẻ project xong gọi đúng 1 lệnh → rebuild. Đề xuất viết Python để gắn thẳng vào harness auto-build/auto-build-free sẵn có.

Serving: **build-on-register → serve tĩnh** (nhẹ VPS ~0 RAM nhưng vẫn modular). Live/dead realtime = thêm endpoint nhỏ sau, không bắt buộc.

4 khu cổng: 🌐 `/preview/` (web app trỏ qua) · 📊 `/lucy-report-info/` (báo cáo phân tích, tách daily) · 💰 money-ideas (render [[money-ideas]] từ vault) · 📅 link sang `/reports/` + hub chính.

Mockup giao diện đã duyệt sơ: `/var/www/lucy-reports/lucy-portal-mockup.html` (gold/cyan cockpit). Liên quan: [[lucy-productize-proposal]], audit dọn hệ thống Projects/lucy-cleanup-audit-2026-06-19.md.

**Why:** Hardcode HTML chết ngay khi automation đẻ project thứ 2; registry-driven cho thêm/xóa/sửa cực rẻ (drop/xóa 1 manifest).
**How to apply:** Khi build cổng hoặc bất kỳ trang gom-nhiều-thứ nào cho Bill → luôn tách data (registry) khỏi render (template) khỏi ingest (CLI cho automation), đừng nhúng list cứng vào HTML.
