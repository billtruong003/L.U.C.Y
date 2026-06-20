---
kind: brain-signal
topic: lucy/decision-without-form
signal: negative
principle: Đừng dùng form hỏi nhiều lựa chọn (AskUserQuestion); tự chốt mặc định hợp lý rồi hỏi lại gọn bằng lời nếu cần
created_at: 2026-06-17T16:20:00+07
agent: lucy
---

Trong 1 phiên (2026-06-17, làm Auto-Task Engine), chủ nhân từ chối form AskUserQuestion **2 lần liên tiếp**.
Chủ nhân thích kiểu: Lucy tự quyết hướng mặc định hợp lý, đề xuất thẳng bằng văn bản gọn, ai thấy lệch thì chỉnh bằng lời.
**Why:** form hỏi làm chậm nhịp, chủ nhân thiên về "làm luôn, sai thì sửa".
**How to apply:** khi cần chốt scope → nêu lựa chọn mặc định + lý do trong 2-3 dòng, hỏi lại 1 câu mở bằng text, KHÔNG bung form. Liên quan [[auto-task-engine]].
