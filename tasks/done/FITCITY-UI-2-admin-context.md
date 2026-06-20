---
id: FITCITY-UI-2
title: Admin tự-giải-thích — bỏ jargon "alt", mỗi field/ảnh hiện rõ "là gì + ở đâu trên web" + link Xem trên web
priority: 1
tier: claude
model: opus
status: queued
---

# FITCITY-UI-2 — Admin TRỰC QUAN & TỰ GIẢI THÍCH cho người không-code

**Project dir:** `/root/lucy-workspace/fitcity-web`. Test LOCAL preview pm2 `fitcity-preview` (:8793). `npm run build` pass. Commit local, KHÔNG push.

## Vấn đề (chủ nhân — tiếp nối FITCITY-UI-1)
Admin đã có MediaPicker trực quan, NHƯNG:
1. Còn ô **"Alt"** (jargon) — người không-code "biết alt thế nào mà chọn?".
2. Sửa text/ảnh nhưng **KHÔNG biết nó đổi CHỖ NÀO trên web** → người ta không hình dung được. Phải SHOW rõ "field này là gì + hiện ở đâu".

## Việc cần làm (commit riêng từng cái)

### UI2.1 — Bỏ jargon "Alt" → tiếng Việt dễ hiểu + KHÔNG bắt buộc
- Mọi nơi có "Alt" (upload form `media.astro`, MediaPicker.vue, addMedia): đổi label → **"Mô tả ảnh ngắn (giúp Google & người khiếm thị hiểu — không bắt buộc)"**. Placeholder ví dụ cụ thể.
- Alt để trống → tự suy ra từ tên file / tên cơ sở (đừng ép người dùng).
- **Acceptance:** không còn chữ "Alt" trơ; có giải thích; bỏ trống vẫn lưu được.

### UI2.2 — Mỗi field/section hiện rõ "LÀ GÌ + Ở ĐÂU" + link "Xem trên web ↗"
- Mỗi nhóm field trong admin thêm dòng hint nhỏ (icon 💡) mô tả **chỗ nó hiện trên trang công khai**, + link **"Xem trên web ↗"** (target=_blank) trỏ ĐÚNG trang/section:
  - `branches.astro` ảnh hero + thông tin cơ sở → link `/chi-nhanh/<slug>` (dùng slug đang sửa). Hint: "Ảnh + thông tin này hiện ở trang cơ sở."
  - `programs.astro` ảnh + nội dung → link `/chuong-trinh/<slug>`. Hint: "Hiện ở thẻ chương trình + trang chi tiết."
  - `settings.astro` hero/footer/hotline/email/FB → link `/`. Hint chỉ rõ "Hiện ở đầu trang / chân trang".
  - `media.astro` logo → link `/` (logo ở nav + footer). 
  - `posts.astro` ảnh hero blog → link `/blog/<slug>`.
- Dùng `href()` helper (base-aware) cho link. Mở tab mới.
- **Acceptance:** mỗi mục sửa được → có 1 dòng "hiện ở đâu" + link Xem trên web chạy đúng trang.

### UI2.3 — MediaPicker: header modal nói rõ đang chọn ảnh CHO CHỖ NÀO
- MediaPicker.vue thêm prop `label` (vd "Ảnh hero cơ sở", "Logo nền sáng") → hiện ở tiêu đề modal: "Chọn ảnh cho: <label>". Để người dùng biết ảnh này dùng vào việc gì.
- Wire `label` ở các form khi gọi MediaPicker.
- **Acceptance:** mở picker thấy tiêu đề rõ ràng ảnh dùng cho chỗ nào.

### UI2.4 — Trang Tổng quan (admin index): thêm hướng dẫn ngắn "sửa gì ở đâu"
- `admin/index.astro`: thêm 1 card "Hướng dẫn nhanh" liệt kê: muốn đổi X → vào mục Y (vd "Đổi logo → mục Ảnh", "Đổi màu → mục Màu", "Sửa cơ sở → mục Cơ sở"). Ngắn gọn, thân thiện.
- **Acceptance:** trang chủ admin có hướng dẫn rõ.

### UI2.5 — Build + verify
- `npm run build` pass. Cập nhật TASK3-PROGRESS.md.

## Ghi chú
- Mục tiêu: người KHÔNG-code mở admin là HIỂU NGAY sửa gì/ở đâu, không cần ai chỉ. KHÔNG để lộ thuật ngữ kỹ thuật. KHÔNG push. Vướng → NEEDS_HUMAN.


---

## Kết quả (claude)

Xong rồi chủ nhân ạ 🎀 FITCITY-UI-2 — admin tự-giải-thích cho người không-code đã hoàn thành, verify thật trên preview.

✅ *Kết quả chính:*
- *Bỏ jargon "Alt"* → "Mô tả ảnh ngắn (không bắt buộc)" + tự suy từ tên file khi để trống (`altFromFilename`).
- *Mỗi nhóm field hiện rõ "hiện ở đâu" + nút "Xem trên web ↗"* (branches→/chi-nhanh/slug, programs→/chuong-trinh/slug, posts→/blog/slug, settings+logo

📄 File output: `/root/lucy/tasks/done/FITCITY-UI-2-output.md`
