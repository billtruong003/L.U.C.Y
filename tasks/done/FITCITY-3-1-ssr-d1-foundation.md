---
id: FITCITY-3.1
title: TASK3 nền — Astro SSR + @astrojs/cloudflare adapter + D1 schema/migrations + wrangler local
priority: 1
tier: claude
model: sonnet
status: queued
---

# FITCITY-3.1 — Nền Cloudflare SSR + D1 (foundation, làm CHẮC để 6 task sau bám vào)

**Project dir:** `/root/lucy-workspace/fitcity-web` (Astro).
**Design tổng:** ĐỌC `/root/lucy-workspace/fitcity-task3-cloudflare-cms-design.md` TRƯỚC (mục 2,3 = kiến trúc + schema).
**Build:** test LOCAL bằng `wrangler` (D1/R2 giả lập miniflare) — KHÔNG cần Cloudflare token thật ở task này. Commit local, KHÔNG push.

## Bối cảnh quan trọng
- Đây là bước CHUYỂN static → SSR. Site static hiện tại (VPS preview) GIỮ nguyên dist cũ, không sao — task này chỉ đổi source + test local.
- Đừng xoá nội dung tĩnh vội: branches.json/programs.json/blog md GIỮ làm nguồn seed cho provision (T3.6). Task này chỉ DỰNG NỀN đọc-từ-D1, chưa migrate hết trang.

## Việc cần làm (tuần tự, mỗi cái commit local riêng)

### T3.1a — Adapter SSR
- `npm install @astrojs/cloudflare`. Sửa `astro.config.mjs`: `output: 'server'` + `adapter: cloudflare()`.
- Đảm bảo `npm run build` (SSR build) pass. Nếu có trang/route kẹt với SSR → ghi chú, KHÔNG xoá ẩu.
- **Acceptance:** build SSR pass, adapter cloudflare nạp.

### T3.1b — wrangler.jsonc + binding D1/R2
- Tạo `wrangler.jsonc`: bind `DB` (D1) + `MEDIA` (R2 bucket). Dùng placeholder `database_id` + bucket name `fitcity-media` (id thật do provision T3.6 ghi sau).
- `.dev.vars` (gitignore) cho local. Thêm `.dev.vars`, `.wrangler/` vào `.gitignore`.
- **Acceptance:** `wrangler pages dev` (hoặc `wrangler dev`) khởi động local không lỗi binding.

### T3.1c — Schema D1 + migrations (theo design mục 3)
- Thư mục `migrations/` chứa SQL tạo bảng: `settings, branches, programs, posts, media` (đúng cột trong design).
- `wrangler d1 migrations apply <db> --local` chạy được trên D1 local.
- **Acceptance:** migrations apply local 0 lỗi; `wrangler d1 execute --local --command "SELECT name FROM sqlite_master WHERE type='table'"` liệt kê đủ 5 bảng.

### T3.1d — Smoke: 1 trang đọc từ D1 local
- Seed tay vài dòng `settings` + `branches` vào D1 local (script nhỏ hoặc SQL).
- Tạo/ sửa 1 route (vd `/_d1health` hoặc trang chủ phần cơ sở) đọc `Astro.locals.runtime.env.DB` → render dữ liệu D1 (chứng minh SSR↔D1 thông).
- **Acceptance:** chạy local, request trang đó trả HTML có dữ liệu lấy từ D1 (không phải json tĩnh).

### T3.1e — Tài liệu nối tiếp
- Ghi `TASK3-PROGRESS.md` trong fitcity-web: đã dựng gì, lệnh dev local, cột bảng, cái gì T3.2 làm tiếp (migrate trang đọc D1).
- **Acceptance:** file tồn tại, mô tả rõ trạng thái cho task kế.

## Ghi chú
- KHÔNG cần Cloudflare token thật — test toàn bộ bằng `--local` (miniflare). Token để dành T3.7.
- KHÔNG push (guard). Mỗi sub-task 1 commit local.
- Nếu vướng kỹ thuật không qua nổi → dòng cuối báo NEEDS_HUMAN + chi tiết, ĐỪNG hack ẩu phá site.


---

## Kết quả (claude)

---

**FITCITY-3.1 DONE.** Tóm tắt kết quả:

- **T3.1a** — `@astrojs/cloudflare@11.2.0` installed, `astro.config.mjs` đổi sang `output: 'server'`, `prerender=true` cho 4 static routes, build SSR pass
- **T3.1b** — `wrangler.jsonc` bind DB (D1) + MEDIA (R2), `.dev.vars` + `.wrangler/` gitignored
- **T3.1c** — `migrations/0001_initial_schema.sql` tạo 5 bảng (settings/branches/programs/posts/media), 

📄 File output: `/root/lucy/tasks/done/FITCITY-3.1-output.md`
