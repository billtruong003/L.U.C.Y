---
kind: brain-signal
id: sig-2026-06-12-lucy-autopilot-minh-bach-token-g-mqac27t1
created_at: 2026-06-12T02:54:31.429Z
topic: Lucy/autopilot-minh-bach-token-guard
signal: negative
agent: engine
principle: "3 bug: [CRITICAL] worker-main.ts:21 không đọc /token-guard → executor không thực sự downgrade khi soft; [MEDIUM] notify.ts:31,36 toLocaleString() không escape MarkdownV2 → Telegram notification fail silently; [MEDIUM] autopilot-main.ts:24-25 softNotifiedToday không reset theo ngày UTC → mất cảnh báo từ ngày 2 trở đi"
scope: tester
evidenced_by: [card_mqa8xuni5]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: 3 bug: [CRITICAL] worker-main.ts:21 không đọc /token-guard → executor không thực sự downgrade khi soft; [MEDIUM] notify.ts:31,36 toLocaleString() không escape MarkdownV2 → Telegram notification fail silently; [MEDIUM] autopilot-main.ts:24-25 softNotifiedToday không reset theo ngày UTC → mất cảnh báo từ ngày 2 trở đi
