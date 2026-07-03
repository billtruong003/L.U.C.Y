---
id: UI-H3a
title: HUD decor: Chat screen (Stop+picker popover+message vát góc)
priority: 10
tier: claude
model: sonnet
scope: ui
status: queued
---

Áp HUD lên Chat.tsx: message panel clip-path vát góc (dùng .hud-frame cho card lớn), nút Stop khi đang stream (đã có busy state), model picker → popover nhóm thay <select> thô, badge model mono. Giữ streaming/thinking/tool disclosure.
**RÀNG BUỘC:** branch riêng, KHÔNG push main, KHÔNG restart bridge/coordinator, build `cd hub/web && npm run build` (serve tĩnh). Verify bằng tools/shot-hub.mjs + đọc screenshot. Acceptance: build 0 error, screenshot đúng, không vỡ tab khác.
