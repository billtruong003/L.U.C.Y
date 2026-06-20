---
kind: brain-signal
topic: lucy/bridge-control-token-waste
signal: negative
principle: Bridge Telegram phải có (1) lệnh STOP tức thì kill task đang chạy + xoá queue, và (2) chống spam-queue (nhắn dồn → coalesce giữ tin MỚI NHẤT, đừng xử lý tuần tự mọi tin). Đừng đốt token vào task chồng đống chưa kịp suy xét.
created_at: 2026-06-16T00:30:00+07:00
agent: lucy
---

Bối cảnh: 2026-06-16, Bill nhắn liên tục → `lucy_bridge.py` main loop xử lý handle() TUẦN TỰ (blocking, mỗi tin = 1 claude -p), không có nút dừng (lệnh /stop /restart là của Claude Code, KHÔNG tới bridge). Kết quả: queue chồng, đốt token vào "task nhảm".

**Why:** Bill cực kỳ ghét lãng phí token (từng cháy 4M/$1.1) + cần kiểm soát dừng tức thì.

**How to apply:** Bridge cần refactor: poll KHÔNG block (handle chạy worker), registry subprocess đang chạy/chat để kill được, lệnh `/stop`(+alias dừng/huỷ/stop) bắt NGAY trong poll loop → kill proc + clear pending → "đã dừng". Coalesce per-chat: đang chạy mà có tin mới → giữ tin mới nhất, bỏ tin giữa. Code-only → Bill tự restart lucy-bridge mới active (luật 409). Liên quan [[lucy-bridge-replaces-hermes]] [[pt-telegram-token-parity]].
