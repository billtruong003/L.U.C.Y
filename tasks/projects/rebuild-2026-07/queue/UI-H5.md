---
id: UI-H5
title: Verify a11y/contrast HUD + responsive + reduce-fx
priority: 16
tier: claude
model: sonnet
scope: ui
status: queued
---

Verify contrast text/surface ≥4.5:1 trên graphite near-black, focus ring, reduce-fx tắt scanline/glow OK, responsive 390/768/1280. Fix chỗ fail. Codemod 534 text-[Npx] → scale nếu kịp.
**RÀNG BUỘC:** branch riêng, KHÔNG push main, KHÔNG restart bridge/coordinator, build `cd hub/web && npm run build` (serve tĩnh). Verify bằng tools/shot-hub.mjs + đọc screenshot. Acceptance: build 0 error, screenshot đúng, không vỡ tab khác.
