---
title: "phiên: Dashboard landing"
type: daily
kind: session-note
card: card_mqa8xujo1
project: Lucy
status: done
created_at: 2026-06-12T02:30:34.706Z
tags: [session, Lucy]
permalink: session-card_mqa8xujo1
---

# Phiên: Dashboard landing

> ⏳ Phiên này đã **KẾT THÚC 2026-06-12** (DONE) — đây là **QUÁ KHỨ**, đừng giải lại;
> chỉ dùng để tra cứu "đã làm gì / còn gì treo".

- [goal] Tab Dashboard thành trang mở mặc định. Hiển thị /metrics + providerStatus: token ngày→tháng, cost/model·/agent, model sống/chết, card chạy, cảnh báo token. Dark-premium #05070e+cyan. DoD: mở web=Dashboard, số thật, vite build sạch. #Lucy
- [done] Đã chạy thử: vite build sạch, costByAgent:[] có đủ ở cả 2 fallback (index.ts:477,479) chặn crash landing, costByModel join persona→model thật (coordinator.ts:99) + costByAgent riêng, default tab Dashboard, contract khớp — lỗi TS7006 server là pre-existing (chạy tsx, không type-check) không phải regr
- [feedback] [MEDIUM] Panel 'Cost by Model' (Dashboard.tsx:123) thực chất hiển thị persona.id (builder/reviewer) chứ không phải model — coordinator.ts:90,101 chỉ gom byPersona rồi xuất thành costByModel; card yêu cầu cả model lẫn agent. Fix: join persona→model (store.personas.get(e.persona).model) tạo byModel th
- [files] gent-machine/src/coordinator.ts, hub/server/src/index.ts, hub/web/src/App.tsx, hub/web/src/api.ts, agent-machine/PLAN-metrics.md, hub/web/src/components/Dashboard.tsx
- [cost] $3.068 · 10 bước · 4 rework · ~63 phút
- thuộc_dự_án [[project-Lucy]]
