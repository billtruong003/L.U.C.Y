# FITCITY-UI-3 — Wire HẾT 50 slot ảnh static vào CMS (quản ảnh theo vị trí) + đồng bộ hero

**Trạng thái:** ✅ DONE — verify end-to-end trên preview pm2 `fitcity-preview` (:8793). Build pass. 5 commit local, KHÔNG push.
**Project:** `/root/lucy-workspace/fitcity-web`
**Ngày:** 2026-06-20

## Vấn đề (từ audit Sprint 1)
50/67 slot ảnh là static (`slotImg('images/...')`) → khách KHÔNG sửa được qua admin: gallery cơ sở (33), before/after chương trình (8), hero collage trang chủ (6), featured (1), pose before/after (2). Thêm 1 bất nhất: hero cơ sở dùng 2 nguồn (carousel trang chủ tĩnh ≠ trang chi tiết D1).

## Giải pháp — đã làm xong

### UI3.1 — Bảng + helper
- `migrations/0003_slot_images.sql`: `slot_images(slot_id TEXT PRIMARY KEY, media_key TEXT NOT NULL DEFAULT '')`.
- `src/lib/db.ts`: `getSlotImages(db) → Map<slot_id, media_key>` (chỉ trả row có key thật), `setSlotImage(db, slotId, key)` (UPSERT idempotent).
- `src/lib/images.ts`: `resolveSlot(map, slotId, fallbackFile)` → `mediaUrl(key)` nếu slot có gán, else `slotImg(fallback)` tĩnh, else `undefined` (placeholder — KHÔNG bịa ảnh).

### UI3.2 — Thay slotImg→resolveSlot ở MỌI trang (mỗi trang load getSlotImages 1 lần)
- `index.astro`: hero collage 6 (truyền prop `images` xuống `HeroCollage.astro`), `home-featured`, `home-pose-before/after`, carousel branch hero.
- `chi-nhanh/[slug].astro`: hero + gallery `branch-<slug>-g1/g2/g3`.
- `chuong-trinh/[program].astro`: `program-<slug>` (lớp) + `-before`/`-after`.
- `HeroCollage.astro`: thêm prop `images?: (string|undefined)[]` (thiếu prop → fallback slotImg, tương thích ngược).
- Tất cả GIỮ fallback tĩnh → trang không vỡ khi slot trống.

### UI3.3 — Admin "Quản ảnh theo vị trí" (`/admin/anh-vi-tri`)
- `buildSlots()` (admin/slots.js) → liệt kê 67 slot, NHÓM theo group (Thương hiệu / Trang chủ / 11 Chi nhánh / 4 Chương trình).
- Mỗi slot: 1 label + 1 `MediaPicker` (group lọc theo path slot, value = slot_images hiện tại).
- POST: lưu mỗi `slot_id` qua `setSlotImage`. Hint "đổi ở đây hiện NGAY đúng chỗ" + link "Xem trên web ↗" mỗi nhóm.
- Thêm tab "Ảnh theo vị trí" vào nav `Admin.astro`.

### UI3.4 — Đồng bộ hero cơ sở
- Carousel trang chủ + trang chi tiết CÙNG nguồn: `imageKeyUrl(branch.image_key) ?? resolveSlot('branch-<slug>-hero') ?? tĩnh`. Đổi hero 1 cơ sở (qua /admin/cơ sở hoặc /admin/anh-vi-tri) → cả 2 chỗ đổi.

### UI3.5 — Provision seed slot_images
- `provision.mjs` + `scripts/preview-seed.mjs`: seed mặc định từ ảnh tĩnh public/images (media_key = chính path đó vì ảnh đã ở R2 cùng key). `INSERT OR IGNORE` → KHÔNG đè lựa chọn admin khi re-seed.
- Kết quả: 65/67 slot có ảnh (2 slot BoxingKid không có ảnh tĩnh — đúng chủ đích audit).

### UI3.6 — Build + verify smoke
- `scripts/smoke-slots.mjs`: D1-only seed + verify (table OK, 65/67 seed, getSlotImages 65 key, override 3 slot đọc lại đúng).

## Bằng chứng verify (THẬT, đã chạy)

```
npm run build → ✓ Complete! 0 error

smoke-slots.mjs:
  ✓ slot_images table tồn tại
  ✓ seed mặc định: 65/67 slot có ảnh tĩnh
  ✓ getSlotImages → 65 slot có media_key
  ✓ override 3 slot → branch-hoang-cau-g1 / program-gymkid-before / hero-1 đọc lại đúng /media/<key>

E2E curl preview (:8793) — override 1 slot mỗi nhóm → trang công khai phản ánh:
  homepage    hero-1 override → /media/images/programs/gymkid.webp  ✓
  chi-nhanh   branch-hoang-cau-g1 → /media/images/home/featured.webp ✓
  chuong-trinh program-gymkid-before → /media/images/home/pose-after.webp ✓
  (reset về mặc định OK)

Admin authed (HMAC cookie):
  trang /admin/anh-vi-tri render đủ 67 label + 67 MediaPicker (139 astro-island), 13 nhóm
  POST save program-gymkid-after → /chuong-trinh/gymkid render /media mới NGAY (303), reset OK
```

## Commit (local, KHÔNG push)
```
e57b86b feat(UI3.1): slot_images table + getSlotImages/setSlotImage + resolveSlot helper
6e9a2f2 feat(UI3.2+UI3.4): thay slotImg→resolveSlot mọi trang + đồng bộ hero cơ sở
380804e feat(UI3.3): admin Quản ảnh theo vị trí — 67 slot nhóm + MediaPicker + tab nav
748831c feat(UI3.5+UI3.6): seed slot_images (provision+preview-seed) + smoke-slots verify
decece3 docs(UI3.6): cập nhật TASK3-PROGRESS
```

## Ghi chú / cảnh báo
- `preview-seed.mjs` bước R2 put (`MEDIA.put(buffer)`) crash devalue trên miniflare/wrangler bản hiện tại — **pre-existing, KHÔNG do UI3** (nằm sau phần D1). Migration + content + slot_images vẫn seed xong trước đó; ảnh R2 đã có sẵn từ lần seed trước nên `/media/` vẫn phục vụ. `smoke-slots.mjs` seed slot_images D1-only né được lỗi này. Nên có người soi lại bước R2 put khi rảnh (ngoài scope task này).
- Trên Cloudflare thật (deploy): chạy `npm run provision` để apply migration 0003 + seed slot_images remote.
