---
name: lucy-memory-phase0-recall-prefetch
description: "Phase 0 trí nhớ — prefetch recall vào đường chat (POST /recall + bridge/hub chèn khối memory), flag LUCY_RECALL_PREFETCH"
metadata: 
  node_type: memory
  type: project
  originSessionId: de96fc67-084a-4681-8961-cd144e5edfc1
---

Lucy long-term-memory execution plan (`lucy-vault/Brain/proposals/2026-06-14-lucy-memory-execution-plan.md`) — Phase 0 DONE (2026-06-14).

- `agent-machine/src/coordinator.ts`: `POST /recall {q,limit?}` → freshIndex() incremental + recall.search, cap limit≤8, try/catch trả `{hits:[]}` khi lỗi. Trả gọn `[{title,snippet,file_path,rank,type}]`.
- `bridge/lucy_bridge.py`: `recall_prefetch(text)` POST /recall (timeout 4s) → khối `🧠 Trí nhớ liên quan` prepend vào prompt cả lane + claude path (cap 5 hit/~800 ký tự). Lỗi → "".
- `hub/server/src/index.ts`: `recallPrefetch(text)` prepend vào claude-path trước streamClaude (`cprompt`).
- Flag `LUCY_RECALL_PREFETCH` (mặc định on; =0/off/false → tắt). Additive, không phá luồng cũ.
- Deploy: restart lucy-coordinator + lucy-hub. KHÔNG restart lucy-bridge (code bridge sẵn, áp khi chủ nhân tự restart bridge).

Tiếp theo: Phase 1 (hybrid FTS5+vector qua sqlite-vec + Jina embed, flag LUCY_VECTOR), Phase 2 (episodic turns store). Phase 3-4 (xoá/invalidate memory) = chờ chủ nhân duyệt. Xem [[daily-brief-setup]] cho cron pattern, [[lane-agentic-tools]] cho lane.
