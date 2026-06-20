---
id: FITCITY-2B
title: Gắn logo official qua SLOT + favicon/og bỏ lime + quét "chi nhánh" sót (phần CÒN THIẾU của TASK 2)
priority: 1
tier: claude
model: sonnet
status: queued
---

# FITCITY-2B — Gắn logo official (slot-based, tương thích admin TASK 3) + favicon + dọn nốt

**Project dir:** `/root/lucy-workspace/fitcity-web` (Astro).
**Build:** mỗi đầu việc xong → `npm run build` + verify headless (`--force-prefers-reduced-motion`). CHỈ commit local (guard chặn push), KHÔNG push.
**Context đã verify đầy đủ:** `/root/lucy-workspace/fitcity-context-verified.md` — ĐỌC TRƯỚC.

## ⚠️ Ràng buộc kiến trúc (QUAN TRỌNG — đọc kỹ)
Logo PHẢI lắp qua hệ **SLOT** (`admin/slots.js` + `slotImg()`), KHÔNG hardcode đường dẫn ảnh.
Lý do: TASK 3 sắp tới là admin dashboard cho anh Quân tự thay **logo + text + ảnh** theo slot.
Logo gắn sai cách (hardcode) → admin không quản được → TASK 2 coi như đi sai. Mọi ảnh logo = 1 slot trong `slots.js`, file `.webp` dưới `public/images/...`, admin upload ghi đè theo id (đúng convention ảnh hiện có).

## Nguồn logo (đã XEM tận mắt, xác nhận màu/nền)
`/root/lucy/assets/fitcity-logo-official/` — 7 PNG RGBA trong suốt, 4188px rộng:
- **logo-06** = "FIT" khối forest chữ trắng + "CITY" forest, nền trong → HEADER nền sáng (chính).
- **logo-07** = "FIT CITY" toàn chữ forest, nền trong → header gọn (dự phòng).
- **logo-02** = logo TRẮNG toàn bộ, nền trong → FOOTER nền tối (chữ trắng nổi trên forest).
- logo-01 = badge nền forest đặc (FIT cam) — KHÔNG dùng cho footer (nền forest sẽ chìm).
- Convert PNG→webp theo pattern `scripts/seed-images.mjs` (sharp), resize ~maxW slot (512). Reproducible.

---

## Việc cần làm (6 đầu việc — tuần tự, mỗi cái build verify, commit local riêng)

### T2B.1 — Slot logo header (giữ `brand-logo`) seed bằng logo-06
- Convert `logo-06.png` → `public/images/brand/logo.webp` (resize ~512px rộng, giữ tỉ lệ 256/109-ish, nền trong).
- Slot `brand-logo` trong `admin/slots.js` GIỮ NGUYÊN (file `images/brand/logo.webp`) — chỉ thay nội dung file.
- `Nav.astro` đang `slotImg('images/brand/logo.webp')` → giữ. Verify header hiện logo-06 thật.
- **Acceptance:** header render logo-06 (FIT khối forest), không phải badge F; build pass.

### T2B.2 — Slot logo footer MỚI `brand-logo-dark` seed bằng logo-02 (trắng)
- Convert `logo-02.png` → `public/images/brand/logo-dark.webp`.
- Thêm slot vào `admin/slots.js` (nhóm "Thương hiệu", sau `brand-logo`):
  `{ id: 'brand-logo-dark', label: 'Logo FitCity (nền tối)', group: 'Thương hiệu', ratio: '256/109', maxW: 512, file: 'images/brand/logo-dark.webp' }`
- `Footer.astro`: đổi `slotImg('images/brand/logo.webp')` → `slotImg('images/brand/logo-dark.webp')`. Giữ block fallback (nhưng xem T2B.4).
- **Acceptance:** footer hiện logo TRẮNG nổi rõ trên nền tối; slot `brand-logo-dark` có trong catalog admin (`node -e` gọi buildSlots() thấy id mới); build pass.

### T2B.3 — Favicon + OG bỏ lime, dựng từ brand official
- `public/favicon.svg`: thay badge chữ "FC" fill `#c3d500` → favicon mới dựa logo-06 (khối "FIT" forest `#016F44`, chữ trắng). KHÔNG còn lime. Giữ dạng SVG (favicon là asset tĩnh, không qua slot ảnh raster).
- `public/og-cover.svg`: 2 chỗ fill `#c3d500` → forest `#016F44` / cam `#EC6B25` cho đúng brand.
- **Acceptance:** grep `c3d500` trong `public/` = 0; favicon load 200, màu forest.

### T2B.4 — Fallback F-badge bỏ lime
- `Nav.astro` + `Footer.astro`: block fallback khi thiếu logo đang dùng `bg-lime` / `text-lime` (màu SAI). Đổi sang forest `#016F44` + cam `#EC6B25` (hoặc class tương ứng). Logo đang có nên fallback không hiện, nhưng phải sạch lime để không lệch brand.
- **Acceptance:** grep `lime` trong Nav.astro + Footer.astro = 0 (hoặc chỉ còn nếu là tên khác); build pass.

### T2B.5 — Quét "chi nhánh" display còn sót → "cơ sở" (theo mapping 1.2 doc gốc)
- Nguồn mapping: `fitcity-sprint-sua-noi-dung-anhQuan.md` mục 1.2:
  - Section title "chi nhánh" → "Hệ thống cơ sở"; "Chi nhánh nổi bật" → "Cơ sở nổi bật"; "Khám phá chi nhánh" → "Khám phá ngay"; "Tất cả chi nhánh" → "Tất cả cơ sở"; bỏ "Xem chi nhánh".
- CHỈ sửa text HIỂN THỊ (render ra dist). GIỮ comment code + tên biến/route slug `chi-nhanh` (không đổi URL).
- Cách làm: grep "chi nhánh" trong `src/`, soi TỪNG chỗ là display hay comment, sửa display.
- **Acceptance:** grep "chi nhánh" (có dấu, dạng text hiển thị) trong `dist/**/*.html` giảm còn 0 ở các vị trí display theo mapping; route `/chi-nhanh/` KHÔNG đổi; build 30 trang.

### T2B.6 — Build + verify + acceptance tổng
- `npm run build` → 30 trang, 0 error.
- Headless verify 3 trang (`/`, footer rõ logo trắng, `/chi-nhanh/<slug>`) với `--force-prefers-reduced-motion`.
- **Grep acceptance (PASS hết):**
  - `0` lime `#c3d500` trong toàn `public/` + `dist/`.
  - Header dùng logo-06, footer dùng logo-dark (logo-02 trắng).
  - Slot `brand-logo-dark` tồn tại trong `buildSlots()`.
  - Favicon không còn chữ "FC" badge lime.
  - Build 30 trang 0 error.

---

## Ghi chú execute
- Mỗi đầu việc = 1 commit local riêng (dễ rollback). KHÔNG gộp 1 commit.
- KHÔNG push (guard chặn) → Bill push tay.
- Convert ảnh: tái dùng `scripts/seed-images.mjs` (sharp) — reproducible, đừng tải mới.
- Màu brand chuẩn: forest `#016F44`, cam `#EC6B25`. Lime `#c3d500` = SAI, phải sạch.
- Logo qua SLOT để admin TASK 3 thay được — KHÔNG hardcode.


---

## Kết quả (claude)

---

**FITCITY-2B xong.** Tóm tắt 5 dòng:

1. **Logo header** (logo-06 FIT forest+trắng) → `public/images/brand/logo.webp` qua slot `brand-logo` — Nav.astro tự dùng.
2. **Logo footer** (logo-02 trắng) → `public/images/brand/logo-dark.webp`, slot mới `brand-logo-dark` trong `admin/slots.js`, Footer.astro đã trỏ sang slot mới.
3. **Favicon** đổi badge "FC" lime → FIT/CITY forest/cam; **og-cover.svg*

📄 File output: `/root/lucy/tasks/done/FITCITY-2B-output.md`
