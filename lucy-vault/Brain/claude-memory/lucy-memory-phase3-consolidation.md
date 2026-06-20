---
name: lucy-memory-phase3-consolidation
description: "Phase 3 gộp trí nhớ Mem0-style (consolidate.ts, DRY-RUN gated) + secret-redaction (redact.ts) — chờ bật APPLY"
metadata: 
  node_type: memory
  type: project
  originSessionId: 41f144bb-82f1-4375-b752-1f6285104d38
---

PHASE 3 (consolidation) đã build ở DRY-RUN (2026-06-14). `agent-machine/src/consolidate.ts`: gộp `Brain/claude-memory/*.md` (1 file=1 fact) kiểu Mem0 — embed mọi fact qua Jina (embed.ts) → cosine pairwise → cặp sim≥0.86 đưa decider LLM rẻ (lane free/Haiku auxComplete) quyết ADD/UPDATE/DELETE/NOOP; reflection (cụm sim≥0.78, tổng trust≥5) sinh insight. Trust-weight type=user/feedback ×2 (giữ bản tin cậy). **An toàn: lỗi/parse-fail LLM → NOOP, không xoá nhầm.**

DRY-RUN MẶC ĐỊNH: `npm run consolidate` in diff + ghi report `Brain/proposals/consolidate-<date>.md`, KHÔNG đụng file. Ghi thật chỉ khi `LUCY_CONSOLIDATE_APPLY=1` (snapshot `.snapshots/consolidate-*` trước → DELETE unlink+dọn pointer MEMORY.md / UPDATE gộp merged). Cắm dream-cli fire-safe gated `LUCY_CONSOLIDATE=1`. Smoke `smoke-consolidate.ts` 16/16. Live dry-run vault thật: 21 fact, 0 cặp gần-trùng (đang gọn).

Secret-redaction (cùng vòng): `redact.ts scrubSecrets()` giấu jina_*/sk-*/ghp_*/Bearer/`*_API_KEY=`/base64-dài→`[REDACTED]`, không đụng văn xuôi/git-sha. Áp embed.ts (passage+query trước Jina) + recall.recordTurn (backstop) + bridge scrub_secrets (episodic_log) + hub scrubSecrets (episodicLog). Smoke 16/16. Verify live: /episodic với jina_… → lưu `[REDACTED]`.

NEXT: Phase 4 (forgetting bi-temporal valid_from/valid_to). Rồi chờ chủ nhân xem diff bật APPLY. Xem [[lucy-memory-phase2-episodic]] [[lucy-longterm-memory-buildout]].
