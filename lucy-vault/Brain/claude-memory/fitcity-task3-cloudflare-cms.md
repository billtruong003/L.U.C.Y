---
name: fitcity-task3-cloudflare-cms
description: FitCity = Cloudflare-native CMS (Astro SSR + D1 + R2) — XONG bản preview 2026-06-20; chỉ còn deploy Cloudflare thật (chờ CF API token D1+Pages)
metadata: 
  node_type: memory
  type: project
  originSessionId: dee6962d-9c04-4695-becb-0a384a86cfad
---

FitCity (khách thật đầu tiên) = **Cloudflare-native CMS**. **DONE bản preview 2026-06-20** — 12 task FitCity hết.

**Kiến trúc:** Astro **SSR** (`@astrojs/cloudflare`) trên Cloudflare Pages, content NGOÀI repo: text/blog/cơ sở/chương trình → **D1**; ảnh + gallery → **R2** (`/media/<key>`). Sửa → SSR đổi ngay không build.

**Đã làm (preview chạy ở `:8793`, repo `github.com/billtruong003/fitcity-web`):**
- SSR + D1 + R2 + blog + provision.mjs (1 lệnh seed D1+R2+sync ảnh, idempotent).
- Admin `/admin` (gate mật khẩu, prod nên bọc Cloudflare Access): sửa text/cơ sở/chương trình/blog + **đổi màu brand** (`/admin/theme`, CSS var → đổi cả site) + **MediaPicker trực quan** (chọn ảnh bằng thumbnail, KHÔNG lộ key) + **Quản ảnh theo vị trí** (`/admin/anh-vi-tri`, 67 slot ảnh đều sửa được — bảng D1 `slot_images` + helper resolveSlot).
- Admin tự-giải-thích (bỏ jargon "alt"/"R2 key", mỗi field có "hiện ở đâu" + "Xem trên web"); ảnh BoxingKid thật.

**Bài học kỹ thuật QUAN TRỌNG (đã vấp + fix):**
- Local preview: `astro dev` + platformProxy (KHÔNG dùng `wrangler pages dev` — lỗi `mod.page`). D1 hash của `wrangler d1 execute --local` ≠ `getPlatformProxy` → seed phải qua `scripts/preview-seed.mjs` (getPlatformProxy). MEDIA.put qua proxy crash Buffer → ảnh seed bằng wrangler CLI/provision.
- **Vue island `client:load` gây hydration mismatch → nuke cả DOM (xoá nav)** → MediaPicker phải `client:only="vue"`.
- Title display tiếng Việt: leading phải ≥1.1 (Anton dấu chồng tầng), KHÔNG để <1.0.

**CÒN LẠI:** deploy lên Cloudflare THẬT (T3.7) — cần **CF API token scope D1+Pages** (token R2 cá nhân Bill đưa chỉ làm R2). Chạy `provision.mjs` thật + deploy Pages → live cho khách.

Liên quan: [[fitcity-task3-real-images]], [[fitcity-admin-live]] (admin :8790 cũ — bị thay bởi CMS này).
