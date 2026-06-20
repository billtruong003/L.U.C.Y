---
kind: brain-signal
id: sig-2026-06-12-lucy-pick-agent-model-o-board-mqak31wn
created_at: 2026-06-12T06:39:07.367Z
topic: Lucy/pick-agent-model-o-board
signal: negative
agent: engine
principle: "2 CRITICAL bug tại coordinator.ts:57 chưa fix: (1) b.personaId không pass vào engine.createCard() → personaOverride luôn undefined qua HTTP API; (2) 'laneModel' bị strip trong điều kiện mdl → modelOverride='laneModel' không bao giờ đến engine. Tái hiện: _test-coordinator-card.ts 3/6 fail. Fix: thêm 'laneModel' vào điều kiện mdl VÀ thêm b.personaId||undefined làm arg cuối của engine.createCard()."
scope: tester
evidenced_by: [card_mqa8xuka2]
---
## Raw
Shinobu · Tester REWORK @ Viết test & tìm bug: 2 CRITICAL bug tại coordinator.ts:57 chưa fix: (1) b.personaId không pass vào engine.createCard() → personaOverride luôn undefined qua HTTP API; (2) 'laneModel' bị strip trong điều kiện mdl → modelOverride='laneModel' không bao giờ đến engine. Tái hiện: _test-coordinator-card.ts 3/6 fail. Fix: thêm 'laneModel' vào điều kiện mdl VÀ thêm b.personaId||undefined làm arg cuối của engine.createCard().
