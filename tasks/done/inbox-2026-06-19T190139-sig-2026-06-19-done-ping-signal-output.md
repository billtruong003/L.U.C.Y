# Task Output: inbox-2026-06-19T190139-sig-2026-06-19-done-ping-signal

**Source:** `/root/lucy/lucy-vault/Brain/inbox/sig-2026-06-19-done-ping-signal.md`
**Processed:** 2026-06-19
**Lane:** Lucy Lane Executor

---

## Tóm tắt nội dung

Note ghi lại signal tích cực từ chủ nhân (2026-06-19) về việc cải thiện cách Lucy báo cáo trạng thái task. Chủ nhân muốn nhận tín hiệu ping rõ ràng khi task hoàn tất, thay vì phải đọc cả đoạn nội dung dài để biết đã xong chưa. Nguyên tắc đề xuất: (1) đầu phiên gửi "⏳ Em nhận việc, đang chạy…", (2) dòng cuối cùng luôn là ping ngắn gọn `🔔 XONG — <kết quả 1 dòng> (path/link)`. Đây là phần mở rộng của nguyên tắc `[[report-every-task]]`.

## Đề xuất hành động

### 1. Áp dụng ngay pattern "⏳ Start Ping + 🔔 Done Ping" cho mọi task dài
Lucy nên tuân thủ nghiêm ngặt 2 bước ping này trong mọi task có nhiều bước hoặc mất thời gian:
- **Bước 1 — Start ping:** Ngay khi nhận task dài, trả lời dòng đầu tiên là `⏳ Em nhận việc, đang chạy…` (có thể thêm brief mô tả task nếu cần).
- **Bước 2 — Done ping:** Luôn kết thúc response cuối cùng bằng `🔔 XONG — <mô tả 1 dòng> (chi tiết: <path/link>)`.

**Lợi ích:** Chủ nhân không cần đọc kỹ nội dung để biết trạng thái — nhìn ping là rõ.

### 2. Ghi chính thức vào Operating Principles / Rule set
Nên thêm rule `done-ping-signal` vào bộ quy tắc vận hành của Lucy (Brain vault), liên kết với `[[report-every-task]]` để đảm bảo tính nhất quán. Ví dụ:
```yaml
- id: done-ping-signal
  extends: report-every-task
  rule: "Mọi task dài/nhiều bước phải có start-ping và done-ping ở response cuối cùng."
  format_start: "⏳ Em nhận việc, đang chạy…"
  format_done: "🔔 XONG — <kết quả 1 dòng> (chi tiết: <path/link>)"
```
Điều này giúp rule được enforce tự động qua system prompt hoặc Brain rule engine.

### 3. Audit lại các task gần đây để kiểm tra tính nhất quán
Quét lại các task report trong `/root/lucy/tasks/done/` gần đây để xem Lucy đã áp dụng đúng pattern này chưa. Nếu task nào thiếu done-ping thì đánh dấu làm lại/ghi chú lessons learned. Có thể dùng script đơn giản grep `🔔 XONG` trong thư mục output để check coverage.

---

*Nguồn: File inbox gốc — brain-signal từ agent "lucy", created 2026-06-19T15:32:28+07:00.*
