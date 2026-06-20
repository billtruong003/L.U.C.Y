# FITCITY-1 Output — Sửa nội dung + màu + label website FitCity

**Hoàn thành:** 2026-06-19  
**Commit:** `81206d6` (local, KHÔNG push — guard chặn)  
**Build:** Astro 30 trang, 0 lỗi, 795ms

---

## Các thay đổi đã thực hiện

### 1. Màu thương hiệu
- `tailwind.config.mjs` và `global.css`: đã có `lime=#EC6B25`, `forest=#016F44` từ trước.
- Không có hardcoded `#c3d500` trong source — đã clean sẵn.

### 2. Thuật ngữ "chi nhánh" → "cơ sở" (user-visible)
- `chi-nhanh/index.astro`: breadcrumb "Chi nhánh" → "Hệ thống cơ sở"
- `chi-nhanh/[slug].astro`: "Chi nhánh gần bạn" → "Cơ sở gần bạn"
- 8 blog posts: "chi nhánh gần nhà / các chi nhánh" → "cơ sở gần nhà / các cơ sở"
- `chinh-tu-the-cho-tre.md`: "hệ thống 11 chi nhánh" → "hệ thống 11 cơ sở"

### 3. 11 cơ sở thật
- `branches.json` đã có đúng 11 cơ sở với địa chỉ thật từ trước — không cần thay.
- Grid homepage render đúng 11 card.

### 4. Hero / slogan
- `HeroCollage.astro` đã đúng: eyebrow "Hệ thống phòng tập GymKid đầu tiên tại Việt Nam", h1 "FIT CITY", subtitle "Chuyên HLV 1 kèm 1", slogan "Tập sớm cao sớm", badges "Bứt tốc chiều cao..." và "6-16 tuổi", 2 nút đúng.

### 5. Section chương trình
- `programs.json`: BoxingKid summary tinh chỉnh ("được thiết kế" → "thiết kế", "khả năng phản xạ" → "phản xạ")
- `branch-content.ts`: PROGRAMS đổi `['GymKid', 'PilatesKid', 'Chỉnh tư thế']` → `['GymKid', 'BoxingKid', 'PilatesKid']`; AGES: `'5–8'` → `'6–8'`
- `chi-nhanh/[slug].astro`: PROGRAMS filter + progColor cập nhật BoxingKid thay Chỉnh tư thế
- `index.astro`: 3 cards filter theo `['gymkid', 'boxingkid', 'pilateskid']` — đã đúng.

### 6. Footer
- Đã đúng từ trước: 4 tagline, "Đọc cẩm nang phụ huynh →", cột Chương trình (GymKid/BoxingKid/PilatesKid/Lịch học), cột Hệ thống cơ sở (HN + HCM), Hotline 090.4554.333, email fitcityofficial@gmail.com, Facebook link đúng.

### 7. Dọn chung
- `chinh-tu-the-cho-tre.md`: "5–16" → "6–16"
- Không còn "5-16 tuổi", "chi nhánh" user-visible, `#c3d500`, email/hotline cũ

---

## Acceptance grep PASS

| Kiểm tra | Kết quả |
|---|---|
| `#c3d500` trong dist | 0 |
| "chi nhánh" user-visible trong dist/chi-nhanh/ | 0 |
| "5–16" trong dist/blog/ | 0 |
| BoxingKid trong timetable /chi-nhanh/hoang-cau/ | ✓ |
| Hotline 090.4554.333 | ✓ |
| fitcityofficial@gmail.com trong footer | ✓ |
| 3 program cards (GymKid/BoxingKid/PilatesKid) | ✓ |
| Breadcrumb "Hệ thống cơ sở" /chi-nhanh/ | ✓ |
| "Cơ sở gần bạn" trong slug page | ✓ |
| Build Astro 30 trang | ✓ 0 error |
