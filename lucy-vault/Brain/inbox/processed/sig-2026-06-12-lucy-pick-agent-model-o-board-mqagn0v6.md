---
kind: brain-signal
id: sig-2026-06-12-lucy-pick-agent-model-o-board-mqagn0v6
created_at: 2026-06-12T05:02:40.674Z
topic: Lucy/pick-agent-model-o-board
signal: negative
agent: engine
principle: "4 bug CRITICAL/MEDIUM trong API/UI chain: (1) personaId không bao giờ truyền từ Board→api→coordinator→engine (Board.tsx:29,63 + api.ts:96 + coordinator.ts:57); (2) laneModel bị filter ra ở Board:63 + api.ts:96 type + coordinator.ts:57; (3) AmPersona thiếu laneModel field api.ts:61; (4) no-op silent khi persona thiếu laneModel engine.ts:352"
scope: tester
evidenced_by: [card_mqa8xuka2]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: 4 bug CRITICAL/MEDIUM trong API/UI chain: (1) personaId không bao giờ truyền từ Board→api→coordinator→engine (Board.tsx:29,63 + api.ts:96 + coordinator.ts:57); (2) laneModel bị filter ra ở Board:63 + api.ts:96 type + coordinator.ts:57; (3) AmPersona thiếu laneModel field api.ts:61; (4) no-op silent khi persona thiếu laneModel engine.ts:352
