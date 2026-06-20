---
kind: brain-signal
id: sig-2026-06-12-lucy-autopilot-minh-bach-token-g-mqadffoa
created_at: 2026-06-12T03:32:47.770Z
topic: Lucy/autopilot-minh-bach-token-guard
signal: negative
agent: engine
principle: "Phát hiện 2 bug confirmed: [CRITICAL] engine.claim() (engine.ts:346-380) không check tokenGuard.soft → executor không downgrade khi soft limit — fix: thêm check soft trong claim(), ép persona xuống cheapestAvailableLaneKey(), dẹp worker tự fetch /token-guard; [MEDIUM] notify.ts:36,42 safeNum() dùng toLocaleString() không qua esc() → số float có dấu chấm . phá MarkdownV2 → Telegram fail silent — fix: esc(safeNum(x)) thay vì safeNum(x). BUG3 (notification flag reset) không tái hiện được. Smoke test repro tại src/smoke-token-guard-bugs.ts."
scope: tester
evidenced_by: [card_mqa8xuni5]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: Phát hiện 2 bug confirmed: [CRITICAL] engine.claim() (engine.ts:346-380) không check tokenGuard.soft → executor không downgrade khi soft limit — fix: thêm check soft trong claim(), ép persona xuống cheapestAvailableLaneKey(), dẹp worker tự fetch /token-guard; [MEDIUM] notify.ts:36,42 safeNum() dùng toLocaleString() không qua esc() → số float có dấu chấm . phá MarkdownV2 → Telegram fail silent — fix: esc(safeNum(x)) thay vì safeNum(x). BUG3 (notification flag reset) không tái hiện được. Smoke test repro tại src/smoke-token-guard-bugs.ts.
