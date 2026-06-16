# Lucy — TEST GUIDE: Trí nhớ dài hạn (Phase 0-1-2 LIVE · 2026-06-14)

> Test cả trên *Telegram* lẫn *Hub chat*. Dấu hiệu memory chạy: đầu câu trả lời (hoặc trong context) xuất hiện khối **🧠 Trí nhớ liên quan**. Mỗi test: CÁCH LÀM · VÍ DỤ GÕ · KẾT QUẢ MONG ĐỢI.

---

## TEST 1 — Recall prefetch (nhớ XUYÊN PHIÊN) ⭐

- **Là gì:** trước mỗi câu, Lucy tự tra vault → chèn mẩu liên quan vào context. Hết cảnh "phiên mới là quên sạch".
- **Cách:** mở *phiên MỚI* (Telegram gõ `/new`, hoặc Hub tạo chat mới) → hỏi thứ đã lưu ở vault/phiên cũ.
- **Ví dụ gõ:**
  - `ngưỡng RSI cảnh báo BTC mình set bao nhiêu ấy nhỉ?`
  - `ai là chủ nhân của em, làm nghề gì?`
- **Mong đợi:** trả lời ĐÚNG (RSI<30 hoặc >70, cooldown 12h · game dev/technical artist) dù phiên mới tinh. Thấy khối 🧠 hiện mẩu liên quan.
- ✅ PASS: nhớ đúng xuyên phiên, không hỏi lại từ đầu.

## TEST 2 — Vector semantic (Ý GIỐNG CHỮ KHÁC + đa ngữ) ⭐

- **Là gì:** tìm theo NGHĨA, không cần trùng từ khoá (Jina v5 đa ngữ).
- **Cách:** hỏi bằng từ ngữ KHÁC hẳn cái đã lưu, hoặc hỏi tiếng Anh về note tiếng Việt.
- **Ví dụ gõ:**
  - `em có biết anh code game bằng công cụ gì không?` (note ghi "Unity/VR/shader" — không có chữ "công cụ")
  - (tiếng Anh) `who is the game developer you work for?`
- **Mong đợi:** vẫn kéo đúng note hồ sơ chủ nhân dù khác chữ / khác ngôn ngữ.
- ✅ PASS: bắt được cái mà tìm-theo-từ-khoá sẽ trượt.

## TEST 3 — Episodic (nhớ lại HỘI THOẠI cũ) ⭐

- **Là gì:** lưu lại turn chat → sau hỏi "hôm trước mình bàn gì".
- **Cách:** (bước 1) trong phiên này nói 1 điều cụ thể → (bước 2) mở *phiên mới* hỏi lại.
- **Ví dụ:**
  - Bước 1 (giờ): `nhớ giùm: mình chọn jina-embeddings-v5-omni-nano cho embedding nhé`
  - Bước 2 (phiên mới, lát sau): `hôm trước mình chốt dùng model embedding nào?`
- **Mong đợi:** bước 2 nhắc lại "v5-omni-nano" — kéo từ episodic (turn cũ), đánh dấu 💬.
- ✅ PASS: nhớ nội dung đã nói ở phiên khác.
- *Lưu ý:* episodic chỉ lưu của chủ nhân (owner), retention 90 ngày.

## TEST 4 — Secret KHÔNG lọt ra web (redaction) 🔒

- **Là gì:** trước khi embed gửi Jina / ghi episodic, mọi pattern key/token bị scrub `[REDACTED]`.
- **Cách:** gõ thử 1 chuỗi *giả dạng key* rồi kiểm.
- **Ví dụ gõ:** `test key giả: sk-ABC123def456ghi789jkl đừng nhớ cái này`
- **Mong đợi:** chuỗi key KHÔNG được lưu nguyên si / KHÔNG bị gửi tới Jina (thành [REDACTED]). (Phần này thuộc Phase 3-4 đang build — sẽ chạy đủ sau khi rehost đợt tới.)
- ✅ PASS: không thấy key thật nằm trong memory/episodic.

---

## CÔNG TẮC (nếu muốn tắt/bật) — trong `/root/lucy/.env.llm` hoặc env coordinator
- `LUCY_RECALL_PREFETCH=0` → tắt chèn memory vào chat
- `LUCY_VECTOR=0` → tắt vector, về tìm FTS5 thuần
- `LUCY_EPISODIC=0` → ngừng lưu hội thoại
- `JINA_EMBED_MODEL` / `JINA_EMBED_DIM` → đổi model embed (mặc định v5-omni-nano / 768)
- `LUCY_EPISODIC_RETENTION_DAYS=90` → số ngày giữ turn

## ĐANG BUILD (chưa bật apply)
- Phase 3 (gộp/dedup memory) + Phase 4 (forgetting) — *DRY-RUN*, chỉ in diff, KHÔNG xoá thật tới khi chủ nhân duyệt + bật `LUCY_CONSOLIDATE_APPLY=1`.

## Mẹo đọc kết quả
- Nếu KHÔNG thấy khối 🧠 mà đáng lẽ phải nhớ → có thể câu hỏi quá chung; thử cụ thể hơn.
- Recall không chặn chat: lỗi/timeout thì nó im lặng bỏ qua, chat vẫn chạy bình thường.
