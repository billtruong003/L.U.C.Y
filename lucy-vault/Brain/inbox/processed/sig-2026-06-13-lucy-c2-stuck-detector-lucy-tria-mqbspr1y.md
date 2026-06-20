---
kind: brain-signal
id: sig-2026-06-13-lucy-c2-stuck-detector-lucy-tria-mqbspr1y
created_at: 2026-06-13T03:28:29.494Z
topic: Lucy/c2-stuck-detector-lucy-triage-split
signal: negative
agent: engine
principle: "BUG CRITICAL tái hiện: engine.ts:555 bump reset sai — chỉ clear stage đang kẹt (build), bỏ sót stageVisits.test=2; fix = cv.stageVisits = {} thay vì cv.stageVisits[stage.id] = 0; T6 fail xác nhận; thêm gap nhỏ ở assertion T6-cuối không đủ detect re-stuck."
scope: tester
evidenced_by: [card_mqb4cx8q2]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: BUG CRITICAL tái hiện: engine.ts:555 bump reset sai — chỉ clear stage đang kẹt (build), bỏ sót stageVisits.test=2; fix = cv.stageVisits = {} thay vì cv.stageVisits[stage.id] = 0; T6 fail xác nhận; thêm gap nhỏ ở assertion T6-cuối không đủ detect re-stuck.
