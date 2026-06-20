---
title: "[MEDIUM] Panel 'Cost by Model' (Dashboard.tsx:123) thực chất hiển thị persona.id"
type: preference
kind: brain-preference
id: pref-lucy-dashboard-landing
topic: Lucy/dashboard-landing
sign: negative
status: confirmed
principle: "[MEDIUM] Panel 'Cost by Model' (Dashboard.tsx:123) thực chất hiển thị persona.id (builder/reviewer) chứ không phải model — coordinator.ts:90,101 chỉ gom byPersona rồi xuất thành costByModel; card yêu cầu cả model lẫn agent. Fix: join persona→model (store.personas.get(e.persona).model) tạo byModel thật, đổi label/giữ cả hai. Còn lại đạt: default tab Dashboard, ledger contract khớp, vite build sạch."
scope: reviewer
confidence: 0.1934
band: low
applied: 2
violated: 1
evidenced_by: [sig-2026-06-12-lucy-dashboard-landing-mqa9f1fm, sig-2026-06-12-lucy-dashboard-landing-mqa9m0gk]
created_at: 2026-06-12T03:00:27.317Z
updated_at: 2026-06-19T19:00:04.363Z
last_evidence_at: 2026-06-13T14:40:18.317Z
pinned: false
tags: [brain, preference]
permalink: pref-lucy-dashboard-landing
---

# [MEDIUM] Panel 'Cost by Model' (Dashboard.tsx:123) thực chất hiển thị persona.id (builder/reviewer) chứ không phải model — coordinator.ts:90,101 chỉ gom byPersona rồi xuất thành costByModel; card yêu cầu cả model lẫn agent. Fix: join persona→model (store.personas.get(e.persona).model) tạo byModel thật, đổi label/giữ cả hai. Còn lại đạt: default tab Dashboard, ledger contract khớp, vite build sạch.

- [rule] [MEDIUM] Panel 'Cost by Model' (Dashboard.tsx:123) thực chất hiển thị persona.id (builder/reviewer) chứ không phải model — coordinator.ts:90,101 chỉ gom byPersona rồi xuất thành costByModel; card yêu cầu cả model lẫn agent. Fix: join persona→model (store.personas.get(e.persona).model) tạo byModel thật, đổi label/giữ cả hai. Còn lại đạt: default tab Dashboard, ledger contract khớp, vite build sạch. #preference #reviewer
- trạng thái: **confirmed** · confidence 0.1934 (low) · negative · applied 2/violated 1
