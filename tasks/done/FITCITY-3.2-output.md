# FITCITY-3.2 — Content layer: D1 SSR

**Status:** DONE (2026-06-20)  
**Commit:** `0846340` tại `/root/lucy-workspace/fitcity-web`

---

## T3.2a — `src/lib/db.ts`

Typed D1 access layer (uses `D1Database` từ `@cloudflare/workers-types`):

- `getSettings(db)` → `Record<string, string>`
- `getBranches(db)` → `Branch[]`
- `getBranch(db, slug)` → `Branch | null`
- `getPrograms(db)` → `Program[]`
- `getProgram(db, slug)` → `Program | null`

**Branch type**: có thêm `geo: { lat: null; lng: null }` và `type: 'main'|'franchise'` derived (compat với `branchSchema()` trong jsonld.ts)  
**Program type**: `age AS ages` trong SELECT → `program.ages` khớp template + `programServiceSchema()`

---

## T3.2b — Migration 0002 + seed script

**Migration** `migrations/0002_branches_programs_extra.sql`:
```sql
ALTER TABLE branches ADD COLUMN district TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN hours    TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN metric   TEXT NOT NULL DEFAULT '';
ALTER TABLE branches ADD COLUMN coach    TEXT NOT NULL DEFAULT '';
ALTER TABLE programs ADD COLUMN summary  TEXT NOT NULL DEFAULT '';
ALTER TABLE programs ADD COLUMN accent   TEXT NOT NULL DEFAULT '';
ALTER TABLE programs ADD COLUMN ages     TEXT NOT NULL DEFAULT '';
```

**Seed** `scripts/seed-d1-local.mjs`:
- Đọc `src/data/branches.json` + `src/data/programs.json`
- INSERT OR REPLACE qua tmp SQL file (tránh shell escaping issue)
- Chạy: `node scripts/seed-d1-local.mjs`

**Verify:**
```
branches = 11 ✓
programs = 4 ✓  (task spec ghi 3 nhưng programs.json có 4: gymkid/boxingkid/pilateskid/chinh-tu-the)
```

---

## T3.2c — Trang refactored sang D1

| Trang | Thay đổi |
|-------|----------|
| `src/pages/index.astro` | prerender=false, getBranches+getPrograms |
| `src/pages/chi-nhanh/index.astro` | prerender=false, getBranches |
| `src/pages/chi-nhanh/[slug].astro` | XÓA prerender=true+getStaticPaths → SSR lookup + 404 |
| `src/pages/chuong-trinh/[program].astro` | XÓA prerender=true+getStaticPaths → SSR lookup + 404 |
| `src/pages/lich-hoc.astro` | prerender=false, getBranches |

`branches.json` + `programs.json` GIỮ NGUYÊN làm nguồn seed. Blog pages không đụng.

`slotImg()` trong SSR pages → CF worker trả `undefined` (existsSync=false ở CF worker) → MediaFrame placeholder. T3.3 sẽ thay bằng R2 URL.

---

## Verify kết quả

```
npm run build       → PASS (no TypeScript errors)
/healthz            → SSR ↔ D1 OK, settings(7) branches(11)
/chi-nhanh/hoang-cau → 200, "FitCity Hoàng Cầu", meta D1 data ✓
/chuong-trinh/gymkid  → 200, "GymKid — Vận động & phát triển chiều cao", summary D1 ✓
/chi-nhanh/unknown   → 404 ✓
/chuong-trinh/nonexistent → 404 ✓
```

---

## Lệnh dev

```bash
# Apply migration + seed
npx wrangler d1 migrations apply fitcity --local
node scripts/seed-d1-local.mjs

# Dev
npm run dev  # :4321, platformProxy đọc D1 local

# Verify bằng SQL
npx wrangler d1 execute fitcity --local --command "SELECT name, district FROM branches LIMIT 3"
```

---

## Còn lại (T3.3)

- `slotImg()` → R2 image URL lookup bằng `image_key`
- Upload gallery + hero images cho chi nhánh
- Logo CMS qua R2
