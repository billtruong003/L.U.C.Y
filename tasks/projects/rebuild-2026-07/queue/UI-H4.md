---
id: UI-H4
title: Voice orb slot ở rail (visualizer placeholder)
priority: 15
tier: claude
model: sonnet
scope: ui
status: queued
---

Thêm voice orb (arc-reactor SVG pulse) vào HudRail/rail phải — slot sẵn cho voice sau. Chưa wire audio, chỉ visual + trạng thái LISTENING/IDLE placeholder.
**RÀNG BUỘC:** branch riêng, KHÔNG push main, KHÔNG restart bridge/coordinator, build `cd hub/web && npm run build` (serve tĩnh). Verify bằng tools/shot-hub.mjs + đọc screenshot. Acceptance: build 0 error, screenshot đúng, không vỡ tab khác.
