---
kind: brain-signal
id: sig-2026-06-12-lucy-c0-nen-wire-turn-log-error--mqb55z9i
created_at: 2026-06-12T16:29:15.846Z
topic: Lucy/c0-nen-wire-turn-log-error-stats-song
signal: negative
agent: engine
principle: "runner.ts (ClaudeRunner) chưa wire turnLogger — spec yêu cầu runner.ts + lane-runner.ts cả 2; smoke-turn-log.ts:18 và smoke-turn-log-wire.ts:22 readJSONL dùng .map(JSON.parse) không có per-line catch — fix thành flatMap+try/catch độc lập từng dòng"
scope: reviewer-spec
evidenced_by: [card_mqb4cx7e0]
---
## Raw
Giyu · Spec-Review REWORK @ Spec-compliance (đúng yêu cầu?): runner.ts (ClaudeRunner) chưa wire turnLogger — spec yêu cầu runner.ts + lane-runner.ts cả 2; smoke-turn-log.ts:18 và smoke-turn-log-wire.ts:22 readJSONL dùng .map(JSON.parse) không có per-line catch — fix thành flatMap+try/catch độc lập từng dòng
