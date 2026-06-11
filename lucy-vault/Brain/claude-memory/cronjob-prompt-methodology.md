---
name: cronjob-prompt-methodology
description: Công thức prompt CHUẨN cho mọi cronjob tin tức/báo cáo + quy tắc phải hỏi chủ nhân trước khi lên/nâng cronjob
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 9ca12864-ab83-4b38-a724-217f3ee9d066
---

Chủ nhân DUYỆT công thức prompt này là "đúng hướng" (10/06/2026) cho mọi cronjob sinh báo cáo/tin tức. Áp cho cả `cron_tech.sh` (tech digest) lẫn `cron_brief.sh` (thị trường) — đã rewrite cả hai theo nó.

**Công thức prompt cronjob ĐÚNG (luôn áp):**
1. Vai trò + MỆNH LỆNH LỌC NHIỄU ("lọc nhiễu mạnh tay, chỉ thứ thực sự quan trọng, bỏ PR/shill/câu view").
2. CỬA SỔ THỜI GIAN rõ ràng (vd 24h qua), trừ mục radar sự kiện.
3. PHÂN TẦNG ưu tiên: Tầng 1 = luôn báo / Tầng 2 = chỉ khi BOM TẤN / Tầng 3 = chỉ khi thực sự có.
4. LIỆT KÊ NGUỒN CỤ THỂ để model quét lần lượt (ĐỪNG để model tự đoán nguồn — đây là điểm chủ nhân nhấn mạnh: nhúng sẵn danh sách nguồn vào prompt cronjob để nó chạy đúng).
5. Mỗi mục KÈM lý do "tại sao đáng đọc/đáng chú ý" + link, không chỉ tiêu đề/số.
6. CHO PHÉP "hôm nay không có gì đáng kể" → chống nhồi tin lấp chỗ.
7. FORMAT CỐ ĐỊNH: 🔥 TOP 3 đầu + emoji header (KHÔNG dùng #, Telegram không render) + 🗓️ Radar sự kiện + góc nhìn Lucy cuối.
8. Tách output: FULL markdown ra file (HTML web có thể dùng bảng) — bản stdout GỌN cho Telegram (<=3000 ký tự, bullet '•', không bảng).
9. CHỐNG BỊA: "không chắc/không lấy được thì ghi 'chưa tìm được'".
10. ⚠️ TIN CẬY HEADLESS: ĐỪNG nhờ model "tự ghi file $MD_OUT" trong cron — model lúc ghi lúc không → cron đăng lại nội dung CŨ (đã dính bug 10/06: digest 8h sáng repost bản 00:26). ĐÚNG: bắt model in TOÀN BỘ ra stdout (result), script tự ghi file + tự rút gọn bản Telegram (lọc bỏ dòng bảng `|...|`). Đã áp cho cả cron_tech.sh lẫn cron_brief.sh.

**⚠️ QUY TẮC BẮT BUỘC khi chủ nhân kêu "lên cronjob" / "thêm cronjob" / "nâng cronjob" sau này:**
- PHẢI HỎI chủ nhân trước (đừng tự quyết phạm vi/nguồn/lịch).
- PHẢI LIỆT KÊ rõ "hướng đi cronjob" theo 9 điểm trên cho chủ nhân xem/duyệt.
- PHẢI nhúng sẵn DANH SÁCH NGUỒN cụ thể vào prompt cronjob để sau này nó chạy đúng.

**Why:** Cronjob chạy headless không có người sửa real-time → prompt phải tự đủ "kỷ luật" (lọc + nguồn + format). Cronjob cũ yếu vì thiếu lọc/thiếu nguồn/không phân tầng → nhồi nhiễu.

**How to apply:** Copy khung từ `cron_tech.sh` hoặc `cron_brief.sh` làm template. Xem [[daily-brief-setup]] (chi tiết các cronjob hiện có).
