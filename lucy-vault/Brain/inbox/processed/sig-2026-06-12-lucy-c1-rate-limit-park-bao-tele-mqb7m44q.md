---
kind: brain-signal
id: sig-2026-06-12-lucy-c1-rate-limit-park-bao-tele-mqb7m44q
created_at: 2026-06-12T17:37:47.882Z
topic: Lucy/c1-rate-limit-park-bao-telegram
signal: negative
agent: engine
principle: "Bug 1 CONFIRMED: mixed 429+500 → callLLMRaw nonRlCount===0 quá strict → throw generic Error → card failed thay vì parked (llm-lane.ts:160/223). Bug 2 không tồn tại trong code hiện tại — test regression guard đã viết và pass."
scope: tester
evidenced_by: [card_mqb4cx8g1]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: Bug 1 CONFIRMED: mixed 429+500 → callLLMRaw nonRlCount===0 quá strict → throw generic Error → card failed thay vì parked (llm-lane.ts:160/223). Bug 2 không tồn tại trong code hiện tại — test regression guard đã viết và pass.
