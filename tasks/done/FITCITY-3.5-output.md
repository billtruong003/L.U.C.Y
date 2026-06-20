# FITCITY-3.5 — Admin panel /admin — KẾT QUẢ

**Project:** `/root/lucy-workspace/fitcity-web` · **Commit local:** `be6da96` (KHÔNG push) · **Build:** PASS · **Verify:** dev local `astro dev` + platformProxy (D1/R2/.dev.vars miniflare).

Admin mới thay dashboard cũ (`admin/server.js` :8790 chỉ đổi ảnh): quản TEXT + cơ sở + chương trình + blog + ảnh/logo, ghi thẳng D1/R2, site SSR cập nhật NGAY (không cần build lại).

## File mới / sửa
**Mới:**
- `src/lib/admin-auth.ts` — cookie phiên KÝ HMAC-SHA256 (Web Crypto): `makeToken/verifyToken/checkPassword/setCookieHeader/clearCookieHeader`.
- `src/lib/admin.ts` — `adminEnv(locals)`, `isSecure(url)`, `slugify()` (bỏ dấu tiếng Việt).
- `src/middleware.ts` — gác `/admin/*` (trừ `/admin/login`).
- `src/layouts/Admin.astro` — khung quản trị (noindex, theme tối, thanh tab + đăng xuất).
- `src/pages/admin/` — `index` (tổng quan) · `login.astro` · `logout.ts` · `settings.astro` · `branches.astro` · `programs.astro` · `posts.astro` · `media.astro`.

**Sửa:**
- `src/lib/db.ts` — thêm CRUD admin: `setSetting/setSettings`, `getBranchById/saveBranch/deleteBranch`, `getProgramById/saveProgram/deleteProgram`, `getPostById/savePost/deletePostById` (id-based, cho đổi slug, auto-stamp `published_at`).
- `src/pages/index.astro` — wire `settings.home_hero_heading` (fallback bản gốc).
- `src/pages/chi-nhanh/[slug].astro`, `src/pages/404.astro`, `src/components/BranchCarousel.vue` — "Chi nhánh" → "Cơ sở".
- `.dev.vars` (gitignored) — thêm `ADMIN_PASSWORD` + `ADMIN_SECRET` (KHÔNG echo, KHÔNG commit; xác nhận `git check-ignore .dev.vars`).

## Acceptance — bằng chứng verify (curl thật trên dev :4321)

### T3.5a Auth gate ✓
- GET `/admin` không cookie → **302** `/admin/login?next=%2Fadmin`
- GET `/admin/login` → **200** (có `name="password"`)
- POST sai pw → "**Mật khẩu không đúng**"
- POST đúng pw → **303** + `Set-Cookie: fc_admin`
- GET `/admin` có cookie → **200** "Bảng điều khiển"
- GET `/admin` cookie giả `999.deadbeef` → **302** (chữ ký HMAC fail)
- `/admin/logout` → **302** về login

### T3.5b Settings + branches + programs ✓
- POST settings `home_hero_heading="KIỂM THỬ TIÊU ĐỀ 9X7"` → reload `/` công khai thấy text mới NGAY (SSR, không build)
- Thêm cơ sở "Cơ sở Kiểm Thử ZZ" → hiện ở `/chi-nhanh`; slug auto `co-so-kiem-thu-zz` → trang riêng **200**
- Sửa tên cơ sở → phản ánh `/chi-nhanh`; Xoá → trang **404**
- (programs CRUD cùng pattern + MediaPicker)

### T3.5c CRUD blog ✓
- Tạo draft → KHÔNG hiện `/blog` (count 0); trang draft → **404**
- Đổi published → hiện `/blog`; trang → **200**
- Xoá → **404**

### T3.5d Upload + gallery + logo ✓
- Upload PNG (multipart) → media row D1 + `/media/branches/test.png` **200 image/png** + hiện gallery
- Set logo `branches/test.png` → Nav `/` dùng `/media/branches/test.png`
- Xoá ảnh → R2.delete + index xoá → `/media/...` **404**

### T3.5e "Chi nhánh" → "Cơ sở" ✓ (route `/chi-nhanh` giữ nguyên)
- `/chi-nhanh/cau-giay`: **0** "Chi nhánh"; JSON-LD BreadcrumbList `name="Cơ sở"`
- Homepage: **0** "Chi nhánh" (carousel `aria-label="Cơ sở FitCity"`)
- Nav/Footer đã là "Hệ thống cơ sở" từ trước

**Dọn data test:** đã xoá branch/post/media test, khôi phục logo gốc + reset settings (DB: m=0 b=0 p=0).

## Ghi chú kỹ thuật
- Cookie HMAC chạy cả dev (platformProxy) lẫn CF Worker (Web Crypto `crypto.subtle`), không cần lib ngoài.
- MediaPicker tái dùng `Gallery.astro` (picker mode) → event `media:pick` đổ R2 key vào ô input.
- Upload CHƯA resize (Sharp không chạy Cloudflare) — UI nhắc nén ≤~300KB.
- `npm run build` PASS; `astro check` bỏ qua (chưa cài `@astrojs/check`, không tự thêm dep) — đã verify runtime đầy đủ bằng curl.

## Còn lại (ngoài phạm vi T3.5)
- **T3.6 provision:** tạo D1+R2 remote, đổ toàn bộ data; `wrangler secret put ADMIN_PASSWORD ADMIN_SECRET` (prod secret, KHÔNG dùng .dev.vars).
- **T3.7 deploy:** Cloudflare Pages + bọc **Cloudflare Access** (Zero Trust, free) trước `/admin` làm lớp 2 (đã comment hướng dẫn trong `middleware.ts`).

KHÔNG push (đúng yêu cầu). PROGRESS đã cập nhật mục T3.5 (T3.5f).
