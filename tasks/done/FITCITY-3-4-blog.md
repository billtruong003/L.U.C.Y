---
id: FITCITY-3.4
title: TASK3 Blog — posts trong D1 + trang list/detail SSR + render markdown
priority: 2
tier: claude
model: opus
status: queued
---

# FITCITY-3.4 — Blog (bài viết sống trong D1)

**Project dir:** `/root/lucy-workspace/fitcity-web`. ĐỌC `TASK3-PROGRESS.md`. Test LOCAL `wrangler --local`. Commit local, KHÔNG push.

## Bối cảnh
- T3.1-3.3 xong: SSR+D1, content từ D1, R2 media + `/media/[key]` + gallery. Bảng `posts` đã tạo (T3.1).
- Site cũ có blog content-collection (8 bài md trong `src/content/blog/`). GIỮ làm nguồn seed (provision T3.6 đổ vào D1). Task này dựng blog đọc D1.

## Việc (tuần tự, commit riêng)
### T3.4a — posts data layer (db.ts)
- `listPosts({status})`, `getPost(slug)`, `createPost`, `updatePost`, `deletePost`. Cột: slug,title,excerpt,body_md,hero_key,status(draft|published),published_at,updated_at.
- **Acceptance:** export đủ hàm, type khớp.

### T3.4b — Trang blog SSR
- `/blog` (index): list bài `status=published`, mới nhất trước, thumbnail = `mediaUrl(hero_key)`, excerpt. prerender=false.
- `/blog/[slug]`: đọc `getPost(slug)`, render `body_md` → HTML (dùng lib md, vd `marked`; thêm dep nếu cần). hero ảnh. 404 nếu không có / draft.
- **Acceptance:** seed vài post local → `/blog` hiện bài published, ẩn draft; `/blog/<slug>` render markdown đúng (heading/list/link).

### T3.4c — Seed blog local từ md cũ + PROGRESS
- Script đọc `src/content/blog/*.md` (frontmatter + body) → INSERT posts (status=published) vào D1 local. Idempotent.
- Cập nhật `TASK3-PROGRESS.md`: blog xong, còn admin (T3.5) + provision (T3.6).
- **Acceptance:** seed → `SELECT count(*) FROM posts` ≥ 8; `/blog` render đủ.

## Ghi chú: KHÔNG xoá content/blog cũ (nguồn seed). KHÔNG push. Vướng → NEEDS_HUMAN + chi tiết.


---

## Kết quả (claude)

Xong task FITCITY-3.4. ✅

Em đã chuyển blog FitCity từ content-collection (prerender) sang **đọc D1 SSR**, verify thật bằng wrangler --local + astro dev:

• **T3.4a** — thêm vào `db.ts`: type `Post` + `listPosts/getPost/createPost/updatePost/deletePost` (UPSERT, auto-stamp published_at, trả bool theo meta.changes).
• **T3.4b** — `/blog` (list published, mới nhất trước) + `/blog/[slug]` (thay `[...

📄 File output: `/root/lucy/tasks/done/FITCITY-3.4-output.md`
