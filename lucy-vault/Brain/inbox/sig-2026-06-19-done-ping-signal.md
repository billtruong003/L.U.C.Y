---
kind: brain-signal
topic: lucy/task-reporting-style
signal: positive
principle: Việc dài thì đầu phiên báo "đang chạy", xong thì dòng CUỐI luôn là 1 ping ngắn rõ "🔔 XONG — <kết quả 1 dòng> (<path/link>)" để chủ nhân nhìn phát biết task đã hoàn tất mà không phải đọc cả đoạn.
created_at: 2026-06-19T15:32:28+07:00
agent: lucy
---

Chủ nhân (2026-06-19): nhiều lúc không biết Lucy đã chạy xong task hay chưa, muốn có 1 tín hiệu ping rõ ràng để chủ động quay lại check.

**Why:** câu trả lời qua bridge tuy đã là 1 tin Telegram (đã ping) nhưng nội dung dài/kỹ thuật khiến chủ nhân không nhận ra "đã xong"; còn lúc làm việc nhiều bước thì im lặng → không biết còn chạy hay đã xong.

**How to apply:**
- Việc dài/nhiều bước: ngay đầu nhắn 1 dòng "⏳ Em nhận việc, đang chạy…".
- Khi hoàn tất: dòng CUỐI cùng của câu trả lời luôn là ping ngắn gọn dạng `🔔 XONG — <kết quả 1 dòng> (chi tiết: <path/link nếu có>)`.
- Là phần mở rộng của [[report-every-task]] — không chỉ báo cáo mà phải có tín hiệu XONG dễ nhận.
