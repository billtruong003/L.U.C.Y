---
id: FITCITY-UI-1
title: Admin UX — MediaPicker trực quan (chọn ảnh bằng thumbnail, KHÔNG dùng R2 key) + upload inline + wire mọi form
priority: 1
tier: claude
model: opus
status: queued
---

# FITCITY-UI-1 — Làm lại UX chọn ảnh admin cho TRỰC QUAN, END-TO-END

**Project dir:** `/root/lucy-workspace/fitcity-web` (Astro SSR + Cloudflare + Vue island). Test LOCAL bằng preview pm2 `fitcity-preview` (astro dev :8793, HMR) — `npm run build` phải pass. Commit local, KHÔNG push.

## Vấn đề (chủ nhân phàn nàn — phải fix triệt để)
Hiện admin bắt người dùng **nhập/dán "R2 key"** (vd `branches/cau-giay-hero.webp`) hoặc bung `<details>` gallery rồi **copy key dán vào ô** để chọn ảnh. Người KHÔNG-code (anh Quân) chịu chết. "Upload rồi để đường dẫn là sao?" → phải làm **TRỰC QUAN, end-to-end**: click thumbnail là chọn, upload ngay trong picker, KHÔNG bao giờ thấy key/đường dẫn.

## Plumbing đã soi (dùng, đừng dò lại)
- `src/lib/db.ts`: có `listMedia(db, group?)`, `getMedia`, `addMedia`, `deleteMedia`. Bảng media: cột key, filename, alt, width, height, bytes, grp, uploaded_at.
- `src/lib/admin.ts`: `adminEnv(locals)` → `{ DB, MEDIA(R2), ADMIN_PASSWORD, ADMIN_SECRET }`; `slugify(s)`.
- `src/middleware.ts`: bảo vệ MỌI `/admin/*` bằng cookie (kể cả `/admin/api/*`) → API mới tự được auth.
- Ảnh phục vụ tại `/media/<key>` (route `src/pages/media/[...key].ts` đọc R2).
- Vue island chạy (`*.vue` + `client:load`/`client:visible`; đã có BranchCarousel.vue, RiveCanvas.vue). Adapter cloudflare + @astrojs/vue OK.
- Upload form cũ ở `src/pages/admin/media.astro` (R2.put + addMedia) — tham khảo cách put R2 + safeKey.

## Việc cần làm (tuần tự, commit riêng)

### UI1.1 — API JSON cho picker
- `src/pages/admin/api/media.ts` (`export const prerender=false; export const GET`): trả JSON `[{key,url:'/media/'+key,group,filename,alt}]` từ `listMedia(env.DB, group?)`. Query `?group=branches` lọc nhóm.
- `src/pages/admin/api/upload.ts` (`POST`): nhận `file` + `group` (formData) → tạo key an toàn (slugify, giữ đuôi) → `env.MEDIA.put(key, await file.arrayBuffer(), {httpMetadata:{contentType:file.type}})` → `addMedia(...)` → trả JSON `{key, url:'/media/'+key}`. Lỗi → JSON {error}.
- **Acceptance:** GET `/admin/api/media` (đã login) trả JSON list; POST upload 1 ảnh trả {key,url}, ảnh servable ở /media/<key>.

### UI1.2 — Component `src/components/MediaPicker.vue` (TRỰC QUAN)
- Props: `name` (tên field form), `group` (branches/programs/logo/blog/home), `value` (key hiện tại, optional).
- Render: 
  - Nếu có value → **thumbnail ảnh hiện tại** (`/media/<value>`) + nút "Đổi ảnh" + nút "Xoá chọn".
  - Nếu chưa → khung "Chưa có ảnh" + nút **"Chọn ảnh"** (to, rõ).
  - 1 `<input type="hidden" :name="name" :value="current">` để form submit key (backend GIỮ NGUYÊN, chỉ value đến từ picker).
- Bấm "Chọn/Đổi ảnh" → **MODAL**:
  - Tab/nút "Thư viện": fetch `/admin/api/media?group=<group>` → **grid thumbnail** (ảnh vuông, hover). **Click 1 ảnh = chọn** (set current, đóng modal). Ảnh đang chọn có viền nổi bật.
  - Tab/nút "Tải ảnh mới": input file (accept image/*) + preview → bấm Tải → POST `/admin/api/upload` (group=prop) → ảnh mới vào grid + **tự chọn luôn**.
  - Nút đóng modal (X / Esc / click nền).
- KHÔNG hiển thị key/đường dẫn cho người dùng ở đâu cả (key chỉ nằm trong hidden input).
- Style hợp admin tối hiện có (dùng biến/màu admin; nút chính màu brand, KHÔNG dùng lime chói cũ).
- **Acceptance:** mở picker → thấy grid ảnh thật → click 1 ảnh → thumbnail hiện ở field → submit form lưu đúng key (kiểm D1). Upload ảnh mới trong modal → xuất hiện + chọn được.

### UI1.3 — Wire MediaPicker vào MỌI form ảnh (bỏ ô "R2 key" + `<details>` copy-key)
- `src/pages/admin/branches.astro`: field "Ảnh hero" → `<MediaPicker client:load name="image_key" group="branches" value={...} />`. Bỏ input key + details gallery cũ.
- `src/pages/admin/programs.astro`: ảnh chương trình → MediaPicker group="programs".
- `src/pages/admin/media.astro`: 2 ô logo (logo_key, logo_dark_key) → MediaPicker group="logo" (bỏ "R2 key" + copy-key). Giữ phần upload thư viện chung nếu cần, nhưng logo chọn qua picker.
- `src/pages/admin/posts.astro`: ảnh hero blog → MediaPicker group="blog".
- **Acceptance:** 4 form trên KHÔNG còn ô nhập "R2 key" / nút "copy key"; chọn ảnh = click thumbnail; lưu phản ánh đúng trang công khai.

### UI1.4 — Polish nhẹ admin (cho đỡ thô)
- Nút chính lime/vàng chói cũ → màu brand (cam #EC6B25 hoặc forest) cho nhất quán + bớt gắt.
- Field ảnh có label rõ ràng tiếng Việt ("Ảnh đại diện", "Logo"), bỏ chữ "R2 key".
- **Acceptance:** build pass; nhìn gọn gàng, không còn thuật ngữ kỹ thuật (key/R2) lộ ra cho người dùng.

### UI1.5 — Build + verify
- `npm run build` 30+ trang 0 error. `npx tsc --noEmit` nếu có (bỏ qua nếu cấu hình không có).
- Cập nhật `TASK3-PROGRESS.md`: đã làm MediaPicker + API.

## Ghi chú
- Đây là UX-critical: ưu tiên TRỰC QUAN cho người không-code. KHÔNG để lộ key/đường dẫn. KHÔNG push. Vướng → NEEDS_HUMAN + chi tiết.


---

## Kết quả (claude)

Xong rồi chủ nhân ✅ FITCITY-UI-1 hoàn tất, verify end-to-end thật trên preview.

Tóm tắt:
• Làm lại UX chọn ảnh admin trực quan — bỏ sạch ô "R2 key" + nút copy-key. Giờ click thumbnail là chọn, upload ngay trong picker, người không-code (anh Quân) dùng được.
• Mới: `MediaPicker.vue` (modal 2 tab Thư viện/Tải mới, hidden input giữ key cho backend) + 2 API `/admin/api/media` (GET list) & `/admin/api

📄 File output: `/root/lucy/tasks/done/FITCITY-UI-1-output.md`
