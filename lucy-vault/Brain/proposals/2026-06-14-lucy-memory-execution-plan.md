---
title: "Lucy Long-Term Memory — KẾ HOẠCH EXECUTE đầy đủ (Phase 0→4)"
date: 2026-06-14
author: Lucy
status: execution-plan
tags: [memory, execution, roadmap]
parent: 2026-06-14-lucy-memory-architecture.md
---

# Lucy Memory — Lộ trình execute đầy đủ

> Bám theo đề xuất kiến trúc (file cùng thư mục). Mỗi phase: **độc lập ship được + có feature-flag bật/tắt + có rollback**. Tất cả dùng CHUNG 1 file `.index/memory.db` (SQLite) → hợp VPS 1.9GB, không thêm Postgres/Neo4j.

## Quyết định đã chốt (theo ràng buộc VPS 1.9GB RAM)
1. **Phase 0 làm ngay** — free win, 0 hạ tầng.
2. **Embedding (Phase 1) = API, KHÔNG self-host BGE-M3.** VPS 1.9GB không gánh nổi model 568M chạy 24/7. Dùng API đa ngữ (Jina v3 / Voyage-3 / OpenAI 3-large). → *cần chủ nhân chọn nhà cung cấp + nhập API key (secret, chủ nhân tự nhập, em không đụng).*
3. **Episodic (Phase 2) = bật, chỉ owner**, retention mặc định 90 ngày (chỉnh được). → *cần chủ nhân OK retention.*

## Nền tảng kỹ thuật (đã verify trong code)
- `Recall` class (`recall.ts`): `search(q,{limit})` → FTS5 bm25 + relaxed-OR + trigram; `reindex()` incremental theo checksum; graph-walk qua bảng `relation` (wikilink). DB: `.index/memory.db`.
- Coordinator (`coordinator.ts`): http routing `if(method&&url===...)` → thêm endpoint mới dễ.
- Bridge (`lucy_bridge.py`, Python) + Hub (`hub/server`, TS) = đường hội thoại → gọi coordinator qua HTTP.
- Dream cron 2h sáng (`cron_dream.sh` → `consolidateAllAgentBrainsSafe`) = chỗ cắm nâng cấp consolidation.

---

## PHASE 0 — Đấu recall vào đường hội thoại ⭐ (ROI cao nhất, ~1 buổi, rủi ro thấp) ✅ DONE (2026-06-14)

> ✅ Đã ship: `coordinator.ts` thêm `POST /recall {q,limit?}` (freshIndex incremental + search, cap limit≤8, try/catch trả hits:[] khi lỗi). `lucy_bridge.py` thêm `recall_prefetch()` chèn khối `🧠 Trí nhớ liên quan` vào prompt cả lane + claude path (cap 5 hit/~800 ký tự, timeout 4s → bỏ qua). `hub/server/index.ts` thêm `recallPrefetch()` prepend vào claude-path trước streamClaude. Flag `LUCY_RECALL_PREFETCH` (mặc định on). tsc agent-machine+hub/server = 0, py-compile bridge OK. Smoke live `POST /recall` trả 5 hit đúng shape, edge empty-q → hits:[]. Coordinator+hub restart (KHÔNG đụng lucy-bridge — code bridge sẵn, áp khi chủ nhân restart bridge sau).


**Mục tiêu:** trước mỗi turn (Telegram + Hub), tự tra memory → chèn top-K mẩu liên quan vào prompt.

**Việc:**
1. `coordinator.ts`: thêm `POST /recall {q, limit?}` → `reindex()` (incremental, rẻ) rồi `search(q,{limit:K})` → trả `[{title, snippet, file_path, rank}]`. Bọc try/catch, cap limit ≤ 8.
2. `lucy_bridge.py`: trước khi gửi turn cho claude → POST `/recall` với text tin nhắn → format khối `🧠 Trí nhớ liên quan:\n- ...` chèn vào đầu prompt (hoặc system append). Cap ~5 hit / ~800 token. Lỗi/timeout → bỏ qua, chat vẫn chạy.
3. `hub/server/index.ts`: prefetch tương tự trong chat handler (claude-path) trước `streamClaude`.
4. Feature-flag `LUCY_RECALL_PREFETCH` (mặc định on, tắt được).

**Verify:** `curl /recall` trả hit; hỏi câu xuyên phiên ("ngưỡng RSI BTC mình chốt?") → trả đúng + log thấy khối memory chèn. Test cả Telegram lẫn Hub.
**Rollback:** set flag=0 (chèn là additive, không phá luồng cũ).
**Done khi:** cả 2 đường hội thoại tra được memory cũ, có flag, không tăng RAM đáng kể.

---

## PHASE 1 — Hybrid FTS5 + vector (sqlite-vec + embedding API) (~1–2 ngày, rủi ro trung bình) ✅ DONE (2026-06-14)

> ✅ Đã ship: `embed.ts` (client Jina `jina-embeddings-v3` dim 1024, key đọc từ `.env.llm` JINA_API_KEY — không hardcode/echo; embedder injectable cho smoke; flag `LUCY_VECTOR` mặc định ON khi có key, `=0` → tắt). `recall.ts`: nạp `sqlite-vec` (`vec_note USING vec0(embedding float[1024])`, rowid=note.id bind BigInt), cột `embed_checksum` cache theo checksum; `embedIndex({max})` embed incremental (chỉ note NULL/đổi, batch 32, cap được → không block turn), text embed = title + observations(fact-key expansion) + body; `vectorSearch` KNN cosine; `hybridSearch` RRF fusion (k=60) FTS5⊕vector, hit thuần-vector hydrate snippet từ body. Jina lỗi runtime → `vectorOn=false` phiên đó + warn, KHÔNG chặn chat (về FTS5 thuần). `coordinator.ts` GET+POST `/recall`: vectorReady → embedIndex(max 24) + hybridSearch, off → search() cũ. `recall-cli.ts` thêm `--embed` + embed sau `reindex`. Smoke `smoke-vector.ts` (embedder giả, không mạng) PASS 8/8: embed cả 2 note, incremental 0, **vector bắt note tiếng Anh mà FTS5 trượt**, re-embed khi đổi, flag off → hybrid==FTS5. tsc agent-machine=0, smoke:memory không regression, Jina live OK (2×1024). Bulk-embed vault thật = 321 note, 0 pending. lucy-coordinator restart (KHÔNG đụng lucy-bridge). Verify live: POST/GET /recall trả hybrid hit; query EN "who is the owner game developer" → kéo đúng `owner-bill-truong-profile` (cross-lingual); empty-q → hits:[]; log 0 lỗi vector.

**Mục tiêu:** lấy lại ~10pp recall@5, bắt câu "ý giống chữ khác".

**Việc:**
1. Nạp extension **sqlite-vec** vào `memory.db` (better-sqlite3 loadExtension) → bảng `vec_note USING vec0(embedding float[1024])`.
2. `embed.ts`: gọi embedding API (batch), cache theo checksum (chỉ embed note mới/đổi → rẻ). Key qua env (chủ nhân nhập).
3. `recall.ts search()`: chạy thêm vector cosine → **RRF fusion** với kết quả FTS5 (giữ relaxed/trigram làm fallback).
4. **Fact-key expansion:** đem fact `distill` đã trích đi index thêm (research: +9.4% recall).
5. Flag `LUCY_VECTOR` (off → thuần FTS5 như cũ).

**Verify:** bộ test ~10 câu Việt-Anh chéo, so hit trước/sau. Đo recall.
**Rollback:** flag=0.
**Cần chủ nhân:** chọn provider + nhập API key. (Phương án B nếu không muốn API: bật BGE-M3 **batch lúc 2h sáng** rồi tắt — chậm hơn nhưng 0 chi phí ngoài.)

---

## PHASE 2 — Episodic store (lưu turn hội thoại) (~1–2 ngày, rủi ro trung bình) ✅ DONE (2026-06-14)

> ✅ Đã ship: `recall.ts` thêm bảng `turns(id,ts,source,chat_id,role,content,session_id)` + FTS5 `turns_fts` (rowid=turns.id) trong cùng `memory.db` (additive, KHÔNG đụng note manual). Methods: `recordTurn()` (chuẩn hoá+cắt 8000 ký tự, rỗng→null, lỗi DB→null KHÔNG nổ), `searchTurns()` (FTS strict-AND→relaxed-OR, `sinceDays` window), `pruneTurns(90)` (retention), `episodicStats()`; flag `episodicFlagOn()` (LUCY_EPISODIC mặc định ON — single-user = data chủ nhân, `=0`→tắt). `coordinator.ts`: POST `/episodic` (ghi turn, gated flag, debounce prune 1h + dọn lúc start, retention env `LUCY_EPISODIC_RETENTION_DAYS`=90), GET `/episodic?q` (stats+search verify), và POST `/recall` GỘP top-3 episodic (đánh dấu `type='episodic'`, title `💬 <ai> (ngày)`) sau manual hit. `lucy_bridge.py`: `episodic_log()` fire-and-forget thread ghi turn user+reply cả lane+claude path (CHỈ SỬA FILE — áp khi chủ nhân restart bridge). `hub/server/index.ts`: `episodicLog()` fetch non-blocking ghi user+reply cả 3 path (claude/lane/lane-agentic). Smoke `smoke-episodic.ts` PASS 13/13 (record/search/relaxed-OR/retention-prune/flag-off, không mạng). tsc 3 package = 0, smoke:vector+memory không regression, py-compile bridge OK, hub web build OK. Coordinator+hub restart (KHÔNG đụng lucy-bridge). Verify live: POST /episodic→ok id; GET /episodic?q kéo đúng turn; POST /recall merge hit `💬 Chủ nhân` type=episodic cuối danh sách; empty-q→[]. Đã dọn turn test 'smoke' khỏi DB live.

**Mục tiêu:** cross-session "hôm trước mình bàn gì về X".

**Việc:**
1. `episodic` table trong `memory.db`: `turns(id, ts, source[tg/hub], chat_id, role, content, session_id)` + index FTS (vector thêm sau nếu Phase 1 xong).
2. Bridge + Hub: sau mỗi turn ghi **async/non-blocking** vào store (không chặn hội thoại).
3. `search()` gộp cả episodic vào kết quả recall (đánh dấu nguồn = hội thoại).
4. Retention: cron dọn turn cũ > N ngày (mặc định 90).

**Verify:** "lần trước mình nói gì về Y" → kéo đúng turn cũ.
**Rollback:** flag; episodic là store riêng, tắt không ảnh hưởng manual memory.
**Cần chủ nhân:** OK lưu nội dung chat (chỉ owner) + chọn retention.
**Ghi chú:** ship được FTS-only trước cả khi có embedding key.

---

## PHASE 3 — Nâng consolidation: dream/distill → ADD/UPDATE/DELETE/NOOP + reflection (~2–3 ngày, rủi ro trung bình–cao) ✅ DONE-DRYRUN (2026-06-14)

> ✅ Đã ship (DRY-RUN GATED): `consolidate.ts` — gộp trí nhớ Mem0-style trên `Brain/claude-memory/*.md` (1 file=1 fact). `loadFacts()` đọc fact + trust-weight (type=user/feedback ×2, đọc cả nested `metadata.type`). `planConsolidation()`: embed mọi fact qua **Jina (embed.ts)** → cosine pairwise → cặp sim≥0.86 đưa **decider LLM rẻ (lane free/Haiku, auxComplete)** quyết ADD/UPDATE/DELETE/NOOP kiểu Mem0 (keeper=trust cao, tie→mới hơn); reflection (Generative-Agents): cụm sim≥0.78 + tổng trust≥5 → `reflector` sinh insight tầng cao. **An toàn: mọi lỗi/parse-fail LLM → NOOP (KHÔNG bao giờ xoá nhầm vì model im); embedder/decider/reflector injectable.** `renderPlan()` in diff người đọc. `applyPlan()` GATED `LUCY_CONSOLIDATE_APPLY=1`: snapshot `.snapshots/consolidate-*` TRƯỚC → DELETE (unlink + dọn pointer MEMORY.md) / UPDATE (gộp merged vào keeper, giữ frontmatter). `consolidate-cli.ts` (`npm run consolidate`) mặc định DRY-RUN: in diff + ghi report `Brain/proposals/consolidate-<date>.md`, KHÔNG đụng file thật. Cắm vào `dream-cli` fire-safe, GATED `LUCY_CONSOLIDATE=1` (cron khỏi tự đốt token) + LUÔN dry-run trừ khi APPLY=1. Smoke `smoke-consolidate.ts` PASS 16/16 (embedder+decider giả, không mạng): trust ×2, cặp gần-trùng→DELETE keeper đúng, fact khác→NOOP, DRY-RUN không đụng file, APPLY xoá+dọn-pointer+snapshot, parseDecision robust. tsc agent-machine=0. **Verify live: dry-run trên vault thật = 21 fact embed Jina OK, 0 cặp gần-trùng (trí nhớ đang gọn), report ghi đúng, KHÔNG đụng file.** Chờ chủ nhân xem diff rồi bật `LUCY_CONSOLIDATE_APPLY=1` để áp thật.
>
> ➕ BẢO MẬT (secret-redaction) — đã ship cùng vòng: `redact.ts` `scrubSecrets()` (TS) giấu jina_*/sk-*/ghp_*/Bearer/`*_API_KEY=`/AKIA/xoxb/base64-dài>40 → `[REDACTED]`, KHÔNG đụng văn xuôi/git-sha/giá-số. Áp ở: `embed.ts` (passage+query TRƯỚC khi gửi Jina), `recall.recordTurn` (backstop), bridge `lucy_bridge.py scrub_secrets()` (episodic_log) + hub `index.ts scrubSecrets()` (episodicLog). Smoke `smoke-redact.ts` PASS 16/16 + py mirror PASS. **Verify live: POST /episodic với `jina_…` → lưu thành `[REDACTED]` đúng** (đã dọn turn test khỏi DB live). Coordinator+hub restart (KHÔNG đụng lucy-bridge — code bridge sẵn, áp khi chủ nhân restart bridge).

**Mục tiêu:** chống phình/trùng, bắt đầu xử mâu thuẫn. Chạy lúc rảnh (sleep-time, model rẻ).

**Việc:**
1. Mở rộng `distill`: mỗi fact mới → so vector-similarity với memory cũ → quyết **ADD / UPDATE / DELETE / NOOP** (kiểu Mem0), model rẻ (Nemotron/Haiku).
2. **Reflection** (Generative-Agents): tổng importance > ngưỡng → sinh insight tầng cao.
3. Tận dụng trust-weight (Bill ×2) sẵn có.
4. **Dry-run mặc định + log diff + snapshot backup trước khi ghi** → duyệt rồi mới bật ghi thật.

**Verify:** chạy dream test → thấy dedup/merge đúng, diff dry-run không xoá nhầm.
**Rollback:** dream đã có snapshot backup; bật dry-run trước.
**Rủi ro chính:** logic DELETE/UPDATE sai → bắt buộc qua cổng dry-run.

---

## PHASE 4 — Forgetting / bi-temporal invalidation (~2–3 ngày, rủi ro cao nhất → làm CUỐI) ✅ DONE-DRYRUN (2026-06-14)

> ✅ Đã ship (GATED, an toàn): bi-temporal Zep-style trên fact `Brain/claude-memory/*.md` (file = SỰ THẬT). `vault.ts` thêm `upsertFrontmatterKey()` (chèn/sửa 1 key scalar top-level, GIỮ body + key khác + nested `metadata`, idempotent). `recall.ts`: cột `valid_from`/`valid_to` đọc từ frontmatter lúc upsert (SCHEMA bump 2→3 → full reindex 1 LẦN cho DB cũ tự backfill); **retrieval MẶC ĐỊNH lọc `valid_to IS NULL`** ở `search`/`runFts`/`runTri`/`hybridSearch`(hydrate hit thuần-vector)/`recent`/`related` — fact hết hiệu lực KHÔNG trồi lên; opt `includeInvalid` (+ GET `/recall?includeInvalid=1`) để truy LỊCH SỬ. `consolidate.ts`: op mới **SUPERSEDE** — 2 fact MÂU THUẪN (không phải trùng) → GIỮ fact MỚI HƠN (mtime), đánh dấu fact CŨ `valid_to=now` vào frontmatter (KHÔNG xoá file, GIỮ pointer MEMORY.md → lịch sử). **GUARD: fact cũ trust CAO hơn (lời chủ nhân ×2) → KHÔNG tự vô hiệu → NOOP** (chủ nhân tự quyết). `applyPlan` trả thêm `invalidated[]`; vẫn snapshot + GATED `LUCY_CONSOLIDATE_APPLY=1` (DRY-RUN chỉ in diff). Smoke `smoke-bitemporal.ts` PASS 17/17 (không mạng): upsert frontmatter, recall lọc/khôi-phục valid_to, recent lọc, SUPERSEDE giữ-mới-vô-hiệu-cũ, DRY-RUN không đụng file, APPLY ghi valid_to + giữ file + giữ pointer, GUARD trust. tsc agent-machine=0; regression smoke vector/memory/redact/episodic/consolidate xanh. **Verify live: lucy-coordinator restart → SCHEMA 3 full reindex 324 note 0 lỗi, cột valid_to live (0 invalidated — chưa đụng fact thật); POST /recall lọc mặc định OK, GET /recall?includeInvalid=1 OK** (KHÔNG đụng lucy-bridge). Chờ chủ nhân xem diff consolidate rồi bật `LUCY_CONSOLIDATE_APPLY=1` để invalidation áp thật.

**Mục tiêu:** xử failure-mode #1 toàn ngành (64% lỗi do memory cũ không bị vô hiệu).

**Việc:**
1. Mỗi fact thêm `valid_from` / `valid_to`. Fact mới mâu thuẫn → **đánh dấu cũ `valid_to`=now (KHÔNG xoá)** kiểu Zep.
2. Retrieval mặc định chỉ lấy fact còn hiệu lực (`valid_to IS NULL`); lịch sử vẫn truy được khi cần.
3. Consolidation (Phase 3) là nơi set invalidation.

**Verify:** khai 1 fact → khai fact mâu thuẫn → recall trả cái mới, cái cũ marked invalid (vẫn còn trong history).
**Rollback:** invalidate = reversible (chỉ đổi cờ, không mất data).

---

## Thứ tự & cách chạy
- **Tuần tự 0 → 1 → 2 → 3 → 4.** Mỗi phase ship + flag riêng.
- Phase 2 (episodic FTS-only) có thể chen trước Phase 1 nếu API key chưa sẵn.
- Tổng công thô ~8–12 ngày (em + Claude làm, chủ nhân duyệt từng phase).
- **KHÔNG làm (có chủ đích):** Neo4j/graph nặng, pgvector/Postgres, Mem0/Zep SaaS (thua cho single-user).

## Cách EXECUTE (đề xuất)
- **Phase 0: em làm tay NGAY** (đụng `lucy_bridge.py` = đường chat này → em test kỹ, báo trước khi restart bridge).
- **Phase 1–4:** chạy qua auto-build opus (group mode) từng phase, mỗi phase 1 vòng + verify + rehost, em gác cổng dry-run/flag. Hoặc em làm tay nếu chủ nhân muốn kiểm soát chặt.

## 2 thứ chặn cần chủ nhân chốt
1. **Embedding provider + API key** (cho Phase 1) — hoặc chọn phương án batch-2h-sáng để khỏi key.
2. **OK lưu hội thoại + retention** (cho Phase 2).
→ Hai cái này KHÔNG chặn Phase 0. Có thể bắt đầu Phase 0 ngay hôm nay.
