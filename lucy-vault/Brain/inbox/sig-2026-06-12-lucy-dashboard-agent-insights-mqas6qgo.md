---
kind: brain-signal
id: sig-2026-06-12-lucy-dashboard-agent-insights-mqas6qgo
created_at: 2026-06-12T10:25:56.088Z
topic: Lucy/dashboard-agent-insights
signal: negative
agent: engine
principle: "CRITICAL Dashboard.tsx:144+151 — personaMap keyed by id nhưng tra bằng r.persona (=persona.name, engine.ts:415) → mọi report bị bỏ, Insights luôn rỗng; sửa key personaMap theo name. MEDIUM classifyReport:72 bỏ sót event 'rework' (engine.ts:447) → đếm hụt rework; thêm điều kiện match 'rework'."
scope: reviewer
evidenced_by: [card_mqadppyod]
---
## Raw
Rengoku · Reviewer REWORK @ Review chất lượng & duyệt: CRITICAL Dashboard.tsx:144+151 — personaMap keyed by id nhưng tra bằng r.persona (=persona.name, engine.ts:415) → mọi report bị bỏ, Insights luôn rỗng; sửa key personaMap theo name. MEDIUM classifyReport:72 bỏ sót event 'rework' (engine.ts:447) → đếm hụt rework; thêm điều kiện match 'rework'.
