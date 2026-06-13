---
name: report-every-task
description: "Bill wants Lucy to report after every task run (esp. via Telegram), never go silent"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: ac530087-6e08-4dde-9c4b-9ff57f8ee11c
---

Bill (2026-06-13): "Mỗi khi chạy task đều phải báo cáo nhé." Sau mỗi đầu việc → chủ động báo cáo (Telegram khi session ngoài bridge có env TELEGRAM_BOT_TOKEN + LUCY_ALLOWED_USER_ID), tóm tắt ngắn + path/commit.

**Why:** chủ nhân muốn nắm tiến độ realtime, không thích Lucy làm lặng lẽ rồi mới hiện kết quả.

**How to apply:** xong task → 1 tin báo gọn (làm gì + verify + path). Việc dài → báo mốc, đừng đợi xong hết. Gửi Telegram qua `notifyTelegram` (notify.ts) hoặc API trực tiếp, plain text để né lỗi MarkdownV2.
