---
kind: brain-signal
id: sig-2026-06-12-lucy-dashboard-landing-mqa9f1fm
created_at: 2026-06-12T01:40:30.850Z
topic: Lucy/dashboard-landing
signal: negative
agent: engine
principle: "[MEDIUM] Panel 'Cost by Model' (Dashboard.tsx:123) thực chất hiển thị persona.id (builder/reviewer) chứ không phải model — coordinator.ts:90,101 chỉ gom byPersona rồi xuất thành costByModel; card yêu cầu cả model lẫn agent. Fix: join persona→model (store.personas.get(e.persona).model) tạo byModel thật, đổi label/giữ cả hai. Còn lại đạt: default tab Dashboard, ledger contract khớp, vite build sạch."
scope: reviewer
evidenced_by: [card_mqa8xujo1]
---
## Raw
Rengoku · Reviewer REWORK @ Review chất lượng & duyệt: [MEDIUM] Panel 'Cost by Model' (Dashboard.tsx:123) thực chất hiển thị persona.id (builder/reviewer) chứ không phải model — coordinator.ts:90,101 chỉ gom byPersona rồi xuất thành costByModel; card yêu cầu cả model lẫn agent. Fix: join persona→model (store.personas.get(e.persona).model) tạo byModel thật, đổi label/giữ cả hai. Còn lại đạt: default tab Dashboard, ledger contract khớp, vite build sạch.
