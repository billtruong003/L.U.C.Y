---
name: lucy-hub-ui-redesign
description: "Lucy Hub UI redesign — direction \"Chat Cockpit\" + galaxy sphere; chia U1-U5, render-perf là yêu cầu cứng"
metadata: 
  node_type: memory
  type: project
  originSessionId: dfefdf60-3a56-4920-a80e-b4fece057360
---

Redesign UI Lucy Hub (React+Vite+TS+Tailwind+three.js). Plan: `lucy-vault/Brain/proposals/2026-06-14-ui-redesign-execution.md` (kèm deep-research `2026-06-14-ui-ux-research.md`).

**Direction chốt (2026-06-14): "Chat Cockpit"** — chat trung tâm + nav rail nhóm + Cmd+K command palette + HUD theo ngữ cảnh; vibe Jarvis TIẾT CHẾ (màu/motion/glow, KHÔNG rải panel trang trí gây rối).

Chia task làm TỪNG CÁI (Bill thích FOCUS, ghét dàn trải):
- **U1** Galaxy SPHERE (forceRadial ép node lên vỏ cầu, cluster=lục địa, auto-rotate, glow) + **RENDER PERF** ⭐. U2 gom tinh hà về 1 tab (đang ở 2: Memory+NeuralTab). U3 nav nhóm + Cmd+K. U4 responsive (rail co, bottom-sheet, bỏ width cứng). U5 persona roster RPG.

**Yêu cầu CỨNG về render (Bill nhấn mạnh):** kéo thanh time-travel galaxy KHÔNG được lag → force sim chạy 1 lần rồi FREEZE; kéo slider CHỈ đổi visibility/opacity node theo timestamp, KHÔNG re-layout/re-sim; throttle qua rAF; pause auto-rotate khi kéo; LOD label. Mục tiêu ~60fps với 300+ node.

Mỗi task: auto-build opus → tsc+build web → rehost (no bridge) → Bill xem vibe → mới qua task sau. Mỗi task có flag revert. Liên quan: [[lucy-hub-web-command-center]].

**Theme chốt (2026-06-15): "Jarvis Cockpit"** — nền glass-minimalism + hover-reveal (đa số CSS, nhẹ), điểm nhấn Jarvis (arc-reactor + vòng HUD xoay ở galaxy/persona/dashboard), màu cyan #22d3ee + gold #f5b54a (Iron Man), dark. Execute gộp **6 nhóm T1-T6** (UI foundation/nav+CmdK/persona/MCP core/MCP connectors/skill) — plan `docs/MASTER-EXECUTION-UI-M2-M3.md`.

**⭐ "M3.6" — 2 TASK DEEP-RESEARCH (KHÔNG execute), SAU runner 6 nhóm + không hold token:** (1) research đại tu UI full (audit + đề xuất design mới cho cả web trên nền Jarvis Cockpit) + (2) research khai thác Jina sâu (omni đa phương thức mockup/screenshot + reranker... [[jina-potential-roadmap]]) — SONG SONG, bổ trợ nhau. Dùng skill deep-research, RA Ý TƯỞNG/PROPOSAL thôi, KHÔNG sửa code; execute là đợt riêng sau khi chủ nhân duyệt. Chi tiết `docs/MORNING-HANDOFF.md`.
