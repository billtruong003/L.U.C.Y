# FITCITY-UI-1 — MediaPicker trực quan (chọn ảnh bằng thumbnail, KHÔNG dùng R2 key) ✅ DONE

**Project:** `/root/lucy-workspace/fitcity-web` (Astro SSR + Cloudflare + Vue island)
**Test:** preview pm2 `fitcity-preview` (astro dev :8793). `npm run build` pass. Commit local, KHÔNG push.
**Ngày:** 2026-06-20

## Vấn đề đã fix triệt để
Admin cũ bắt người dùng **nhập/dán "R2 key"** (vd `branches/cau-giay-hero.webp`) hoặc bung `<details>` gallery **copy key dán vào ô**. Người không-code (anh Quân) chịu chết.
→ Thay bằng **MediaPicker TRỰC QUAN, end-to-end**: click thumbnail là chọn, upload ngay trong picker, KHÔNG bao giờ thấy key/đường dẫn.

## Đã làm

### UI1.1 — API JSON cho picker
- **`src/pages/admin/api/media.ts`** (GET, prerender=false): trả `[{key,url:'/media/'+key,group,filename,alt}]` từ `listMedia(env.DB, group?)`. Query `?group=branches` lọc nhóm. Tự được auth qua middleware `/admin/*`.
- **`src/pages/admin/api/upload.ts`** (POST formData `file`+`group`): safeKey (slugify giữ đuôi, đồng bộ media.astro) → `env.MEDIA.put(key, arrayBuffer, {httpMetadata:{contentType}})` → `addMedia(...)` → trả `{key,url,filename,alt,group}`. Lỗi → JSON `{error}` + status.

### UI1.2 — `src/components/MediaPicker.vue` (Vue island, scoped style theme tối)
- Props: `name` (field form), `group`, `value` (key hiện tại).
- 1 `<input type="hidden" :name="name" :value="current">` → form submit key (backend GIỮ NGUYÊN image_key/hero_key/logo_key).
- Có value → **thumbnail ảnh hiện tại** + "Đổi ảnh" + "Xoá chọn"; chưa → khung "Chưa có ảnh" + nút "Chọn ảnh".
- **MODAL** 2 tab:
  - **Thư viện**: fetch `/admin/api/media?group=<group>` → grid thumbnail vuông, hover viền cam. Click 1 ảnh = chọn (set current + đóng modal). Ảnh đang chọn viền cam + ring nổi bật.
  - **Tải ảnh mới**: input file (accept image/*) + preview → "Tải lên & chọn" → POST `/admin/api/upload` → ảnh mới vào grid + **tự chọn** + đóng.
  - Đóng: X / Esc / click nền.
- KHÔNG hiển thị key/đường dẫn ở đâu (key chỉ trong hidden input). Nút chính màu brand cam `#ec6b25` (không lime chói).

### UI1.3 — Wire vào MỌI form (bỏ ô "R2 key" + `<details>` copy-key + script `media:pick`)
- `branches.astro`: Ảnh hero → `<MediaPicker client:load name="image_key" group="branches" value={...} />`.
- `programs.astro`: Ảnh chương trình → group="programs".
- `posts.astro`: Ảnh hero blog → `name="hero_key"` group="blog".
- `media.astro`: 2 ô logo (`logo_key`, `logo_dark_key`) → group="logo"; bỏ field "Key tuỳ chỉnh" + R2 key wording; library grid hiện filename thay vì key.

### UI1.4 — Polish (`Admin.astro`)
- Nút chính/tab active/focus/link/brand-span: lime `#c3d500` → brand cam `#ec6b25` (chữ trắng).
- Label tiếng Việt rõ: "Ảnh đại diện (hero)", "Ảnh đại diện chương trình", "Ảnh hero (đại diện bài viết)", "Logo (nền sáng)", "Logo trắng (footer)". Bỏ sạch "R2 key".

### UI1.5 — Build + verify
- `npm run build` → ✅ 0 error, 30+ trang; MediaPicker chunk `5.18 kB` (gzip 2.44 kB).

## Bằng chứng verify (preview :8793, đã login lấy cookie)
```
GET /admin/api/media (all)          → JSON list OK
GET /admin/api/media?group=branches → count=84 ảnh
GET /admin/api/media (no cookie)    → 302 (auth guard hoạt động)
/media/images/branches/...webp      → 200 image/webp (ảnh servable)
POST /admin/api/upload (pixel test) → {"key":"general/test-pixel.png","url":"/media/general/test-pixel.png"}
  → servable 200 image/png → có trong list general → đã xoá dọn (end-to-end PASS)
4 form (branches/programs/posts/media): grep -ci "R2 key" = 0
astro-island + hidden input render đúng; media page có đủ 2 logo MediaPicker
```

## File thay đổi
- Mới: `src/pages/admin/api/media.ts`, `src/pages/admin/api/upload.ts`, `src/components/MediaPicker.vue`
- Sửa: `src/pages/admin/branches.astro`, `programs.astro`, `posts.astro`, `media.astro`, `src/layouts/Admin.astro`, `TASK3-PROGRESS.md`

## Ghi chú
- Commit LOCAL, KHÔNG push (theo guard FitCity autobuild). Chủ nhân push tay khi duyệt.
- Backend image_key/hero_key/logo_key GIỮ NGUYÊN — chỉ thay đường vào (UI) bằng picker; dữ liệu seed cũ prefix `images/...` vẫn chọn + serve bình thường qua /media.
