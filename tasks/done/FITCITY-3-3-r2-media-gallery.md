---
id: FITCITY-3.3
title: TASK3 R2 media — upload/serve ảnh từ R2 + bảng media + component gallery
priority: 1
tier: claude
model: opus
status: queued
---

# FITCITY-3.3 — R2 media layer + gallery (ảnh sống trong R2, không repo)

**Project dir:** `/root/lucy-workspace/fitcity-web`. ĐỌC `TASK3-PROGRESS.md` + design mục 2,3.
**Test LOCAL bằng `wrangler --local` (R2 miniflare), KHÔNG cần token thật.** Commit local, KHÔNG push.

## Bối cảnh (T3.1+T3.2 xong)
- Có: SSR + D1 (settings/branches/programs/posts/media), trang đọc D1, binding `MEDIA`(R2) trong wrangler.jsonc.
- Bảng `media` đã tạo (T3.1). Task này dựng LỚP ẢNH qua R2 + gallery. Migrate ảnh public/images → R2 để ở **T3.6 provision** (không làm ở đây) — task này chỉ build cơ chế + seed vài ảnh test.

## Việc cần làm (tuần tự, commit local riêng)

### T3.3a — Media data layer (db.ts)
- Thêm hàm: `listMedia(group?)`, `getMedia(key)`, `addMedia({key,filename,alt,width,height,bytes,group})`, `deleteMedia(key)` — thao tác bảng `media` (D1).
- **Acceptance:** export đủ hàm, type khớp cột.

### T3.3b — Serve ảnh từ R2: route `/media/[...key]`
- `src/pages/media/[...key].ts` (SSR, prerender=false): đọc `locals.runtime.env.MEDIA.get(key)` → stream về với Content-Type + cache header. 404 nếu không có.
- Helper `mediaUrl(key)` → `/media/<key>` để trang/component dùng.
- **Acceptance:** put 1 object vào R2 local (`wrangler r2 object put fitcity-media/<key> --local --file=...`) → request `/media/<key>` trả đúng ảnh + content-type.

### T3.3c — Component gallery + MediaPicker
- `src/components/Gallery.astro`: liệt kê `listMedia()` → grid thumbnail (dùng mediaUrl). Hỗ trợ lọc theo `group`.
- `MediaPicker` (dùng lại trong admin T3.5): chọn 1 ảnh → trả `key`. Có thể là Gallery + chế độ chọn.
- **Acceptance:** trang demo render gallery từ media rows local; không vỡ layout.

### T3.3d — Nối ảnh vào content
- Trang branches/programs (T3.2) nếu có `image_key` → render `<img src={mediaUrl(image_key)}>` (fallback placeholder nếu thiếu key, KHÔNG bịa).
- Logo: settings `logo_key`/`logo_dark_key` → Nav/Footer dùng mediaUrl (giữ fallback). (Logo hiện ở public/images/brand — sẽ migrate sang R2 ở T3.6; task này chỉ wiring đọc key.)
- **Acceptance:** build pass; trang có image_key render ảnh từ /media/.

### T3.3e — Seed media local + cập nhật PROGRESS
- Script nhỏ seed vài ảnh test vào R2 local + media rows (dev only).
- Cập nhật `TASK3-PROGRESS.md`: cơ chế R2, route /media, gallery, còn gì cho T3.4 (blog).

## Ghi chú
- KHÔNG migrate toàn bộ ảnh ở đây (để T3.6 provision). KHÔNG push. Vướng R2 binding local không qua → NEEDS_HUMAN + chi tiết.


---

## Kết quả (claude)

Xong task FITCITY-3.3. Tóm tắt:

✅ **T3.3 R2 media layer + gallery — DONE**, commit local `d23ed6b` (KHÔNG push), build PASS.

- **Data layer** (db.ts): `listMedia/getMedia/addMedia(upsert)/deleteMedia` + type `Media`.
- **Route serve ảnh** `/media/<key>` đọc R2 binding → stream về kèm content-type + cache + etag, 404 đúng. Gotcha: phải dùng `arrayBuffer()` chứ không `obj.body` vì stream R2 vỡ qua

📄 File output: `/root/lucy/tasks/done/FITCITY-3.3-output.md`
