---
id: FITCITY-3.6
title: TASK3 provision.mjs — 1 lệnh tạo D1+R2 + seed content + sync ẢNH (idempotent)
priority: 4
tier: claude
model: opus
status: queued
---

# FITCITY-3.6 — ⭐ provision.mjs (setup phát chạy phát)

**Project dir:** `/root/lucy-workspace/fitcity-web`. ĐỌC `TASK3-PROGRESS.md` + design mục 4. Commit local, KHÔNG push.

## Mục tiêu
1 lệnh, idempotent, để bàn giao khách: cắm creds → chạy → D1+R2 đầy đủ content + ẢNH, deploy là chạy. KHÔNG thao tác tay.

## Việc (tuần tự, commit riêng)
### T3.6a — `provision.mjs` khung + chế độ
- `node provision.mjs --local` (test miniflare, KHÔNG cần token) và chế độ thật (đọc creds).
- Đọc creds: local→.dev.vars; thật→env hoặc file `/root/.fitcity-r2-secrets` (R2 Access Key/Secret/endpoint/bucket). **KHÔNG echo secret ra log** (chỉ in "đã nạp creds R2").
- Idempotent: mọi bước re-run an toàn (INSERT OR REPLACE / kiểm tồn tại trước khi tạo).

### T3.6b — Tạo hạ tầng + schema
- Nếu có Cloudflare API token (D1/Pages scope): `wrangler d1 create fitcity` (nếu chưa có) + ghi `database_id` vào wrangler.jsonc; tạo R2 bucket `fitcity-media` (nếu chưa). Apply migrations.
- ⚠️ Token R2-only hiện có KHÔNG tạo được D1/bucket → nếu thiếu CF API token: bỏ qua bước tạo, IN cảnh báo rõ "cần CF API token (D1+Pages) để tạo D1/bucket", vẫn chạy tiếp phần seed/sync nếu hạ tầng đã có. Với `--local` thì tạo D1/R2 local đầy đủ.

### T3.6c — Seed content vào D1
- Đọc `src/data/branches.json` (11) + `src/data/programs.json` (3) + `src/content/blog/*.md` (≥8) + text settings hiện tại → INSERT OR REPLACE vào D1 (settings/branches/programs/posts).
- **Acceptance (local):** sau provision local: branches=11, programs=3, posts≥8, settings có hero/footer/hotline/email/FB.

### T3.6d — ⭐ Sync ẢNH lên R2 (tự động, không tay)
- Quét `public/images/**` (ảnh thật + logo đã có) → upload từng file lên R2 theo key giữ path (`images/...`) + INSERT OR REPLACE row `media` (key,filename,bytes,width,height,group).
- Local: dùng `wrangler r2 object put fitcity-media/<key> --local`. Thật: S3 PUT lên endpoint R2 bằng Access Key/Secret (cài `@aws-sdk/client-s3` nếu cần).
- **Acceptance (local):** sau sync, `wrangler r2 object list fitcity-media --local` liệt kê đủ ảnh; `SELECT count(*) FROM media` = số ảnh.
- **Smoke THẬT (nếu creds R2 có):** thử upload 2-3 ảnh lên bucket `newone` thật + list lại để chứng minh đường live chạy. Lỗi mạng/creds → IN cảnh báo, KHÔNG fail cả task.

### T3.6e — `npm run provision` + doc + PROGRESS
- Thêm script `provision` vào package.json. README ngắn: bàn giao khách = `CLOUDFLARE_API_TOKEN=... npm run provision`.
- Cập nhật `TASK3-PROGRESS.md`: provision xong, CHỈ còn T3.7 (deploy Cloudflare Pages — cần CF API token D1+Pages + chủ nhân duyệt).

## Ghi chú
- KHÔNG echo secret. KHÔNG push. Phần tạo D1/bucket + deploy thật để T3.7 (thiếu CF API token rộng) — task này lo full LOCAL + sync R2 smoke.
- Vướng → NEEDS_HUMAN + chi tiết, đừng fail câm.


---

## Kết quả (claude)

Xong rồi chủ nhân ✅ FITCITY-3.6 — `provision.mjs` 1 lệnh idempotent.

Kết quả chính (đã chạy thật, có bằng chứng):
• `npm run provision:local` → migrations + seed `branches=11 · programs=4 · posts=8 · settings=8` + sync **104/104 ảnh** lên R2 local + 104 media rows. Verify object thật: `get` ra byte khớp (49634), WebP hợp lệ.
• **Smoke R2 THẬT chạy:** SigV4 tự ký bằng `node:crypto` (không cần thêm

📄 File output: `/root/lucy/tasks/done/FITCITY-3.6-output.md`
