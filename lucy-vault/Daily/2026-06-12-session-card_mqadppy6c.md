---
title: "phiên: Bộ phân loại + thống kê lỗi agent"
type: daily
kind: session-note
card: card_mqadppy6c
project: Lucy
status: done
created_at: 2026-06-12T10:04:56.023Z
tags: [session, Lucy]
permalink: session-card_mqadppy6c
---

# Phiên: Bộ phân loại + thống kê lỗi agent

> ⏳ Phiên này đã **KẾT THÚC 2026-06-12** (DONE) — đây là **QUÁ KHỨ**, đừng giải lại;
> chỉ dùng để tra cứu "đã làm gì / còn gì treo".

- [goal] Đọc log JSONL từ lớp hứng log, phân nhóm lỗi (hết-turn-không-outcome, sai-output, spec-fail, build-fail, loop...) và đếm tần suất theo agent + theo model. Xuất bảng tổng hợp lỗi nào nhiều nhất. #Lucy
- [done] Verify thực tế: tsc sạch, 29/29 smoke xanh (2 file repro exit-đảo = không tái hiện bug), CLI tách đúng byModel khi SOFT hạ cấp; 3 bug feedback fixed end-to-end, spec đủ 4 yêu cầu — PASS.
- [feedback] Có vấn đề — làm lại kỹ hơn. · Cột byModel sai: TurnRecord thiếu field 'model' (turn-log.ts:12) nên error-stats.ts:135 suy lại từ config → khi TokenGuard SOFT hạ cấp (engine.ts:383, laneModel→ds-v4-flash-free) thì lỗi bị gom nhầm về config laneModel (devstral-med); fix: ghi model thực vào record ở la
- [files] gent-machine/config/personas/tester.json, agent-machine/package.json, agent-machine/src/autopilot-main.ts, agent-machine/src/coordinator-main.ts, agent-machine/src/coordinator.ts, agent-machine/src/engine.ts, agent-machine/src/lane-runner.ts, agent-machine/src/llm-lane.ts, agent-machine/src/runner.ts, agent-machine/src/store.ts, agent-machine/src/types.ts, agent-machine/src/worker-main.ts
- [cost] $9.962 · 13 bước · 6 rework · ~384 phút
- thuộc_dự_án [[project-Lucy]]
