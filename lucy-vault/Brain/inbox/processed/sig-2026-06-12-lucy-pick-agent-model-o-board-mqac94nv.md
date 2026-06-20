---
kind: brain-signal
id: sig-2026-06-12-lucy-pick-agent-model-o-board-mqac94nv
created_at: 2026-06-12T02:59:53.947Z
topic: Lucy/pick-agent-model-o-board
signal: negative
agent: engine
principle: "BUG MEDIUM tìm thấy: laneModel modelOverride là no-op im lặng khi persona thiếu laneModel field — engine.ts:368 + worker-main.ts:21. Fix: validate ở coordinator (từ chối nếu personaOverride persona không có laneModel) hoặc chỉ show laneModel option trong Board khi persona có laneModel set. Test smoke-pick-agent.ts 16/16 pass, đã tái hiện bug ở case #8."
scope: tester
evidenced_by: [card_mqa8xuka2]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: BUG MEDIUM tìm thấy: laneModel modelOverride là no-op im lặng khi persona thiếu laneModel field — engine.ts:368 + worker-main.ts:21. Fix: validate ở coordinator (từ chối nếu personaOverride persona không có laneModel) hoặc chỉ show laneModel option trong Board khi persona có laneModel set. Test smoke-pick-agent.ts 16/16 pass, đã tái hiện bug ở case #8.
