---
kind: brain-signal
id: sig-2026-06-12-lucy-c0-nen-wire-turn-log-error--mqb5af40
created_at: 2026-06-12T16:32:43.008Z
topic: Lucy/c0-nen-wire-turn-log-error-stats-song
signal: negative
agent: engine
principle: "2 bug xác nhận: [CRITICAL] ClaudeRunner runner.ts chưa wire TurnLogger (không có constructor param/log call) — thêm TurnLogger inject + log sau parseClaude; [MEDIUM] readJSONL ở smoke-turn-log.ts:18 và smoke-turn-log-wire.ts:22 dùng .map(JSON.parse) không per-line catch → 1 dòng lỗi mất toàn bộ array — fix bằng flatMap+try/catch độc lập từng dòng"
scope: tester
evidenced_by: [card_mqb4cx7e0]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: 2 bug xác nhận: [CRITICAL] ClaudeRunner runner.ts chưa wire TurnLogger (không có constructor param/log call) — thêm TurnLogger inject + log sau parseClaude; [MEDIUM] readJSONL ở smoke-turn-log.ts:18 và smoke-turn-log-wire.ts:22 dùng .map(JSON.parse) không per-line catch → 1 dòng lỗi mất toàn bộ array — fix bằng flatMap+try/catch độc lập từng dòng
