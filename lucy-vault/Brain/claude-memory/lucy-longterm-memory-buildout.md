---
name: lucy-longterm-memory-buildout
description: "Lucy long-term memory roadmap (Phase 0-4) — đang execute Phase 0-1-2 autonomous, Jina embeddings, Phase 3-4 giữ tay"
metadata: 
  node_type: memory
  type: project
  originSessionId: dfefdf60-3a56-4920-a80e-b4fece057360
---

Xây hệ trí nhớ dài hạn cho Lucy theo đề xuất `lucy-vault/Brain/proposals/2026-06-14-lucy-memory-architecture.md` + execution plan `2026-06-14-lucy-memory-execution-plan.md` (cùng thư mục).

Bối cảnh gốc: hệ recall xịn (SQLite FTS5 + graph-walk + dream/distill) CHỈ chạy trong agent-machine; đường hội thoại hằng ngày (Telegram bridge + Hub) KHÔNG dùng → chỉ `--resume` + đọc markdown phẳng. Phase 0 đấu recall vào đường hội thoại = ROI cao nhất.

5 phase (mỗi cái additive + feature-flag + rollback, chung 1 file `.index/memory.db`):
- P0 prefetch recall→bridge+hub (flag LUCY_RECALL_PREFETCH) · P1 hybrid FTS5+vector (sqlite-vec + Jina, flag LUCY_VECTOR) · P2 episodic store (turns, retention 90d) · P3 consolidation ADD/UPDATE/DELETE+reflection · P4 forgetting bi-temporal.

Quyết định (2026-06-14):
- Embedding = **Jina API, mặc định `jina-embeddings-v5-omni-nano` (dim 768, đa ngữ 108 thứ tiếng + đa phương thức text/ảnh/PDF)**, KHÔNG self-host BGE-M3 (VPS chỉ 1.9GB). Model/dim đọc từ env `JINA_EMBED_MODEL`/`JINA_EMBED_DIM` trong `/root/lucy/.env.llm` (đổi 1 dòng là sang model khác). Key `JINA_API_KEY` cùng file (không echo). Jina free tier 10M token, dùng đa năm cho 1 user. Lý do đa ngữ: English-only embed tra tiếng Việt toang (cross-lingual ~0.12). Ban đầu build v3/1024 rồi swap v5/768 (re-embed 323 note). Có thể fallback Gemini embed (key sẵn) nếu cần.
- KHÔNG dùng Postgres/Neo4j/Mem0-SaaS (thua cho single-user).
- **P3+P4 (xoá/vô-hiệu-hoá memory) GIỮ TAY có Bill duyệt + dry-run** — không cho autonomous (phá hủy được). P0-1-2 chạy auto-build opus (additive, an toàn).

Trạng thái: P0-1-2 đang chạy auto-build (pm2 lucy-autobuild) + memory-rehost-watcher.sh tự rehost (gồm restart bridge) khi xong. Liên quan: [[bill-identities-platforms]] (Bill nói tiếng Việt → cần embed đa ngữ).
