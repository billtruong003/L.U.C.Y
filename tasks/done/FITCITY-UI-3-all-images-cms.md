---
id: FITCITY-UI-3
title: Sprint 2 — Wire HẾT 50 slot ảnh static vào CMS (quản ảnh theo vị trí) + đồng bộ hero
priority: 1
tier: claude
model: opus
status: queued
---

# FITCITY-UI-3 — Vá triệt để: MỌI ảnh trên site sửa được qua admin

**Project dir:** `/root/lucy-workspace/fitcity-web`. Test LOCAL preview pm2 `fitcity-preview` (:8793). `npm run build` pass. Commit local, KHÔNG push.
**ĐỌC TRƯỚC:** `/root/lucy-workspace/fitcity-image-audit.md` (audit Sprint 1 — danh sách đầy đủ 67 slot, 50 cái cần vá).

## Mục tiêu
Hiện 50/67 slot ảnh là static (`slotImg('images/...')`) → khách không sửa được (cơ sở gallery, chương trình before/after, trang chủ hero collage/featured/pose). Làm cho TẤT CẢ sửa được qua admin, end-to-end.

## Plumbing (đã soi, dùng luôn)
- `admin/slots.js` `buildSlots()` → 67 slot `{id,label,group,ratio,file}` (file = path tĩnh, vd `images/branches/<slug>-g1.webp`).
- `src/lib/images.ts` `slotImg(file)` = sync, đọc public/ tĩnh.
- `src/lib/media.ts` `imageKeyUrl(key)` / `mediaUrl(key)` = `/media/<key>` (R2). `adminEnv(locals)` → DB/MEDIA.
- Bảng D1: migrations/0001+0002. db.ts có getSettings/listMedia. Trang SSR (prerender=false) có `Astro.locals.runtime.env.DB`.
- MediaPicker.vue (`client:only="vue"`), middleware bảo vệ /admin/*.

## Việc (tuần tự, commit riêng)

### UI3.1 — Bảng + helper resolveSlot
- Migration `0003_slot_images.sql`: `CREATE TABLE slot_images (slot_id TEXT PRIMARY KEY, media_key TEXT NOT NULL DEFAULT '')`.
- `src/lib/db.ts`: `getSlotImages(db) → Map<slot_id, media_key>`, `setSlotImage(db, slotId, key)`.
- `src/lib/images.ts` (hoặc media.ts): `resolveSlot(map, slotId, fallbackFile)` → `map.get(slotId)` ? `/media/<key>` : `slotImg(fallbackFile)`. (Trang load map 1 lần qua getSlotImages.)
- **Acceptance:** migration apply local; helper trả D1 key nếu có, fallback tĩnh nếu không.

### UI3.2 — Thay slotImg→resolveSlot ở MỌI trang (giữ fallback)
- Map slot_id ↔ file (theo buildSlots): vd `branch-<slug>-g1` ↔ `images/branches/<slug>-g1.webp`, `program-<slug>-before` ↔ `images/programs/<slug>-before.webp`, `hero-1`↔`images/home/hero-1.webp`, `home-featured`, `home-pose-before/after`.
- Sửa: `index.astro` (hero collage 6, featured, pose ×2, carousel branch hero), `chi-nhanh/[slug].astro` (gallery g1/g2/g3), `chuong-trinh/[program].astro` (before, after). Mỗi trang load getSlotImages(db) → resolveSlot.
- **Acceptance:** trang vẫn render đúng (fallback tĩnh khi slot_images trống); build pass.

### UI3.3 — Admin "Quản ảnh theo vị trí" (`/admin/anh-vi-tri`)
- Trang mới: gọi `buildSlots()` → liệt kê 67 slot, NHÓM theo `group` (Thương hiệu / Trang chủ / từng Cơ sở / từng Chương trình). Mỗi slot 1 dòng: label + **MediaPicker** (group lấy theo slot, value = slot_images.get(id)).
- POST: lưu mỗi `slot_id` → `setSlotImage`. Thêm tab "Ảnh theo vị trí" vào nav Admin.
- Hint rõ "đổi ảnh ở đây hiện ngay đúng chỗ trên web".
- **Acceptance:** mở trang thấy đủ slot có thumbnail + Chọn ảnh; đổi 1 slot → reload trang công khai tương ứng thấy đổi.

### UI3.4 — Đồng bộ hero cơ sở (bất nhất audit)
- Carousel trang chủ + trang chi tiết cơ sở CÙNG đọc 1 nguồn cho hero (resolveSlot `branch-<slug>-hero` hoặc branch.image_key — chọn 1, nhất quán). 
- **Acceptance:** đổi hero 1 cơ sở qua admin → cả carousel trang chủ lẫn trang chi tiết đổi.

### UI3.5 — Provision seed slot_images
- `provision.mjs` + `scripts/preview-seed.mjs`: seed `slot_images` từ file tĩnh đang có trong public/images (slot_id → key = chính path đó, vì ảnh đã ở R2). Để mặc định không trống.
- **Acceptance:** sau seed, slot_images có dòng cho các ảnh đã tồn tại.

### UI3.6 — Build + verify smoke
- `npm run build` pass. Verify: đổi 1 ảnh mỗi nhóm (gallery cơ sở, before/after chương trình, hero collage trang chủ) qua admin → trang công khai phản ánh.
- Cập nhật TASK3-PROGRESS.md.

## Ghi chú
- KHÔNG để slot nào lộ key/path cho người dùng (MediaPicker lo). Giữ fallback tĩnh để không vỡ khi slot trống. KHÔNG push. Vướng/lớn quá 1 vòng → NEEDS_HUMAN + liệt kê phần xong/chưa.


---

## Kết quả (claude)

Xong chủ nhân ạ. ✅ FITCITY-UI-3 hoàn tất, verify thật end-to-end.

🎯 Kết quả: 50 slot ảnh trước đây static → giờ TẤT CẢ 67 slot sửa được qua admin
• Thêm bảng D1 `slot_images` + helper `getSlotImages`/`setSlotImage`/`resolveSlot` (giữ fallback tĩnh, không vỡ khi trống)
• Wire lại 3 trang công khai (trang chủ collage/featured/pose, gallery cơ sở, before/after chương trình) + HeroCollage
• Trang adm

📄 File output: `/root/lucy/tasks/done/FITCITY-UI-3-output.md`
