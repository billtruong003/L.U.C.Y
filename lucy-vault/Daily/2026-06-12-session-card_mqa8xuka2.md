---
title: "phiên: Pick-agent + model ở Board"
type: daily
kind: session-note
card: card_mqa8xuka2
project: Lucy
status: done
created_at: 2026-06-12T07:32:55.685Z
tags: [session, Lucy]
permalink: session-card_mqa8xuka2
---

# Phiên: Pick-agent + model ở Board

> ⏳ Phiên này đã **KẾT THÚC 2026-06-12** (DONE) — đây là **QUÁ KHỨ**, đừng giải lại;
> chỉ dùng để tra cứu "đã làm gì / còn gì treo".

- [goal] Giao card chọn persona(14)+model override (opus/sonnet/laneModel). Truyền /card field model + personaId stage đầu. DoD: chọn builder=Tanjiro DeepSeek → card chạy đúng; smoke/manual. #Lucy
- [done] Verified chain personaId+laneModel Board→engine đã fix đủ; smoke 19/19, tsc exit 0, web build clean, guard 400 chặn no-op — đạt DoD, duyệt qua bước kế.
- [feedback] 2 CRITICAL bug tại coordinator.ts:57 chưa fix: (1) b.personaId không pass vào engine.createCard() → personaOverride luôn undefined qua HTTP API; (2) 'laneModel' bị strip trong điều kiện mdl → modelOverride='laneModel' không bao giờ đến engine. Tái hiện: _test-coordinator-card.ts 3/6 fail. Fix: thêm 
- [files] gent-machine/config/personas/tester.json, agent-machine/package.json, agent-machine/src/autopilot-main.ts, agent-machine/src/coordinator-main.ts, agent-machine/src/coordinator.ts, agent-machine/src/engine.ts, agent-machine/src/lane-runner.ts, agent-machine/src/llm-lane.ts, agent-machine/src/runner.ts, agent-machine/src/store.ts, agent-machine/src/types.ts, agent-machine/src/worker-main.ts
- [cost] $9.663 · 18 bước · 10 rework · ~366 phút
- thuộc_dự_án [[project-Lucy]]
