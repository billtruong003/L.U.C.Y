---
kind: brain-signal
id: sig-2026-06-12-lucy-cost-ledger-metrics-mqaci5j5
created_at: 2026-06-12T03:06:54.977Z
topic: Lucy/cost-ledger-metrics
signal: negative
agent: engine
principle: "10/12 mục spec chưa đạt: (1) store.readLedger() + export LedgerEntry chưa có trong store.ts; (2) buildMetrics nhận vaultDir? thay vì recall?:Recall|null (metrics.ts:19, coordinator.ts:75); (3) vault trả {fileCount} thay vì recall.stats() (metrics.ts:61-75); (4) costByProject hoàn toàn thiếu; (5) totals hoàn toàn thiếu; (6) cardThroughput dùng card.status+updatedAt thay vì card.history events, field 'failed' phải là 'created' (metrics.ts:50-58); (7) tokenByDay thiếu usd, costByModel/Agent thiếu inTok/outTok/runs; (8) shape là array thay vì dict {[key]:{...}} theo PLAN; (9) smoke không test costByProject/totals/recall-vault. Sửa tuần tự B1→B5 đúng PLAN."
scope: reviewer-spec
evidenced_by: [card_mqa8xui60]
---
## Raw
Giyu · Spec-Review REWORK @ Spec-compliance (đúng yêu cầu?): 10/12 mục spec chưa đạt: (1) store.readLedger() + export LedgerEntry chưa có trong store.ts; (2) buildMetrics nhận vaultDir? thay vì recall?:Recall|null (metrics.ts:19, coordinator.ts:75); (3) vault trả {fileCount} thay vì recall.stats() (metrics.ts:61-75); (4) costByProject hoàn toàn thiếu; (5) totals hoàn toàn thiếu; (6) cardThroughput dùng card.status+updatedAt thay vì card.history events, field 'failed' phải là 'created' (metrics.ts:50-58); (7) tokenByDay thiếu usd, costByModel/Agent thiếu inTok/outTok/runs; (8) shape là array thay vì dict {[key]:{...}} theo PLAN; (9) smoke không test costByProject/totals/recall-vault. Sửa tuần tự B1→B5 đúng PLAN.
