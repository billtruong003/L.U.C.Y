---
kind: brain-signal
id: sig-2026-06-12-lucy-c1-rate-limit-park-bao-tele-mqb7raf2
created_at: 2026-06-12T17:41:49.310Z
topic: Lucy/c1-rate-limit-park-bao-telegram
signal: negative
agent: engine
principle: "Bug CRITICAL confirmed: mixed 429+500 tại llm-lane.ts:160/223 → nonRlCount===0 quá strict → throw Error thay vì RateLimitError → card failed thay vì parked; test tái hiện đã viết và chạy xanh cho đúng behavior, đỏ cho bug"
scope: tester
evidenced_by: [card_mqb4cx8g1]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: Bug CRITICAL confirmed: mixed 429+500 tại llm-lane.ts:160/223 → nonRlCount===0 quá strict → throw Error thay vì RateLimitError → card failed thay vì parked; test tái hiện đã viết và chạy xanh cho đúng behavior, đỏ cho bug
