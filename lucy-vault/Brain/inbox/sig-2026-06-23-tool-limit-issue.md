---
kind: brain-signal
topic: lucy/tool-limit
signal: negative
principle: "Chủ nhân muốn extend hoặc nâng giới hạn lượt tool call cho Lucy, đặc biệt với model free, vì hay bị block khi làm nhiều bước liên tiếp."
created_at: "2026-06-23T12:30:00+07:00"
agent: lucy
---

**Context:**
- Lucy hay bị lỗi "đã dùng tối đa lượt tool" khi thực hiện nhiều bước (đọc file, ghi file, bash, web) trong 1 câu trả lời.
- Cụ thể: lúc restore cronjob + tạo VN brief + update dashboard, phải chia làm 3 bước vì limit ~15-20 tool calls/lần.
- Chủ nhân ghi nhận vấn đề và nói "có thể t sẽ cần phải extend lượt dùng tool cho các model free".

**Observation:**
- Limit tool call hiện tại là rào cản khi làm task nhiều bước.
- Cần tìm cách nâng limit hoặc optimize cách gọi tool (dùng bash gộp thay vì read_file nhiều lần).
- Chủ nhân sẵn sàng extend nếu có option.
