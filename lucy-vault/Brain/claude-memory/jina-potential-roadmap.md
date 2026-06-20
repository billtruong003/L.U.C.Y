# Jina — kho tiềm năng để khai thác (roadmap)

> Ghi 2026-06-15 theo yêu cầu Bill. **CẬP NHẬT (Bill 2026-06-15): khai thác Jina sâu làm CÙNG ĐỢT/SONG SONG với "đại tu UI full"** (không phải sau) — vì #2 omni đa phương thức (index mockup/screenshot/tech-art → search bằng chữ) bổ trợ thẳng cho thiết kế lại UI. Điều kiện: SAU khi runner 6 nhóm (UI+M2+M3) xong + KHÔNG bị hold token. Chi tiết đợt này ở `docs/MORNING-HANDOFF.md`.

## Hiện trạng (đang dùng)
- Model: `jina-embeddings-v5-omni-nano`, dim **768**, đa ngữ 108 thứ tiếng, omni (đa phương thức) — qua env `JINA_EMBED_MODEL`/`JINA_EMBED_DIM`.
- Chỉ dùng cho **trí nhớ ngữ nghĩa dạng TEXT**: task `retrieval.passage` (lưu note vault + turn episodic) và `retrieval.query` (câu hỏi). Recall lai FTS5 + vector (sqlite-vec) + RRF.
- CHƯA nối: ảnh/audio/file, reader/search API, classifier.
- ✅ **Reranker NỐI RỒI (2026-06-15, X1):** `jinaRerank` (embed.ts) + `maybeRerank` sau RRF (recall.ts), flag `LUCY_RERANK` mặc định TẮT, lỗi→giữ RRF. Bật live: `LUCY_RERANK=1` ở `.env.llm`. Model qua `JINA_RERANK_MODEL` (mặc định `jina-reranker-v2-base-multilingual`).
- ✅ comment "dim 1024" trong embed.ts ĐÃ dọn về 768/EMBED_DIM (X1).

## Tiềm năng chưa khai (xếp theo giá trị cho Lucy)
1. ✅ **Reranker (jina-reranker)** — ĐÃ LÀM (X1, flag LUCY_RERANK). Cross-encoder xếp lại recall sau RRF.
2. **Đa phương thức (omni) thật** — index ảnh/screenshot/mockup vào chung không gian vector → search ảnh bằng text. **Trực tiếp phục vụ đại tu UI**: lưu mockup "galaxy sphere", screenshot Cockpit, ảnh tech-art của Bill rồi tìm bằng câu chữ.
3. **Reader API (r.jina.ai) + Search (s.jina.ai)** — URL→markdown sạch cho LLM; thay/bổ sung web-tools.ts trong lane-agentic & deep-research. Giảm nhiễu khi đọc web.
4. **Classifier API (zero-shot)** — phân loại/route persona không cần train; bổ trợ auto-route tag+vector (persona-chat) và BH-D routing.
5. **Matryoshka dimensions** — cắt chiều 768→512→256 ít mất chất → tiết kiệm RAM/đĩa trên **VPS 1.9GB** (ràng buộc cứng). Tuning quan trọng khi vault phình.
6. **Late chunking / Segmenter** — chunk văn bản dài giữ ngữ cảnh toàn cục → embed note dài/transcript chuẩn hơn (giờ embed cả note 1 vector).
7. **ColBERT / multi-vector (late interaction)** — truy hồi chính xác cao cho câu hỏi khó; nặng hơn, cân nhắc sau.
8. **Task-specific adapters** — retrieval / text-matching / separation / classification, chọn đúng task cho từng pipeline.

## Việc nhỏ dọn ngay (không cần chờ)
- ✅ Sửa comment "dim 1024" → 768 trong embed.ts (xong X1).
