---
id: FITCITY-3.5
title: TASK3 Admin panel — login + sửa text/cơ sở/chương trình + CRUD blog + upload/gallery ảnh + logo
priority: 3
tier: claude
model: opus
status: queued
---

# FITCITY-3.5 — Admin panel /admin (anh Quân tự quản content)

**Project dir:** `/root/lucy-workspace/fitcity-web`. ĐỌC `TASK3-PROGRESS.md`. Test LOCAL `wrangler --local`. Commit local, KHÔNG push.

## Bối cảnh
- T3.1-3.4 xong: SSR+D1 (settings/branches/programs/posts/media), R2 media + gallery + MediaPicker, blog.
- Admin này thay dashboard cũ (`admin/server.js` :8790 chỉ đổi ảnh) — giờ quản cả TEXT + blog + ảnh, ghi thẳng D1/R2, site SSR live ngay.

## Việc (tuần tự, commit riêng)
### T3.5a — Auth gate
- `/admin/*` yêu cầu đăng nhập: mật khẩu env `ADMIN_PASSWORD` (đọc từ `.dev.vars` local / secret prod) → set cookie ký (HMAC, env `ADMIN_SECRET`). Middleware chặn mọi route admin nếu chưa auth.
- Ghi chú: prod nên thêm Cloudflare Access bọc ngoài (free) — comment hướng dẫn, KHÔNG bắt buộc local.
- **Acceptance:** vào `/admin` chưa login → form mật khẩu; sai pw → chặn; đúng → vào được; cookie hết hạn → chặn lại.

### T3.5b — Sửa TEXT (settings) + cơ sở + chương trình
- Trang admin: form sửa settings (hero/slogan/footer/hotline/email/FB) → POST ghi `settings` (D1).
- CRUD `branches` (11 cơ sở: thêm/sửa/xoá/sắp thứ tự + chọn ảnh hero qua MediaPicker).
- CRUD `programs` (3 chương trình tương tự).
- **Acceptance:** sửa 1 text trong admin → reload trang công khai (SSR) thấy đổi NGAY, không build. Thêm/xoá 1 cơ sở phản ánh ở `/chi-nhanh`.

### T3.5c — CRUD blog
- List + tạo/sửa/xoá post (title/slug/excerpt/body_md textarea/hero ảnh/status). Preview markdown nếu dễ.
- **Acceptance:** tạo post draft → không hiện công khai; đổi published → hiện ở `/blog`.

### T3.5d — Upload ảnh + gallery + logo
- Form upload ảnh → POST `env.MEDIA.put(key, file)` + `addMedia()` (resize nếu cần). Browse gallery (T3.3) + xoá ảnh.
- Đổi logo: upload → set `settings.logo_key` / `logo_dark_key`.
- **Acceptance:** upload 1 ảnh trong admin → xuất hiện trong gallery + servable `/media/<key>`; gán logo → Nav/Footer đổi.

### T3.5e — Dọn "Chi nhánh" sót (T2B.5 nợ cũ)
- Trong lúc đụng nav/footer: đổi label HIỂN THỊ "Chi nhánh" → "Cơ sở" ở nav chip + breadcrumb + footer link + JSON-LD breadcrumb name. GIỮ route `/chi-nhanh` (không đổi URL).
- **Acceptance:** grep dist HTML: 0 "Chi nhánh" ở nav/breadcrumb/footer/JSON-LD (route giữ nguyên).

### T3.5f — PROGRESS
- Cập nhật `TASK3-PROGRESS.md`: admin xong, còn provision (T3.6) + deploy (T3.7).

## Ghi chú: KHÔNG push. Secret (ADMIN_PASSWORD/SECRET) trong `.dev.vars` (gitignore), KHÔNG hardcode. Vướng → NEEDS_HUMAN + chi tiết.


---

## Kết quả (claude)

Xong rồi chủ nhân ạ. FITCITY-3.5 admin panel hoàn tất, verify thật bằng curl trên dev local, commit local (không push).

✅ Đã làm (5 phần, mỗi cái verify thật):
• *Auth gate* — cookie ký HMAC-SHA256 (Web Crypto) + middleware chặn `/admin/*`. Test đủ: no-cookie→302, sai pw→báo lỗi, đúng pw→vào được, cookie giả→chặn, logout→302.
• *Settings/Cơ sở/Chương trình* — CRUD ghi thẳng D1 + MediaPicker. Sửa 

📄 File output: `/root/lucy/tasks/done/FITCITY-3.5-output.md`
