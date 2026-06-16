# Phase E — Context & Trí nhớ sâu (overview cho Bill, 2026-06-13)

> Mục tiêu Phase E: **Lucy KHÔNG vỡ khi dùng lâu / phiên dài / nhớ xuyên phiên.** Đây là phần "lõi não" —
> ít hào nhoáng nhưng quyết định Lucy có dùng được bền không. Dưới đây giải thích TỪNG mảnh "nó là gì,
> giải quyết đau gì, làm thế nào", + reframe sau khi đã chuyển sang Agent SDK.

---

## Bức tranh: 2 loại "trí nhớ" của Lucy (đừng lẫn)
1. **Context cửa sổ (working memory)** — đoạn hội thoại + file đang nhồi vào 1 lần gọi Claude. Có GIỚI HẠN (vd 1M token). Phiên dài → TRÀN → Claude quên đầu / lỗi / cắt output. → **E1, E4 lo cái này.**
2. **Trí nhớ vault (long-term)** — Lucy "biết" Bill + dự án xuyên phiên, qua recall FTS5 + dream/preferences. → **E2 lo cái này.**
3. **Đo lường / nhìn thấy** — biết cache tiết kiệm bao nhiêu, context dùng tới đâu. → **E3 lo cái này.**

---

## E1 — Context compressor (chống tràn phiên dài) ⭐
- **Đau:** chat/agent chạy lâu, prompt phình tới sát trần ctx → Claude quên đoạn đầu, hoặc lỗi "context exceeded", mất output + tốn token.
- **Cách (kế hoạch cũ):** khi prompt ≥ 0.5×ctx → giữ ĐẦU (system+goal) + ĐUÔI (gần đây) nguyên, tóm tắt KHÚC GIỮA bằng model rẻ, "latest wins".
- **✅ REFRAME sau Agent SDK:** Claude CLI (engine mà SDK bọc) **ĐÃ CÓ auto-compaction built-in** — phiên resume dài tự nén khi gần đầy. Hub/bridge/runner giờ đều qua SDK → **hưởng auto-compact MIỄN PHÍ**. → E1 phần lớn XONG nhờ việc clean SDK. Việc còn lại: (a) verify nó hoạt động, (b) tinh chỉnh ngưỡng nếu cần, (c) cho phiên cực dài thì E4.

## E2 — Session lineage + bookends (recall FTS5 thông minh hơn) 🧠 [phần nặng nhất còn lại]
- **Đau:** recall vault hiện tìm theo full-text trần (FTS5) — không biết "phiên này nối tiếp phiên kia", dễ trả mảnh rời rạc / trùng.
- **Cách:** thêm `parent_session_id` (cây phả hệ phiên) + "bookends" (3 dòng đầu + 3 dòng cuối mỗi phiên = tóm tắt nhanh) + cửa sổ ±N quanh hit + dedupe theo lineage.
- **Kết quả:** hỏi lại chuyện cũ → Lucy lôi đúng mạch hội thoại liên quan, không lặp, không lạc.
- File: `agent-machine/src/recall.ts` (FTS5 đã có sẵn lớp trần).

## E3 — Đo prompt-cache thật + cho NHÌN THẤY 📊 (phần "dễ hình dung")
- **Đau:** không biết cache có ăn không, $/lượt giảm bao nhiêu, context đang dùng tới đâu.
- **Cách:** log `cache_read_input_tokens` / `input_tokens` từ ResultMessage (SDK đã trả sẵn `usage` + `model_usage`) → hiện lên Hub (badge "cache 80% · ctx 12k/1M" mỗi lượt chat).
- **Kết quả:** Bill NHÌN được não Lucy đang tiết kiệm + còn bao nhiêu chỗ → đúng "kiểm tra tổng quan cho dễ hình dung".

## E4 — Trajectory compressor (nén phiên CỰC dài) — ưu tiên thấp
- Cho phiên agent chạy hàng giờ/nhiều chục turn: nén cả quỹ đạo (không chỉ context) thành mốc. Chỉ làm khi E1/auto-compact chưa đủ. Thường KHÔNG cần ngay.

---

## REFRAME tổng (nhờ đã clean sang SDK)
- **E1**: phần lớn ✅ free (CLI auto-compaction). Chỉ verify + tinh chỉnh.
- **E2**: việc thật còn lại, đáng làm — recall mạch lạc hơn.
- **E3**: rẻ + cho Bill thấy được não → làm sớm cho "dễ hình dung".
- **E4**: hoãn.

→ **Thứ tự đề xuất:** E3 (visible, rẻ — thấy ngay) → E1 verify (xác nhận auto-compact) → E2 (lineage, nặng) → E4 (nếu cần).
