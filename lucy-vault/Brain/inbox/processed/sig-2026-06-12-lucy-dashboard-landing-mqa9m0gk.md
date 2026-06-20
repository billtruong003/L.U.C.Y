---
kind: brain-signal
id: sig-2026-06-12-lucy-dashboard-landing-mqa9m0gk
created_at: 2026-06-12T01:45:56.180Z
topic: Lucy/dashboard-landing
signal: negative
agent: engine
principle: "Fix MEDIUM (costByModel join persona→model) ĐÃ ĐẠT, build sạch — NHƯNG phát sinh CRITICAL: hub/server/src/index.ts:477 và :479 thiếu costByAgent:[] trong 2 nhánh fallback (unconfigured/offline), khiến Dashboard.tsx:44 (data.costByAgent.map) crash trắng trang landing khi coordinator chưa lên; thêm costByAgent:[] vào cả 2 object là xong."
scope: reviewer
evidenced_by: [card_mqa8xujo1]
---
## Raw
Rengoku · Reviewer REWORK @ Review chất lượng & duyệt: Fix MEDIUM (costByModel join persona→model) ĐÃ ĐẠT, build sạch — NHƯNG phát sinh CRITICAL: hub/server/src/index.ts:477 và :479 thiếu costByAgent:[] trong 2 nhánh fallback (unconfigured/offline), khiến Dashboard.tsx:44 (data.costByAgent.map) crash trắng trang landing khi coordinator chưa lên; thêm costByAgent:[] vào cả 2 object là xong.
