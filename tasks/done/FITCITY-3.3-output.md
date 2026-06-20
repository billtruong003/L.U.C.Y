# FITCITY-3.3 — R2 media layer + gallery — OUTPUT

**Status:** ✅ DONE — commit local (KHÔNG push), build PASS, verify LOCAL bằng `wrangler --local` (R2/D1 miniflare) OK.
**Project:** `/root/lucy-workspace/fitcity-web` · branch `main` · commit `d23ed6b`
**Ngày:** 2026-06-20

## Mục tiêu
Dựng LỚP ẢNH cho FitCity Cloudflare CMS: ảnh sống trong **R2 (không repo)**, phục vụ qua route `/media/<key>`, có bảng `media` (D1) làm index gallery + component Gallery/MediaPicker, nối `image_key`/`logo_key` vào content. KHÔNG migrate toàn bộ ảnh (để T3.6 provision) — chỉ build cơ chế + seed vài ảnh test.

## Đã làm (5 sub-task, commit local)

### T3.3a — Media data layer (`src/lib/db.ts`)
- Type `Media` khớp cột bảng `media` (key/filename/alt/width/height/bytes/grp/uploaded_at).
- Hàm: `listMedia(db, group?)`, `getMedia(db, key)`, `addMedia(db, {key,filename,alt,width,height,bytes,group})` (UPSERT idempotent `ON CONFLICT(key)`), `deleteMedia(db, key)` (chỉ xoá index row; object R2 do admin T3.5 lo).

### T3.3b — Route serve ảnh R2 (`src/pages/media/[...key].ts`)
- `prerender = false`, đọc `locals.runtime.env.MEDIA.get(key)` → trả ảnh + `Content-Type` (metadata R2 hoặc đoán theo đuôi) + `cache-control: public, max-age=31536000, immutable` + etag. 404 nếu không có, 500 nếu thiếu binding.
- **Gotcha quan trọng:** dùng `obj.arrayBuffer()` thay vì stream `obj.body` — stream R2 KHÔNG serialize qua `platformProxy` của `astro dev` → lỗi DevalueError "Cannot stringify arbitrary non-POJOs". Buffer chạy đúng cả dev local lẫn CF Worker thật (ảnh nhỏ nên OK).
- Helper `src/lib/media.ts`: `mediaUrl(key)`, `contentTypeFor(ext)`, `imageKeyUrl(image_key)`.

### T3.3c — Component Gallery + MediaPicker (`src/components/Gallery.astro`)
- Props `db`, `group?` (lọc nhóm), `picker?`, `name?`, `selected?`. Grid thumbnail từ `listMedia()`, ảnh qua `mediaUrl()`.
- `picker=true` = MediaPicker (tái dùng admin T3.5): click ảnh → cập nhật `<input hidden name>` + bắn `CustomEvent('media:pick', {detail:{key,alt}})`.
- Trang demo `src/pages/gallery-demo.astro` (noindex, loại khỏi sitemap).

### T3.3d — Nối ảnh vào content
- **Convention:** `image_key` = R2 object key (vd `branches/cau-giay-hero.webp`, KHÔNG prefix `images/`).
- Seed cũ T3.2 lỡ nhét path slot tĩnh `images/branches/<slug>-hero.webp` → `imageKeyUrl()` chỉ trả `/media/<key>` khi key là R2 key thật; legacy `images/...` → undefined → page fallback `slotImg()` (file tĩnh public/, KHÔNG vỡ, KHÔNG bịa). **Zero regression.**
- `chi-nhanh/[slug]` + `chuong-trinh/[program]`: hero = `imageKeyUrl(image_key) ?? slotImg(...)`.
- Logo CMS: `settings.logo_key`/`logo_dark_key` → `Base` (prop) → `Nav`/`Footer` (`mediaUrl`, giữ fallback F-badge). `index.astro` đọc settings + truyền xuống (mẫu luồng).

### T3.3e — Seed media local
- `scripts/seed-media-local.mjs` (DEV ONLY): put 5 ảnh test vào R2 local + media rows + settings logo + set image_key demo (cau-giay/gymkid/pilateskid). Idempotent. KHÔNG migrate toàn bộ.

## Bằng chứng verify (astro dev :4321, platformProxy, R2/D1 local)
```
/media/logo/logo.webp        → HTTP 200  image/webp  10606 bytes (đúng file)  + cache + etag
/media/programs/gymkid.webp  → HTTP 200  image/webp  36438 bytes
/media/nope.webp             → HTTP 404
/gallery-demo                → HTTP 200  render 5 ảnh /media + picker
/chi-nhanh/cau-giay          → hero src="/media/branches/cau-giay-hero.webp"  (R2)
/chuong-trinh/gymkid         → src="/media/programs/gymkid.webp"             (R2)
/                            → Nav /media/logo/logo.webp + Footer /media/logo/logo-dark.webp (logo từ settings R2)
/chi-nhanh/hoang-cau         → hero static /images/... , 0 ảnh /media (legacy, KHÔNG regression)
npm run build                → PASS (zero TypeScript errors)
```
File ảnh tải về kiểm bằng `file`: `RIFF ... Web/P image` — đúng ảnh thật, không phải HTML lỗi.

## Files
- Sửa: `src/lib/db.ts`, `src/components/Nav.astro`, `src/components/Footer.astro`, `src/layouts/Base.astro`, `src/pages/index.astro`, `src/pages/chi-nhanh/[slug].astro`, `src/pages/chuong-trinh/[program].astro`, `astro.config.mjs`, `TASK3-PROGRESS.md`
- Mới: `src/lib/media.ts`, `src/pages/media/[...key].ts`, `src/components/Gallery.astro`, `src/pages/gallery-demo.astro`, `scripts/seed-media-local.mjs`

## Lưu ý cho T3.4 / T3.6
- **T3.4 (blog):** dùng `mediaUrl(hero_key)` cho ảnh hero + Gallery/MediaPicker đã sẵn.
- **T3.6 (provision):** migrate TOÀN BỘ `public/images/**` → R2 + set lại `image_key`/`logo_key` đúng R2 key (thay giá trị legacy `images/...` mà T3.2 seed để lại).
- KHÔNG vướng R2 binding local (test `wrangler --local` qua hết) → không cần NEEDS_HUMAN.
