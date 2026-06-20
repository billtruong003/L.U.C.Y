# FITCITY-2B — Output Report

**Ngày:** 2026-06-20  
**Branch:** main (local, chưa push — Bill push tay)  
**Build:** 30 trang, 0 error, 10.47s

---

## Kết quả từng đầu việc

### T2B.1 — Slot logo header (brand-logo)
- Convert `logo-06.png` (4188px RGBA) → `public/images/brand/logo.webp` (512×126 webp, q=90)
- Slot `brand-logo` trong `admin/slots.js` GIỮ NGUYÊN path — chỉ thay nội dung file
- `Nav.astro` dùng `slotImg('images/brand/logo.webp')` — không thay đổi
- Commit: `2e4f559`

### T2B.2 — Slot logo footer dark (brand-logo-dark) 
- Convert `logo-02.png` (trắng toàn bộ) → `public/images/brand/logo-dark.webp` (512×126 webp)
- Thêm slot `brand-logo-dark` vào `admin/slots.js` (sau `brand-logo`, cùng nhóm Thương hiệu)
- `Footer.astro` đổi `slotImg('images/brand/logo.webp')` → `slotImg('images/brand/logo-dark.webp')`
- Verify: `node -e` gọi buildSlots() → id `brand-logo-dark` có trong catalog
- Commit: `bd8adef`

### T2B.3 — Favicon + OG bỏ lime
- `public/favicon.svg`: bỏ "FC" fill `#c3d500`, thay bằng rect forest + "FIT" trắng + "CITY" cam
- `public/og-cover.svg`: 2 chỗ `#c3d500` → `#016F44` (text FITCITY) + `#EC6B25` (rect CTA); "5–16 tuổi" → "6–16 tuổi"; "11 chi nhánh" → "11 cơ sở"
- Commit: `78da0ca`

### T2B.4 — Fallback F-badge bỏ lime
- `Nav.astro` + `Footer.astro`: `bg-lime text-forest` → `bg-forest text-white`; `text-lime` → `text-brand` trong fallback badge
- `hover:text-lime` trên nav links giữ nguyên (đó là hover effect, không phải fallback logo)
- Commit: `78011c7`

### T2B.5 — Sweep "chi nhánh" display
- Grep kết quả: **toàn bộ** "chi nhánh" trong src/ là comment/code — KHÔNG phải display text
- Duy nhất chỗ display là `og-cover.svg` "11 chi nhánh" → đã sửa trong T2B.3
- Route `/chi-nhanh/` và slug URL KHÔNG đổi
- Commit: `4a862bb` (empty commit xác nhận)

### T2B.6 — Build + Acceptance
- Build: 30 trang, 0 error ✅
- **0** lime `#c3d500` trong `public/` ✅
- **0** lime `#c3d500` trong `dist/` ✅
- Logo header (`logo.webp`) có trong dist/index.html ✅
- Logo footer (`logo-dark.webp`) có trong dist/index.html ✅
- Slot `brand-logo-dark` trong buildSlots() ✅
- Favicon: không còn "FC" hay `#c3d500` ✅
- **0** "chi nhánh" display text trong dist/*.html ✅

---

## Commits local (10 commits ahead of origin/main)

```
4a862bb chore(T2B.5): sweep chi nhánh display
78011c7 feat(T2B.4): fallback F-badge bỏ bg-lime → bg-forest
78da0ca feat(T2B.3): favicon + og-cover bỏ lime
bd8adef feat(T2B.2): logo-dark slot footer + slot catalog
2e4f559 feat(T2B.1): seed logo-06 official header slot
```

## Files đã thay đổi
- `public/images/brand/logo.webp` — logo-06 (header, forest+trắng)
- `public/images/brand/logo-dark.webp` — logo-02 (footer, trắng toàn phần) [NEW]
- `admin/slots.js` — thêm slot `brand-logo-dark`
- `src/components/Footer.astro` — dùng `logo-dark.webp`, fallback forest/white
- `src/components/Nav.astro` — fallback forest/white (không đổi logo slot)
- `public/favicon.svg` — FIT+CITY forest/cam, bỏ lime
- `public/og-cover.svg` — forest/cam, 0 lime, "11 cơ sở", "6–16 tuổi"
