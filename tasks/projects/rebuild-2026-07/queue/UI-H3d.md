---
id: UI-H3d
title: HUD decor: shell (sidebar/header khung HUD) + PageShell rollout
priority: 13
tier: claude
model: sonnet
scope: ui
status: queued
---

App.tsx shell: sidebar nav HUD (mono label, active bracket), header corner-frame, bottom-nav mobile HUD. Rollout PageShell cho các tab còn thiếu (Personas/Connect/Schedule/Tasks/Logs/Settings) + fix padding cứng mobile.
**RÀNG BUỘC:** branch riêng, KHÔNG push main, KHÔNG restart bridge/coordinator, build `cd hub/web && npm run build` (serve tĩnh). Verify bằng tools/shot-hub.mjs + đọc screenshot. Acceptance: build 0 error, screenshot đúng, không vỡ tab khác.
