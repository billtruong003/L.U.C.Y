---
name: lucy-image-intake-gap
description: Bridge ĐÃ nhận ảnh (B4, 2026-06-16 — getFile→Read native, code-only); Hub server vẫn CHƯA upload ảnh; Jina đa phương thức chưa khai
metadata: 
  node_type: memory
  type: project
  originSessionId: 0ded98c3-60c8-4e72-a49d-0ebcaeafa57e
---

**Gap phát hiện 2026-06-15 — BRIDGE ĐÃ FIX 2026-06-16 (B4):**
- ✅ `bridge/lucy_bridge.py`: `tg_download(file_id)` (getFile→tải về WORKDIR qua proxy) + `extract_image(msg)` (photo lấy `photo[-1]` size lớn nhất; document `image/*`). `handle()` phát hiện ảnh trước `if not text`, bake `[…Dùng Read tool mở: <path>]` vào prompt + ÉP claude-path (lane free không xem ảnh). Dùng Claude đọc ảnh NATIVE qua Read tool (WORKDIR=cwd), KHÔNG dựng content-block base64. Code-only, active khi Bill restart lucy-bridge.
- ⏳ Hub server vẫn CHƯA có upload ảnh (chỉ bridge xong).
- Tuỳ chọn tương lai: Jina embed ảnh để recall trực quan (chưa làm).

**Trạng thái Jina (2026-06-15):** đang dùng = embedding text recall (jina-embeddings-v5-omni-nano 768, matryoshka) + RERANKER (jina-reranker-v2-multilingual, flag) + Reader (r/s.jina.ai). CHƯA khai = đa phương thức ẢNH (v5-omni vốn đa phương thức nhưng chỉ feed text), classifier, late-chunking, ColBERT. Xem [[jina-potential-roadmap]] — khai sâu để SAU đại tu UI.
