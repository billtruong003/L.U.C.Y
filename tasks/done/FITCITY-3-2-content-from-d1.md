---
id: FITCITY-3.2
title: TASK3 content layer — trang đọc branches/programs/settings từ D1 (SSR), thay import json tĩnh
priority: 1
tier: claude
model: sonnet
status: queued
---

# FITCITY-3.2 — Content layer: trang render từ D1 (SSR live), không còn json tĩnh

**Project dir:** `/root/lucy-workspace/fitcity-web`. ĐỌC `TASK3-PROGRESS.md` + design mục 3 trước.
**Test LOCAL bằng wrangler (`--local`), KHÔNG cần token thật.** Commit local, KHÔNG push.

## Bối cảnh (nền T3.1 đã xong)
- Đã có: adapter cloudflare SSR, wrangler.jsonc bind `DB`(D1)+`MEDIA`(R2), 5 bảng, `/healthz` đọc D1 OK.
- branches.json / programs.json GIỮ NGUYÊN làm NGUỒN SEED (provision T3.6 đổ vào D1). Task này KHÔNG xoá json — chỉ chuyển TRANG sang đọc D1.

## Việc cần làm (tuần tự, commit local riêng)

### T3.2a — Data-access layer `src/lib/db.ts`
- Hàm typed đọc D1 từ `locals.runtime.env.DB`: `getSettings()` (→ map key→value), `getBranches()`, `getBranch(slug)`, `getPrograms()`, `getProgram(slug)`.
- Trả type khớp cột bảng (settings/branches/programs trong migration T3.1).
- **Acceptance:** db.ts export đủ hàm, tsc/astro check không lỗi type.

### T3.2b — Seed D1 LOCAL từ json (để dev/test render được)
- Script `scripts/seed-d1-local.mjs` (hoặc SQL sinh ra): đọc branches.json + programs.json + text settings hiện tại → INSERT vào D1 local (`wrangler d1 execute --local`).
- Đây là tiện ích DEV (provision thật ở T3.6). Idempotent (INSERT OR REPLACE).
- **Acceptance:** chạy script → `wrangler d1 execute fitcity --local --command "SELECT count(*) FROM branches"` = 11; programs = 3.

### T3.2c — Refactor trang đọc D1 (SSR, prerender=false)
- Các trang/đổi sang đọc D1 qua db.ts thay `import branches from data/branches.json`:
  - `src/pages/index.astro` (section cơ sở + chương trình + hero/footer text từ settings)
  - `src/pages/chi-nhanh/[slug].astro` — BỎ getStaticPaths tĩnh → SSR: đọc `Astro.params.slug` → `getBranch(slug)`, 404 nếu không có.
  - `src/pages/chuong-trinh/[program].astro` — tương tự, `getProgram()`.
  - `src/pages/lich-hoc.astro` nếu dùng branches.
  - `Nav.astro` / `Footer.astro` — text liên hệ (hotline/email/FB) từ settings nếu có; giữ fallback hằng số.
- Đánh dấu các trang động này `export const prerender = false` (đọc D1 mỗi request = live edit).
- GIỮ logo qua slot/R2 sau (T3.3) — task này chỉ lo TEXT/DATA.
- **Acceptance:** `npm run build` pass (SSR); chạy dev (`wrangler pages dev ./dist` hoặc `npm run dev`) → trang chủ + 1 trang `/chi-nhanh/<slug>` render ĐÚNG dữ liệu từ D1 (sửa 1 dòng trong D1 local → reload thấy đổi = chứng minh live, không build).

### T3.2d — Cập nhật TASK3-PROGRESS.md
- Ghi: trang nào đã đọc D1, hàm db.ts, lệnh seed local, còn gì cho T3.3 (R2 media/gallery).

## Ghi chú
- KHÔNG xoá json (nguồn seed). KHÔNG đụng R2/ảnh (để T3.3). KHÔNG push.
- Vướng SSR/getStaticPaths không qua nổi → NEEDS_HUMAN + chi tiết, đừng phá site.


---

## Kết quả (claude)

**FITCITY-3.2 DONE.**

Tóm tắt những gì đã làm:

- **Migration 0002**: thêm 7 cột còn thiếu (`district`, `hours`, `metric`, `coach` cho branches; `summary`, `accent`, `ages` cho programs)
- **`src/lib/db.ts`**: layer typed D1 với 5 hàm (`getBranches/getBranch/getPrograms/getProgram/getSettings`), type compat với `branchSchema()` + `programServiceSchema()` 
- **`scripts/seed-d1-local.mjs`**: idempo

📄 File output: `/root/lucy/tasks/done/FITCITY-3.2-output.md`
