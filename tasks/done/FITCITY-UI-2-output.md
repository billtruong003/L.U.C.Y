# FITCITY-UI-2 — Admin TỰ GIẢI THÍCH cho người không-code — HOÀN THÀNH

**Ngày:** 2026-06-20
**Project:** `/root/lucy-workspace/fitcity-web` · Preview pm2 `fitcity-preview` (:8793, `astro dev` live source)
**Trạng thái:** ✅ XONG — `npm run build` pass, verify trên preview, 5 commit RIÊNG (KHÔNG push)

## Mục tiêu
Người KHÔNG-code mở admin là hiểu ngay sửa gì/ở đâu — bỏ thuật ngữ kỹ thuật ("Alt"), mỗi field/ảnh hiện rõ "là gì + hiện ở đâu trên web" + link "Xem trên web ↗".

## Đã làm

### UI2.1 — Bỏ jargon "Alt" → tiếng Việt dễ hiểu + KHÔNG bắt buộc
- `src/lib/media.ts`: thêm `altFromFilename(filename)` — alt để trống thì tự suy từ tên tệp (vd `cau-giay-hero.webp` → "Cau giay hero"), không ép người dùng.
- `src/pages/admin/api/upload.ts` + `src/pages/admin/media.astro`: `alt = giá trị nhập (trim) || altFromFilename(file.name)` → bỏ trống vẫn lưu được.
- `media.astro` form upload: label "Mô tả ảnh (alt)" → **"Mô tả ảnh ngắn (giúp Google & người khiếm thị hiểu — không bắt buộc)"**, placeholder ví dụ cụ thể, hint "để trống cũng được — hệ thống tự lấy theo tên tệp".
- **Verify:** `grep -c "Mô tả ảnh (alt)"` trên trang render = **0** (hết chữ "alt" trơ).

### UI2.2 — Mỗi nhóm field hiện "hiện ở đâu" + link "Xem trên web ↗"
- Thêm class `.a-where` (hộp xanh đầu card) + `.a-hint` (dòng 💡) vào `Admin.astro`.
- Dùng helper `href()` (base-aware) + `target="_blank" rel="noopener"`:
  - `branches.astro` → `/chi-nhanh/<slug>` (slug đang sửa; chưa có → `/chi-nhanh`). Hint: "Ảnh + thông tin này hiện ở trang chi tiết cơ sở."
  - `programs.astro` → `/chuong-trinh/<slug>`. Hint: "Hiện ở thẻ chương trình (trang chủ) + trang chi tiết."
  - `posts.astro` → `/blog/<slug>`. Hint: "Ảnh hero + nội dung hiện ở trang bài viết (chỉ khi đã Đăng)."
  - `settings.astro` → `/` + hint TỪNG field ("Hiện ở chân trang + nút gọi", v.v.).
  - `media.astro` logo → `/`. Hint: "Logo hiện ở đầu trang (menu) & chân trang."

### UI2.3 — MediaPicker nói rõ đang chọn ảnh CHO CHỖ NÀO
- `MediaPicker.vue`: thêm prop `label` → tiêu đề modal **"Chọn ảnh cho: \<label\>"**.
- Wire: "Ảnh đại diện cơ sở", "Ảnh đại diện chương trình", "Ảnh hero bài viết", "Logo nền sáng (đầu trang)", "Logo trắng (chân trang)".

### UI2.4 — Admin index: card "Hướng dẫn nhanh"
- `index.astro`: card liệt kê "muốn đổi X → vào mục Y": logo→Ảnh, màu→Màu, cơ sở→Cơ sở, chương trình→Chương trình, blog→Cẩm nang, hotline/email/slogan/FB→Cấu hình.

### UI2.5 — Build + verify
- `npm run build` ✅ 0 error (chạy qua từng phase).
- Đăng nhập HMAC cookie (password đọc từ `.dev.vars`, KHÔNG echo) → curl trang admin render thật:
  - branches/programs/posts: hộp "hiện ở đâu" + "Xem trên web ↗" ✓
  - settings: hint từng field ✓
  - media: label alt mới ✓ + "Mô tả ảnh (alt)" = 0 ✓ + logo where ✓
  - index: "Hướng dẫn nhanh" ✓
  - MediaPicker bundle island chứa prop `"label"` + chuỗi "Chọn ảnh cho" ✓

## Commit (local, KHÔNG push)
```
81c44bb docs(UI2.5): cập nhật TASK3-PROGRESS — FITCITY-UI-2 admin tự giải thích XONG
d92e90d feat(admin UI2.4): trang Tổng quan thêm card 'Hướng dẫn nhanh — đổi gì vào đâu'
a8c4abc feat(admin UI2.2): mỗi nhóm field hiện rõ 'hiện ở đâu' + link Xem trên web ↗
b42b0cc feat(admin UI2.3): MediaPicker header nói rõ đang chọn ảnh CHO CHỖ NÀO
74a7666 feat(admin UI2.1): bỏ jargon 'Alt' → 'Mô tả ảnh ngắn (không bắt buộc)' + tự suy từ tên file
```

## Acceptance — đối chiếu
- UI2.1: không còn chữ "Alt" trơ ✓ · có giải thích ✓ · bỏ trống vẫn lưu (fallback altFromFilename) ✓
- UI2.2: mỗi mục có 1 dòng "hiện ở đâu" + link Xem trên web trỏ đúng trang ✓
- UI2.3: mở picker thấy "Chọn ảnh cho: \<label\>" ✓
- UI2.4: admin index có card hướng dẫn ✓
- UI2.5: build pass + verify ✓

## Ghi chú
- KHÔNG push (Bill push tay). Preview `astro dev` đã restart, phục vụ source mới live.
- MediaPicker `label` chỉ hiện khi mở modal (Vue island client-side) → verify qua bundle string thay vì SSR HTML.
