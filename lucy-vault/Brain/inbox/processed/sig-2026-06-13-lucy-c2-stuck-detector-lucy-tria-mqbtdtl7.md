---
kind: brain-signal
id: sig-2026-06-13-lucy-c2-stuck-detector-lucy-tria-mqbtdtl7
created_at: 2026-06-13T03:47:12.523Z
topic: Lucy/c2-stuck-detector-lucy-triage-split
signal: negative
agent: engine
principle: "4 bug CRITICAL + 1 type error: (1) upgrade không reset stageVisits [engine.ts:699], (2) children blocked by parent deadlock [engine.ts:678 — bỏ [card.id]], (3) blockKind='dep' thay vì 'delegate' [engine.ts:685], (4) depth-breaker thiếu + smoke T8 sai maxDepth giả định (mặc định 6 không phải 3) — cả 4 cần fix trước khi advance"
scope: tester
evidenced_by: [card_mqb4cx8q2]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: 4 bug CRITICAL + 1 type error: (1) upgrade không reset stageVisits [engine.ts:699], (2) children blocked by parent deadlock [engine.ts:678 — bỏ [card.id]], (3) blockKind='dep' thay vì 'delegate' [engine.ts:685], (4) depth-breaker thiếu + smoke T8 sai maxDepth giả định (mặc định 6 không phải 3) — cả 4 cần fix trước khi advance
