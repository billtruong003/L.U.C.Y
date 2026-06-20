---
title: "phiên: C1 Rate-limit → park + báo Telegram"
type: daily
kind: session-note
card: card_mqb4cx8g1
project: Lucy
status: failed
created_at: 2026-06-13T02:35:30.655Z
tags: [session, Lucy]
permalink: session-card_mqb4cx8g1
---

# Phiên: C1 Rate-limit → park + báo Telegram

> ⏳ Phiên này đã **KẾT THÚC 2026-06-13** (FAILED) — đây là **QUÁ KHỨ**, đừng giải lại;
> chỉ dùng để tra cứu "đã làm gì / còn gì treo".

- [goal] callLLMRaw tất cả fallback dính 429/quota → phân loại lỗi rate-limit (KHÁC fail). Engine: card → status parked + retryAfter, không retry đốt token. notify.ts soạn tin ngắn bằng ds-v4-flash-free gửi ĐÚNG 1 lần qua Telegram. DoD: smoke giả lập 429 → card parked + 0 retry vô ích + 1 tin (mock fetch); t #Lucy
- [done] DoD lõi đạt & 2 bug cũ confirmed fixed, NHƯNG còn [MEDIUM] notify.ts:9 dedup câm lặng khi retryAfter=undefined (429 thiếu Retry-After header, trường hợp phổ biến) → re-queue park lần 2 mất Telegram (probe xác nhận telegramCalls=1≠2); +[LOW] dead var hasOtherError llm-lane.ts:159/233. Trả về sửa: khó
- [pending] Bug CRITICAL confirmed: mixed 429+500 tại llm-lane.ts:160/223 → nonRlCount===0 quá strict → throw Error thay vì RateLimitError → card failed thay vì parked; test tái hiện đã viết và chạy xanh cho đúng behavior, đỏ cho bug
- [feedback] Bug 1 CONFIRMED: mixed 429+500 → callLLMRaw nonRlCount===0 quá strict → throw generic Error → card failed thay vì parked (llm-lane.ts:160/223). Bug 2 không tồn tại trong code hiện tại — test regression guard đã viết và pass. · Bug CRITICAL confirmed: mixed 429+500 tại llm-lane.ts:160/223 → nonRlCoun
- [files] gent-machine/package.json, agent-machine/src/autopilot-main.ts, agent-machine/src/coordinator-main.ts, agent-machine/src/coordinator.ts, agent-machine/src/engine.ts, agent-machine/src/lane-runner.ts, agent-machine/src/llm-lane.ts, agent-machine/src/runner.ts, agent-machine/src/store.ts, agent-machine/src/types.ts, agent-machine/src/worker-main.ts, hub/server/src/index.ts
- [cost] $7.893 · 14 bước · 8 rework · ~629 phút
- thuộc_dự_án [[project-Lucy]]
