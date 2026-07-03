---
id: UI-H3b
title: HUD decor: Dashboard (KPI hud-frame + mono readout + gauge)
priority: 11
tier: claude
model: sonnet
scope: ui
status: queued
---

Dashboard.tsx: KPI dùng .hud-frame + .hud-lbl mono, tách inner-tabs vào header, SN-style readout cho providers/diagnostic, gauge SVG cho load. Tách monolith 973 dòng thành Overview/Insights/ForLucy nếu kịp.
**RÀNG BUỘC:** branch riêng, KHÔNG push main, KHÔNG restart bridge/coordinator, build `cd hub/web && npm run build` (serve tĩnh). Verify bằng tools/shot-hub.mjs + đọc screenshot. Acceptance: build 0 error, screenshot đúng, không vỡ tab khác.
