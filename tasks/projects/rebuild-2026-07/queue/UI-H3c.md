---
id: UI-H3c
title: HUD decor: Brain constellation (React, thay galaxy cũ)
priority: 12
tier: claude
model: opus
scope: ui
status: queued
---

Dựng lại NeuralTab/BrainViz thành constellation HUD (theo mockup /reports/lucy-hud-mockup.html): lõi Lucy tâm phát sáng, orbital rings theo cụm (project/daily/skill/episodic), node size=importance màu=loại, đường nối=relation, hover node hiện fact. Data từ /api/brain/graph. Panel Index + cụm bên phải.
**RÀNG BUỘC:** branch riêng, KHÔNG push main, KHÔNG restart bridge/coordinator, build `cd hub/web && npm run build` (serve tĩnh). Verify bằng tools/shot-hub.mjs + đọc screenshot. Acceptance: build 0 error, screenshot đúng, không vỡ tab khác.
