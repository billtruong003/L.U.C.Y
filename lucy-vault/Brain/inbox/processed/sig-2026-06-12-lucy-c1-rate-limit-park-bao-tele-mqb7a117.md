---
kind: brain-signal
id: sig-2026-06-12-lucy-c1-rate-limit-park-bao-tele-mqb7a117
created_at: 2026-06-12T17:28:23.995Z
topic: Lucy/c1-rate-limit-park-bao-telegram
signal: negative
agent: engine
principle: "2 bug MEDIUM confirmed bằng test chạy thật: (1) mixed 429+500 → llm-lane.ts:250 điều kiện !hasOtherError quá strict → card failed thay vì parked; (2) notify.ts:5 sent Set module-level không reset → re-queue lần 2 câm lặng"
scope: tester
evidenced_by: [card_mqb4cx8g1]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: 2 bug MEDIUM confirmed bằng test chạy thật: (1) mixed 429+500 → llm-lane.ts:250 điều kiện !hasOtherError quá strict → card failed thay vì parked; (2) notify.ts:5 sent Set module-level không reset → re-queue lần 2 câm lặng
