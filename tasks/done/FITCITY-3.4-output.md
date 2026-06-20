# FITCITY-3.4 — Blog (bài viết sống trong D1) · DONE 2026-06-20

**Project:** `/root/lucy-workspace/fitcity-web` · Test LOCAL (`wrangler --local` + astro dev platformProxy) · commit local, **KHÔNG push**.

Blog cũ prerender từ content-collection `src/content/blog/*.md` → chuyển sang **đọc bảng `posts` (D1) SSR**. Md cũ GIỮ NGUYÊN làm nguồn seed (cho T3.6 provision).

## T3.4a — Posts data layer (`src/lib/db.ts`)
- Type `Post` khớp cột bảng posts: `id/slug/title/excerpt/body_md/hero_key/status/published_at/updated_at`.
- `listPosts(db, {status?})` — không status = tất cả (admin T3.5); `{status:'published'}` cho /blog. Sắp `(published_at IS NULL), published_at DESC, updated_at DESC` (mới nhất trước, draft xuống cuối).
- `getPost(db, slug)` → Post | null.
- `createPost(db, {...})` — UPSERT `ON CONFLICT(slug)`, auto-stamp `published_at=datetime('now')` khi publish mà chưa set.
- `updatePost(db, slug, patch)` — partial update, trả `bool` theo `meta.changes`; auto-stamp published_at khi chuyển sang published.
- `deletePost(db, slug)` — trả `bool`.
- **Acceptance ✓**: export đủ 5 hàm, type khớp cột, `npm run build` zero TS error.

## T3.4b — Trang blog SSR
- `src/lib/markdown.ts`: `renderMarkdown(body_md)` qua **`marked@^14`** (dep mới, gfm, sync) → HTML string cho `set:html`.
- `src/pages/blog/index.astro`: `prerender=false`, `listPosts({status:'published'})`, bài mới nhất nổi bật + grid; thumbnail `mediaUrl(hero_key)` (fallback RoundIcon); empty-state khi 0 bài.
- `src/pages/blog/[slug].astro` (THAY `[...slug].astro` cũ — đã `git rm`): `prerender=false`, `getPost(slug)`, **404 nếu không có HOẶC status≠published** (draft không lộ). `body_md`→HTML (`prose-fc`), hero ảnh, Article+Breadcrumb JSON-LD, "đọc tiếp".
- **Acceptance ✓**: seed local → /blog hiện published, ẩn draft; /blog/<slug> render markdown đúng (heading/list/link).

## T3.4c — Seed blog local + PROGRESS
- `scripts/seed-blog-local.mjs`: đọc `src/content/blog/*.md` (gray-matter frontmatter+body) → UPSERT `posts` (idempotent `ON CONFLICT(slug)`). slug=filename, title=fm.title, excerpt=fm.description, body_md=body, status=published (trừ fm.draft), published_at=fm.pubDate.
- Cập nhật `TASK3-PROGRESS.md` mục "T3.4 DONE" — blog xong, còn admin (T3.5) + provision (T3.6).
- **Acceptance ✓**: seed → `SELECT count(*) FROM posts` = 8 ; /blog render đủ.

## Verify thật (bằng chứng)
```
node scripts/seed-blog-local.mjs           → 8 bài → posts
SELECT count(*) FROM posts                 → 8 (all status=published)
GET /blog                                  → 200, hiện 8 bài published
  grep "BÀI NHÁP TEST" (draft chèn test)   → 0  (ẩn draft ✓)
GET /blog/gu-lung-o-tre                     → 200, <h2> + <ul> + 11×<li> + 12×<strong>
GET /blog/chinh-tu-the-cho-tre              → <a href="/chuong-trinh/chinh-tu-the">Chỉnh tư thế</a> (link ✓)
GET /blog/z-draft-test  (draft)             → 404 ✓
GET /blog/khong-co-bai-nay (unknown)        → 404 ✓
npm run build                               → PASS, zero TS error
```
Draft test row đã xoá sau verify (posts về 8). Dev server đã tắt (curl :4321 = 000).

## Commit (LOCAL, chưa push — 3 commit riêng)
- `9cf698e` feat(T3.4a): posts data layer
- `fa94eb4` feat(T3.4b): trang blog SSR đọc D1 + render markdown (marked)
- `2c4c825` feat(T3.4c): seed blog local từ md cũ + PROGRESS

## Ghi chú
- KHÔNG xoá `src/content/blog/*.md` (nguồn seed) ✓. KHÔNG push ✓.
- Dep mới `marked@^14` đã thêm vào package.json/package-lock.json.
- Còn lại: **T3.5 admin** (CRUD posts qua UI + MediaPicker chọn hero_key) · **T3.6 provision** (đổ md + ảnh hero vào D1/R2 remote).
