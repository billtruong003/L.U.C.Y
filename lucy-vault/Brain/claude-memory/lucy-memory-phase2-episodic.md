---
name: lucy-memory-phase2-episodic
description: "Phase 2 episodic store — lưu turn hội thoại vào memory.db, gộp vào recall cross-session"
metadata: 
  node_type: memory
  type: project
  originSessionId: 165f7ca9-7ff4-4398-ab44-fcd8a57cc5fe
---

Phase 2 long-term memory (episodic) LIVE 2026-06-14. Bảng `turns(ts,source,chat_id,role,content,session_id)` + FTS5 `turns_fts` trong CÙNG `.index/memory.db` (additive, không đụng note manual của [[lucy-memory-phase1-hybrid-vector]]).

- `recall.ts`: `recordTurn` (cắt 8000, rỗng→null, lỗi→null không nổ), `searchTurns` (strict→relaxed-OR, sinceDays), `pruneTurns(90)` retention, `episodicFlagOn()` flag `LUCY_EPISODIC` mặc định ON (single-user = data chủ nhân).
- `coordinator.ts`: POST `/episodic` ghi turn (debounce prune 1h, env `LUCY_EPISODIC_RETENTION_DAYS`=90); GET `/episodic?q` verify; POST `/recall` gộp top-3 episodic đánh dấu `type='episodic'` (title `💬 <ai> (ngày)`) sau manual hit.
- Ghi turn: bridge `episodic_log()` thread + hub `episodicLog()` fetch — đều fire-and-forget, không chặn chat. Bridge code sẵn nhưng CHỈ áp khi chủ nhân restart lucy-bridge (autobuild không restart bridge).

**Why:** cross-session "hôm trước mình bàn gì về X" — đường recall [[lucy-memory-phase0-recall-prefetch]] giờ kéo cả manual memory lẫn turn hội thoại cũ.
**How to apply:** muốn tắt → `LUCY_EPISODIC=0`. Phase 3-4 (consolidation DELETE/UPDATE + forgetting = XOÁ memory) CHỜ chủ nhân duyệt, autobuild dừng trước Phase 3.
