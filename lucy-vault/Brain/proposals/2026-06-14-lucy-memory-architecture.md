---
title: "Lucy Long-Term Memory — Đề xuất kiến trúc trí nhớ"
date: 2026-06-14
author: Lucy
status: proposal
tags: [memory, architecture, embeddings, rag, roadmap]
---

# Lucy Long-Term Memory — chúng ta đang ở đâu & nên đi đâu

> Nghiên cứu nền: deep-research harness (5 hướng × fetch 15 nguồn × verify 3 phiếu/claim,
> 100 claim đã kiểm chứng) + recon nội bộ codebase Lucy & Hermes.
> Workflow chết đúng bước synthesize cuối → bản này Lucy tự gộp tay từ 100 claim đã verify.

---

## TL;DR (đọc cái này là đủ)

1. **Lỗ hổng lớn nhất không phải thiếu công nghệ — mà là đấu dây.** Lucy *đã có* một hệ trí nhớ
   xịn (SQLite FTS5 + graph-walk + dream/distill synthesis) nằm trong `agent-machine`
   (đường autopilot/sprint). Nhưng **đường Bill nói chuyện hằng ngày — Telegram bridge + Hub —
   KHÔNG dùng hệ đó.** Nó chỉ `claude --resume` + `--add-dir VAULT` rồi đọc file markdown phẳng.
   → Thứ Bill xài mỗi ngày đang chạy bằng trí nhớ **yếu nhất** trong nhà.

2. Research nói thẳng: pattern "nhồi file phẳng + long-context" mà bridge đang dùng **kém hơn ~30%**
   so với hệ memory chuyên dụng trên các task nhiều phiên (multi-session). Đây không phải ý kiến,
   là số đo benchmark.

3. **Thêm embeddings là đáng** — nhưng phải đúng model. FTS5/BM25 đơn thuần (cái Lucy đang có)
   đạt ~86% recall@5; thêm vector lên ~95–96%. Khoảng **~10 điểm recall** đang bỏ trên bàn.

4. Vì Bill nói **tiếng Việt**, model embedding nhỏ English-only (nomic/mxbai) sẽ **toang**
   (cross-lingual ~0.12). Phải dùng **BGE-M3 (568M, đa ngữ)** — giữ 0.94 cross-lingual.

5. Hạ tầng: **sqlite-vec** (1 file .db, zero-config, nằm cạnh FTS5 sẵn có) — KHÔNG cần Postgres,
   KHÔNG cần Neo4j. Graph nặng (Mem0 đã **gỡ bỏ** graph vì chậm 3×, tốn token 2×, recall tệ hơn).

6. **Quên/ghi đè (forgetting) là failure mode số 1** trong cả ngành: 64% lỗi đến từ memory cũ
   không bị vô hiệu hoá. Markdown phẳng của Lucy **không có cơ chế invalidate** → nợ phải trả.

**Thứ tự làm (ROI giảm dần):** (0) đấu dây recall vào bridge — *gần như free* → (1) hybrid
FTS5+vector → (2) episodic store cho hội thoại → (3) nâng dream→consolidation kiểu Mem0 →
(4) bi-temporal forgetting.

---

## 1. Bản đồ: Lucy hiện tại vs Hermes vs State-of-art

### 1a. Lucy đang có gì (thực tế từ code)

| Lớp | Cơ chế | Ở đâu | Đường nào dùng |
|---|---|---|---|
| Manual memory | `MEMORY.md` + `claude-memory/*.md` (markdown phẳng) | `Brain/claude-memory/` | **Bridge + Hub** (qua `--add-dir`) |
| Recall index | SQLite **FTS5** + trigram + **graph-walk wikilink** | `.index/memory.db`, `recall.ts` | chỉ **agent-machine** |
| Synthesis | **dream/distill** → trust-weighted (Bill ×2) → `active.md` | `dream.ts`, `distill.ts` | chỉ **agent-machine** |
| Per-persona | bài học ±win/⚠️miss | `agents/<id>.md` | chỉ **agent-machine** |
| Feedback | 👍/👎 routing outcomes (JSONL) | `routing-outcomes.jsonl` | coordinator |
| Session | map `chat_id→session_id` (JSON, không index) | `~/.lucy-bridge-sessions.json` | bridge |

**Điểm chí mạng:** cột phải. Hệ recall + dream/distill — phần "trí nhớ thật" — **chỉ chạy ở
agent-machine**. Bridge (Telegram) và Hub chỉ resume session + đọc markdown. Không vector,
không recall query, không invalidation.

### 1b. Hermes (đã nghỉ hưu) từng có gì hơn

Hermes — tiền nhiệm, code còn trong `references/hermes-agent/` — thực ra có **đường trí nhớ hội
thoại** nhỉnh hơn bridge hiện tại:

- `state.db` SQLite + **FTS5**: lưu **toàn bộ turn hội thoại**, search được cross-session,
  có chuỗi `parent_session_id` để nén ngữ cảnh.
- **Hierarchical continuity**: tóm tắt nhiều tầng (turn → group → summary).
- **async `sync_turn()`** (daemon thread): ghi memory không chặn vòng hội thoại.
- **Provider pluggable**: Honcho / Mem0 / OpenViking… cắm 1 dòng config.

→ Bài học: cái bridge Lucy **đánh đổi** lúc bỏ Hermes (2026-06-04) — đổi sự đơn giản + hết
token-burn lấy việc **mất episodic store + cross-session recall** cho đường hội thoại. Đúng cho
thời điểm đó (Hermes đốt ~190M token/ngày), nhưng giờ là lúc lấy lại phần hay mà không rước lại
phần dở.

### 1c. State-of-art (2024–2026) nói gì — bằng chứng có nguồn

- **Long-context KHÔNG thay được memory.** Model 200k token vẫn thua hệ memory chuyên dụng ở task
  cần truy hồi chọn lọc; chat assistant thương mại tụt **~30%** độ chính xác qua nhiều phiên.
  *(arXiv 2603.07670; mem0.ai/blog/state-of-ai-agent-memory-2026)*
- **Vector vs lexical (số cụ thể, LongMemEval-S, cùng model all-MiniLM-L6-v2):**
  BM25-only 86.2% R@5 · pure-vector 96.6% R@5 · **hybrid BM25+vector 95.2% R@5 / 98.6% R@10**.
  → Lexical mạnh ở chiều sâu (R@10), vector mạnh ở top (R@5); **hybrid ăn cả hai.**
  *(github.com/MemPalace discussions/747; clawsetup.co.uk hybrid-local-memory)*
- **Graph thường KHÔNG đáng cho single-user:** Mem0 **gỡ bỏ** graph layer (v3 OSS, 4/2026) vì
  bản graph **thua** single-hop & multi-hop, **chậm 3×, tốn token 2×**. Zep/Graphiti graph thắng
  về *temporal* nhưng nặng. *(particula.tech; memo.d.foundation/breakdown/mem0)*
- **Forgetting = failure mode thống trị:** 64% lỗi (16/25) do memory cũ không được quên; metric
  FAMA cắt điểm Claude Sonnet 4.5 **−36.2 điểm**. Zep xử bằng **bi-temporal** (đánh dấu edge
  invalid thay vì xoá). *(arXiv 2604.20006 "From Recall to Forgetting")*
- **Consolidation/reflection là load-bearing:** bỏ reflection trong Generative Agents → hành vi
  thoái hoá sau 48h mô phỏng. Cơ chế: điểm = **recency (decay 0.995) + importance (1–10) +
  relevance (cosine)**; reflection kích khi tổng importance > 150. *(Park et al. 2023)*
- **Sleep-time compute (Letta):** agent nền lúc rảnh biến "raw context" → "learned context";
  tách tool sửa memory khỏi agent hội thoại để **không làm chậm đường tương tác.**
  *(letta.com/blog/sleep-time-compute)* → **Đây chính là cái dream/distill của Lucy.** Lucy đã
  đi đúng hướng triết lý, chỉ là chưa nối vào đường hội thoại.
- **Embedding model nhỏ:** <335M (nomic 137M, mxbai 335M) English-only, cross-lingual ~0.12,
  rớt 0.40 ở doc dài. **BGE-M3 (568M, đa ngữ):** 0.973 overall, **0.940 cross-lingual.**
  *(zc277584121.github.io embedding-models-benchmark-2026; baseten.co)*
- **sqlite-vec vs pgvector:** single-user/local-first → **sqlite-vec** (1 file .db, zero-config,
  cạnh FTS5 sẵn). pgvector chỉ thắng khi nhiều writer đồng thời / cần SQL phức tạp / đã có Postgres
  — Lucy không dính cái nào. *(llbbl.blog pgvector-vs-sqlitevec; turso.tech)*
- **Fact-augmented key expansion:** index thêm fact do LLM trích → **+9.4% recall@k, +5.4%
  accuracy.** Lucy đã trích fact (distill) — chỉ cần đem đi index. *(LongMemEval, arXiv 2410.10813)*

**Tổng kết vị thế:** Triết lý consolidation của Lucy (dream/distill, trust-weight) **ngang hoặc
nhỉnh** state-of-art. Nhưng (a) đường hội thoại không xài nó, (b) chưa có embeddings → mất ~10pp
recall, (c) chưa có episodic store, (d) chưa có forgetting. Không phải "gần peak" — đang đứng ở
chân một nấc thang rõ ràng.

---

## 2. Kiến trúc đề xuất

Giữ nguyên thứ đang tốt (FTS5, graph-walk, dream/distill, trust-weight, vault = single source).
Bổ sung 4 mảnh, theo mô hình 3 loại trí nhớ của CoALA/Mem0:

```
                        ┌─────────────────────────────────────────┐
   Telegram / Hub  ──►  │  PREFETCH (mới): query recall trước mỗi   │
   (đường hội thoại)    │  turn → chèn top-K vào prompt             │
                        └───────────────┬─────────────────────────┘
                                        ▼
   ┌────────────────────────── HYBRID RETRIEVAL (mới) ──────────────────────────┐
   │  FTS5/BM25 (có sẵn)  +  sqlite-vec cosine (mới, BGE-M3)  →  RRF fusion       │
   │  +  graph-walk wikilink (có sẵn)  +  fact-key expansion (từ distill)        │
   └───────────────┬───────────────────┬───────────────────┬────────────────────┘
                   ▼                   ▼                   ▼
        EPISODIC (mới)        SEMANTIC (nâng cấp)    PROCEDURAL (có sẵn)
   turn hội thoại verbatim    fact đã distill        agents/<id>.md
   → SQLite, index FTS+vec     + bi-temporal valid     bài học per-persona
                   │            (forgetting, mới)
                   ▼
        CONSOLIDATION nền (nâng dream/distill):
        ADD / UPDATE / DELETE / NOOP kiểu Mem0  +  reflection kiểu Generative-Agents
        (chạy lúc rảnh = sleep-time compute, model rẻ)
```

**Vì sao hình này, không phải Neo4j/Mem0-as-a-service:**
- Tận dụng SQLite sẵn (`.index/memory.db`) — sqlite-vec chỉ là 1 extension, cùng file.
- Không rước graph nặng (bằng chứng: thua cho single-user).
- dream/distill = sẵn cơ chế consolidation; chỉ nâng logic, không viết lại.
- Hybrid + multilingual embedding = đúng cái benchmark bảo thắng, hợp ngữ cảnh Việt-Anh của Bill.

---

## 3. Lộ trình (ưu tiên theo ROI, kèm ước lượng công)

> Ước lượng = công kỹ thuật thô, 1 mình em + Claude làm, Bill duyệt. "buổi" ≈ vài giờ tập trung.

### Phase 0 — Đấu dây recall vào đường hội thoại  ⭐ làm trước, ROI cao nhất
**Cái gì:** thêm bước **prefetch** trong `lucy_bridge.py` + Hub: trước mỗi turn, query hệ recall
(FTS5 + graph-walk **đã có sẵn**) bằng nội dung tin nhắn → chèn top-K kết quả vào prompt. Không
hạ tầng mới — chỉ gọi cái agent-machine đã build.
**Vì sao trước:** biến hệ memory xịn (đang ngủ trong agent-machine) thành thứ Bill chạm mỗi ngày.
Đây là phần "gần như free" — closes phần lớn khoảng cách mà chưa tốn 1 dòng embedding nào.
**Rủi ro:** thấp. **Ước lượng:** ~1 buổi (+ tinh chỉnh top-K, ngân sách token chèn).

### Phase 1 — Hybrid FTS5 + vector (sqlite-vec + BGE-M3)
**Cái gì:** cài sqlite-vec vào `.index/memory.db`; chạy BGE-M3 local (hoặc qua 1 endpoint nhẹ);
embed các memory/fact; sửa `recall.ts` để fuse FTS5 + vector bằng **RRF**. Thêm fact-key expansion
từ distill.
**Vì sao:** lấy lại ~10pp recall@5; bắt được câu hỏi "ý giống nhưng chữ khác" mà BM25 trượt.
**Rủi ro:** trung bình (chọn nơi chạy BGE-M3 — 568M cần ~1–2GB RAM; cân nhắc batch/offline).
**Ước lượng:** ~1–2 ngày.

### Phase 2 — Episodic store cho hội thoại
**Cái gì:** lưu turn hội thoại Telegram/Hub vào SQLite (giống `state.db` của Hermes), index cả
FTS + vector. Cross-session recall: "hôm trước mình bàn gì về X".
**Vì sao:** đây là cái bridge đánh mất khi bỏ Hermes; là nền cho mọi câu hỏi "lần trước".
**Rủi ro:** trung bình (chính sách lưu/PII — chỉ owner nên OK; cần retention).
**Ước lượng:** ~1–2 ngày.

### Phase 3 — Nâng consolidation: dream/distill → ADD/UPDATE/DELETE + reflection
**Cái gì:** mở rộng distill thành vòng Mem0-style (mỗi fact mới: ADD/UPDATE/DELETE/NOOP so với
memory cũ qua vector-similarity) + reflection kiểu Generative-Agents (kích theo importance). Chạy
**lúc rảnh** = sleep-time, model rẻ (Nemotron/Haiku) — không đụng độ trễ hội thoại.
**Vì sao:** chống phình, chống trùng, bắt đầu xử mâu thuẫn. Tận dụng trust-weight đã có.
**Rủi ro:** trung bình–cao (logic UPDATE/DELETE sai có thể xoá nhầm — cần dry-run + log + revert).
**Ước lượng:** ~2–3 ngày.

### Phase 4 — Forgetting / bi-temporal invalidation
**Cái gì:** mỗi fact có `valid_from`/`valid_to`; fact mới mâu thuẫn → **đánh dấu cũ invalid, không
xoá** (kiểu Zep). Retrieval mặc định chỉ lấy fact còn hiệu lực.
**Vì sao:** đây là failure mode #1 toàn ngành (64% lỗi). Markdown phẳng hiện không làm được.
**Rủi ro:** cao nhất (đụng đúng chỗ khó nhất ngành) → làm sau khi 0–3 đã chạy ổn.
**Ước lượng:** ~2–3 ngày + theo dõi.

**Không làm (có chủ đích):** Neo4j/knowledge-graph nặng, pgvector/Postgres, Mem0/Zep SaaS. Bằng
chứng cho thấy với single-user chúng tốn nhiều hơn lợi.

---

## 4. Quyết định cần Bill chốt

1. **Bắt đầu từ Phase 0** (đấu dây recall vào Telegram) ngay không? Đây là cú "free win".
2. **Chỗ chạy BGE-M3:** chấp nhận tốn ~1–2GB RAM trên VPS để chạy local, hay muốn em khảo sát
   phương án nhẹ hơn (embedding offline theo batch / model nhỏ hơn cho riêng tiếng Việt)?
3. Có muốn **episodic store** (lưu lại hội thoại) không — vì nó đụng tới lưu trữ nội dung chat của
   Bill (chỉ owner, nhưng cần Bill OK về retention).

---

*Nguồn chính (đã verify): arXiv 2603.07670 · 2604.20006 · 2410.10813 (LongMemEval) · 2504.19413
(Mem0) · 2501.13956 (Zep) · 2309.02427 (CoALA) · Park et al. 2023 (Generative Agents) ·
mem0.ai/blog/state-of-ai-agent-memory-2026 · blog.getzep.com · letta.com/blog/sleep-time-compute ·
llbbl.blog & turso.tech (sqlite-vec) · embedding benchmark 2026. Recon nội bộ: recall.ts, dream.ts,
distill.ts, lucy_bridge.py, hub/server, references/hermes-agent.*
