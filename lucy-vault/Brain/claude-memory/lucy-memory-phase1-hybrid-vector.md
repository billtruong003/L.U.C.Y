---
name: lucy-memory-phase1-hybrid-vector
description: Phase 1 recall hybrid FTS5+vector (sqlite-vec + Jina v5-omni-nano dim 768) live; flag LUCY_VECTOR; embedIndex incremental
metadata: 
  node_type: memory
  type: project
  originSessionId: 69894811-7cb2-4d60-a95e-fd5f4cfaaed4
---

Phase 1 long-term memory ĐÃ LIVE (2026-06-14): recall lai FTS5 + vector.

- `embed.ts`: client Jina `jina-embeddings-v5-omni-nano` dim 768 (UPDATED 2026-06-19 — đã migrate từ v3/1024; model+dim đổi qua env JINA_EMBED_MODEL/JINA_EMBED_DIM, matryoshka cắt 768→512/384), key `JINA_API_KEY` đọc từ `.env.llm` (KHÔNG hardcode). Flag `LUCY_VECTOR` mặc định ON khi có key, `=0/false/off` → tắt.
- `recall.ts`: bảng `vec_note USING vec0(embedding float[EMBED_DIM])` = 768 (sqlite-vec, rowid=note.id bind **BigInt** — vec0 bắt buộc int). Cột `embed_checksum` cache; `embedIndex({max})` embed incremental (note NULL/đổi, batch 32). Text embed = title + observations + body ("fact-key expansion"). `hybridSearch` = RRF fusion k=60 của FTS5⊕vector cosine. Jina lỗi runtime → `vectorOn=false` phiên đó, về FTS5 thuần, KHÔNG chặn chat.
- `coordinator.ts` GET+POST `/recall` tự dùng hybrid khi vectorReady (embedIndex cap 24/turn giữ vector tươi). Bridge+Hub gọi qua HTTP nên hưởng vector mà không cần sửa.
- Bulk-embed: `npm run recall -- --embed` (đã embed 321 note vault thật). Smoke `npm run smoke:vector` (embedder giả, không mạng).

Kế tiếp: Phase 2 (episodic turns). Phase 3-4 (consolidation DELETE/UPDATE + forgetting = XOÁ memory) CHỜ chủ nhân duyệt. Xem [[lucy-longterm-memory-buildout]] + [[lucy-memory-phase0-recall-prefetch]].
