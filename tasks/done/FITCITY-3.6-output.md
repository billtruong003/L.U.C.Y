# FITCITY-3.6 — provision.mjs (setup phát chạy phát) — DONE ✅

**Project:** `/root/lucy-workspace/fitcity-web` · **Commit local** (KHÔNG push): `81eb695` (a-d) + `7a4f8ff` (e)

## Mục tiêu đạt được
1 lệnh idempotent để bàn giao khách: cắm Cloudflare API token → `npm run provision` → D1 + R2 đầy đủ content + ẢNH, deploy là chạy. KHÔNG thao tác tay.

## File
- `provision.mjs` (root) — ~430 dòng, standalone node ESM.
- `package.json`: thêm `provision` + `provision:local`.
- `README.md`: mục "Provision — bàn giao khách".
- `TASK3-PROGRESS.md`: mục T3.6 DONE.

## Chế độ
- `node provision.mjs --local` — miniflare local, KHÔNG cần token (test/dev).
- `node provision.mjs` (hoặc `npm run provision`) — THẬT/remote, đọc creds.
- `node provision.mjs --dry` — chỉ in kế hoạch, không ghi.

## T3.6a — Khung + creds (KHÔNG echo secret)
- Đọc creds theo thứ tự: env > `/root/.fitcity-r2-secrets` > `.dev.vars` (chỉ local). Chỉ in "đã nạp creds R2 / CF API token", KHÔNG in value.
- Idempotent: `INSERT OR REPLACE` (settings/branches/programs), `ON CONFLICT … DO UPDATE` (posts/media), kiểm tồn tại trước khi tạo D1/bucket, migrations `IF NOT EXISTS`.

## T3.6b — Hạ tầng + schema
- Có CF API token (D1/Pages): `wrangler d1 list/create fitcity` → parse `database_id` ghi vào `wrangler.jsonc`; `wrangler r2 bucket list/create fitcity-media`; apply migrations.
- ⚠️ Token R2-only hiện tại KHÔNG tạo được D1/bucket → IN cảnh báo rõ "cần CF API token (D1+Pages)", BỎ tạo, vẫn seed/sync nếu hạ tầng có. `--local` dựng D1/R2 local đầy đủ.

## T3.6c — Seed content → D1 ✅ acceptance
- Nguồn: `src/data/branches.json` (11) + `programs.json` (**4** — file thực có 4 chương trình, spec ghi 3) + `src/content/blog/*.md` (8, gray-matter) + settings.
- **Kết quả local verify:** `branches=11 · programs=4 · posts=8 · settings=8`.
- Settings keys: `hero_title, footer_text, hotline, email, fb_url, home_hero_heading, logo_key, logo_dark_key` → đủ hero/footer/hotline/email/FB.

## T3.6d — ⭐ Sync ẢNH → R2 (tự động) ✅ acceptance
- Quét `public/images/**` = **104 ảnh** → upload key giữ path (`images/<grp>/...`) + INSERT OR REPLACE `media(key,filename,bytes,grp)`. grp = thư mục con (branches/programs/home/brand).
- **Local:** `wrangler r2 object put fitcity-media/<key> --local` (pool 6 song song). Upload 104/104 ✓.
- **Thật:** S3 PUT qua **AWS SigV4 tự ký bằng `node:crypto`** — KHÔNG thêm dependency `@aws-sdk/*` (gọn hơn, không cần npm install nặng).
- **Acceptance local:**
  - `SELECT count(*) FROM media` = **104** ✓
  - Verify object thật: `wrangler r2 object get fitcity-media/images/branches/binh-thanh-g1.webp --local` → byte **49634 khớp** source, WebP 400x533 hợp lệ ✓ (lưu ý: `wrangler r2 object list` KHÔNG tồn tại ở wrangler 3.114 — chỉ get/put/delete — nên verify bằng `get`).
- **Smoke THẬT (creds R2 có):** upload 3 ảnh lên bucket **`newone`** + ListObjectsV2 → 3 object, tất cả HTTP **200** → **đường R2 live CHẠY ✓**. (Prefix `fitcity-smoke/`.) Lỗi mạng/creds → cảnh báo, KHÔNG fail task.

## T3.6e — script + doc
- `npm run provision` / `npm run provision:local` thêm vào package.json.
- README: bàn giao khách = `CLOUDFLARE_API_TOKEN=... npm run provision`.
- TASK3-PROGRESS cập nhật: provision xong, CHỈ còn T3.7.

## Bằng chứng chạy thật
```
npm run provision:local →
  T3.6b ✅ migrations applied
  T3.6c settings=8 · branches=11 · programs=4 · posts=8 ✅
  T3.6d ✅ R2 local: upload 104/104 ảnh · media index: 104 rows
  Verify: branches=11 · programs=4 · posts=8 · media=104 · settings=8
Re-run (idempotent) → count y hệt ✅
node provision.mjs --dry → smoke R2 thật: PUT s3://newone/... ×3 → 200, LIST → 3 object ✅
```

## Idempotency
Chạy provision --local lần 2 → `branches=11 · programs=4 · posts=8 · media=104 · settings=8` (không đổi, không nhân đôi).

## Còn lại — T3.7 deploy (CUỐI, cần duyệt)
- Cloudflare Pages deploy + `wrangler secret put ADMIN_PASSWORD ADMIN_SECRET` + bọc Cloudflare Access trước `/admin`.
- ⚠️ CẦN **CF API token scope D1+Pages** (token R2-only hiện tại KHÔNG đủ tạo D1/bucket/deploy) + **chủ nhân duyệt**.

## Ghi chú
- KHÔNG echo secret · KHÔNG push (2 commit local) · không restart service nào.
- Khác biệt nhỏ với spec: spec ghi programs=3 nhưng `programs.json` thực có **4** chương trình (GymKid/BoxingKid/PilatesKid/Chỉnh tư thế) → seed đủ 4, báo trung thực.
