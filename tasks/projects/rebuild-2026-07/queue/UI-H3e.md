---
id: UI-H3e
title: HUD decor: 16 tab còn lại + adopt lucide + codemod emoji-icon
priority: 14
tier: claude
model: sonnet
scope: ui
status: queued
---

Sweep các tab còn lại (AutoTask/Memory/Personas/Skills/Connect/...) áp .hud-frame/.hud-lbl + primitive ui/. Thay emoji-làm-icon bằng lucide-react (giữ emoji nội dung). Fix màu off-token về semantic.
**RÀNG BUỘC:** branch riêng, KHÔNG push main, KHÔNG restart bridge/coordinator, build `cd hub/web && npm run build` (serve tĩnh). Verify bằng tools/shot-hub.mjs + đọc screenshot. Acceptance: build 0 error, screenshot đúng, không vỡ tab khác.
