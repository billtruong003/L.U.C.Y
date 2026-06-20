---
kind: brain-signal
id: sig-2026-06-12-lucy-autopilot-minh-bach-token-g-mqafzjcb
created_at: 2026-06-12T04:44:24.875Z
topic: Lucy/autopilot-minh-bach-token-guard
signal: negative
agent: engine
principle: "2 gap CRITICAL: (1) engine.submit() thiếu tokenGuard.addTokens() → counter không bao giờ cộng (engine.ts:400); (2) actor 'lucy' chưa wire ở engine.approve/reject/answer + coordinator.ts:83-85 + autopilot-main.ts:118,125,132 → board vẫn hiện 'bill'. Thêm: claim() downgrade không scope executor (engine.ts:374), stale comment autopilot:87, smoke thiếu submit→addTokens case."
scope: reviewer-spec
evidenced_by: [card_mqa8xuni5]
---
## Raw
Giyu · Spec-Review REWORK @ Spec-compliance (đúng yêu cầu?): 2 gap CRITICAL: (1) engine.submit() thiếu tokenGuard.addTokens() → counter không bao giờ cộng (engine.ts:400); (2) actor 'lucy' chưa wire ở engine.approve/reject/answer + coordinator.ts:83-85 + autopilot-main.ts:118,125,132 → board vẫn hiện 'bill'. Thêm: claim() downgrade không scope executor (engine.ts:374), stale comment autopilot:87, smoke thiếu submit→addTokens case.
