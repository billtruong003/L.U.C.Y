# FITCITY-3.1 Output — Cloudflare SSR + D1 Foundation

**Status:** DONE  
**Date:** 2026-06-20  
**Commits:** 5 (T3.1a→e), local only, NOT pushed

---

## Kết quả từng sub-task

### T3.1a — Adapter SSR ✅
- `@astrojs/cloudflare@11.2.0` (compat astro v4.x — v12+ cần Astro v6)
- `astro.config.mjs`: `output: 'server'` + `adapter: cloudflare({ platformProxy: true })`
- `vite.ssr.external` node built-ins (slotImg dùng node:fs chỉ ở build-time)
- `export const prerender = true` cho chi-nhanh/[slug], chuong-trinh/[program], blog/[...slug], blog/index
- **Build pass:** 11 cs + 4 chương trình + 5 blog + dynamic SSR routes

### T3.1b — wrangler.jsonc ✅
- `wrangler.jsonc`: DB (D1 fitcity) + MEDIA (R2 fitcity-media), nodejs_compat, date 2024-09-23
- `.dev.vars` + `.wrangler/` gitignored
- `database_id` = placeholder `00000000-...` → thay bằng id thật ở T3.6

### T3.1c — D1 Schema ✅
- `migrations/0001_initial_schema.sql`: 5 bảng (settings/branches/programs/posts/media) + indexes
- `wrangler d1 migrations apply fitcity --local` → 10 SQL cmds OK
- Verify: `SELECT name FROM sqlite_master` → 5 bảng đủ

### T3.1d — Smoke /healthz ✅
- `src/pages/healthz.astro`: SSR đọc `Astro.locals.runtime.env.DB` → render bảng settings + branches
- Seed: 4 settings (site_name, hotline, hero_title, footer_address) + 2 branches (hoang-cau, minh-khai)
- **Verified via `astro dev`:** `settings(4 rows) + branches(2 rows)` render HTML — SSR ↔ D1 THÔNG

### T3.1e — TASK3-PROGRESS.md ✅
- `TASK3-PROGRESS.md` tại root fitcity-web: lệnh dev, schema, gotchas, roadmap T3.2

---

## Lệnh dev local

```bash
cd /root/lucy-workspace/fitcity-web

# Dev (platformProxy đọc D1 state)
npm run dev

# Apply migrations
npx wrangler d1 migrations apply fitcity --local

# Smoke test
curl http://localhost:4321/healthz

# Verify D1
npx wrangler d1 execute fitcity --local --command "SELECT name FROM sqlite_master WHERE type='table'"
```

---

## Gotchas ghi lại

1. **Version compat:** `@astrojs/cloudflare` v12+ cần Astro v6 → phải dùng v11.2.0 cho Astro v4
2. **node:fs externalize:** slotImg dùng existsSync (build-time) → `vite.ssr.external` để CF Worker không bị lỗi bundle
3. **`_` prefix:** Astro bỏ route bắt đầu `_` → đổi `_d1health` thành `healthz`
4. **D1 state split:** `wrangler d1` dùng `.wrangler/state/v3/d1/` (platformProxy); `wrangler pages dev` dùng miniflare state riêng → dev test bằng `astro dev` (platformProxy)

---

## Sẵn sàng cho T3.2
- T3.2: refactor trang đọc D1 (branches/programs/settings thay json tĩnh)
- Route index.astro + chi-nhanh/index.astro + dang-ky.astro → SSR từ D1
- Xem chi tiết: `TASK3-PROGRESS.md` trong fitcity-web
