---
title: "phiên: C1-fix — vá dedup câm ở notify.ts"
type: daily
kind: session-note
card: card_mqbrzabg19
project: Lucy
status: done
created_at: 2026-06-13T04:29:30.667Z
tags: [session, Lucy]
permalink: session-card_mqbrzabg19
---

# Phiên: C1-fix — vá dedup câm ở notify.ts

> ⏳ Phiên này đã **KẾT THÚC 2026-06-13** (DONE) — đây là **QUÁ KHỨ**, đừng giải lại;
> chỉ dùng để tra cứu "đã làm gì / còn gì treo".

- [goal] Fix bug MEDIUM còn sót của task [failed] C1 Rate-limit → park + báo Telegram. Lỗi: notify.ts:9 dedup câm lặng — khi cùng key nhưng retryAfter thay đổi (rate-limit được gia hạn), notify bị dedup nuốt nên Telegram không báo lại, chủ mất tín hiệu park kéo dài. Sửa logic dedup: chỉ suppress khi retryAft #Lucy
- [done] notify.ts đã có Map dedup thật (suppress khi retryAfter không đổi, fire+log khi đổi); tsc sạch, smoke 8/8 xanh chứng minh cả 2 case — PASS.
- [feedback] notify.ts hoàn toàn KHÔNG có dedup (Set/Map đều absent) — bước trước khai sai; smoke CASE1/3 xác nhận: mỗi call đều fire, không suppress. Engineer phải add Map<string,number> ở module-level trong notify.ts, suppress khi same key+same retryAfterMs, fire+log khi retryAfterMs đổi.
- [files] gent-machine/package.json, agent-machine/src/autopilot-main.ts, agent-machine/src/coordinator-main.ts, agent-machine/src/coordinator.ts, agent-machine/src/engine.ts, agent-machine/src/lane-runner.ts, agent-machine/src/llm-lane.ts, agent-machine/src/runner.ts, agent-machine/src/store.ts, agent-machine/src/types.ts, agent-machine/src/worker-main.ts, hub/server/src/index.ts
- [cost] $2.644 · 9 bước · 2 rework · ~82 phút
- thuộc_dự_án [[project-Lucy]]
