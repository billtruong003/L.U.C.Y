---
name: lucy-memory-phase4-bitemporal
description: "Phase 4 forgetting bi-temporal (Zep) — valid_to lọc fact hết hiệu lực, SUPERSEDE gated; DRY-RUN chờ APPLY"
metadata: 
  node_type: memory
  type: project
  originSessionId: be9d276f-7162-47f2-bfa6-1b7036704ec8
---

Phase 4 long-term memory (forgetting / bi-temporal Zep-style) LIVE ở DRY-RUN (2026-06-14). Fact = `Brain/claude-memory/*.md`, file = SỰ THẬT.

- `vault.ts` `upsertFrontmatterKey()`: chèn/sửa 1 key scalar top-level, giữ body + nested `metadata`, idempotent.
- `recall.ts`: cột `valid_from`/`valid_to` đọc từ frontmatter (SCHEMA 2→3 → full reindex 1 lần backfill). Retrieval MẶC ĐỊNH lọc `valid_to IS NULL` (search/runFts/runTri/hybrid hydrate/recent/related). Opt `includeInvalid` + GET `/recall?includeInvalid=1` để truy lịch sử.
- `consolidate.ts`: op **SUPERSEDE** — 2 fact mâu thuẫn → giữ fact mới hơn (mtime), đánh dấu fact cũ `valid_to=now` (KHÔNG xoá, giữ pointer MEMORY.md). GUARD: fact cũ trust cao hơn (chủ nhân ×2) → NOOP. `applyPlan` trả `invalidated[]`, gated `LUCY_CONSOLIDATE_APPLY=1`.
- Smoke `smoke:bitemporal` 17/17, tsc=0, regression xanh. Live: coordinator reindex 324 note 0 lỗi, 0 fact bị invalidate (chưa đụng thật). KHÔNG restart lucy-bridge.

Nối tiếp [[lucy-memory-phase3-consolidation]]. Chờ chủ nhân xem diff rồi bật APPLY. Xem [[lucy-longterm-memory-buildout]].
