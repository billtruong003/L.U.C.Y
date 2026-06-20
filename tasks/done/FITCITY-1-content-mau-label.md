---
id: FITCITY-1
title: Sửa nội dung + màu + label website FitCity (anh Quân)
priority: 1
tier: claude
model: sonnet
status: queued
---

# FITCITY-1: Sửa toàn bộ nội dung + màu + label website FitCity (yêu cầu anh Quân)

**Priority:** HIGH
**Project dir:** `/root/lucy-workspace/fitcity-web`
**Nguồn yêu cầu:** `Sửa nội dung cho anh Quân.docx` (đã đọc text + 18 ảnh nhúng 2026-06-19)
**Build:** Astro. Sau sửa source → rebuild + verify headless. CHỈ commit local (guard chặn push), KHÔNG push.

## Mục tiêu
1 lượt edit source + rebuild. Gom hết content/màu/text vì cùng đụng source.

## Việc cần làm (critical)

### 1. Màu thương hiệu (đụng TOÀN site — fix ở token màu)
- Site đang lime/vàng-chanh `#c3d500` ở heading/CTA/sub-label/link footer/icon "F" → SAI.
- Đổi hết sang: forest **#016F44** + cam **#EC6B25**. Sửa cả chỗ lỗi font về đúng 2 mã này.

### 2. Thuật ngữ "chi nhánh" → "cơ sở"
- "chi nhánh" → "Hệ thống cơ sở" (menu/section title).
- "Chi nhánh nổi bật" → "Cơ sở nổi bật"; "Khám phá chi nhánh" → "Khám phá ngay"; "Tất cả chi nhánh" → "Tất cả cơ sở". Bỏ mục "Xem chi nhánh".

### 3. Thay block "11 CHI NHÁNH" + card fake bằng 11 cơ sở THẬT
Tiêu đề → "Hệ thống cơ sở". Bỏ card fake (Cầu Giấy/Thanh Xuân/Đống Đa, Q1/3/7). Thay:
- CƠ SỞ CHÍNH:
  - Cs1: Tầng 2, tòa Tân Hoàng Minh - ngõ 30 Mai Anh Tuấn - Hoàng Cầu - P. Ô Chợ Dừa - Hà Nội
  - Cs2: Tầng 4 tòa nhà Việt Tiến - 458 Minh Khai - P. Vĩnh Tuy - Hà Nội
- CƠ SỞ NHƯỢNG QUYỀN:
  - Cs3: Căn Vành Khuyên 02B1 - khu Hoàng Thành Villas - Mỗ Lao - P. Đại Mỗ - Hà Nội
  - Cs4: Tầng 1 - C2 Vinhomes D'capitale - 119 Trần Duy Hưng - P. Yên Hòa - Hà Nội
  - Cs5: Căn 12A - Villa K7 Starlake Tây Hồ (đối diện chung cư 6th Element) - P. Xuân Đỉnh - Hà Nội
  - Cs6: Cổng chào khu A Geleximco Lê Trọng Tấn - P. Tây Mỗ - Hà Nội
  - Cs7: Ngã 4 Đào Hinh giao Mai Phúc - P. Phúc Lợi - Hà Nội (cạnh Vinschool Harmony)
  - Cs8: Shophouse Pz4 - 46, 47 lối vào TTTM Parking Zone 4 - KĐT Vinhomes SmartCity (mặt đường tàu) - P. Tây Mỗ - Hà Nội
  - Cs9: Shophouse 6 - Park 12 - TimesCity - Minh Khai - P. Vĩnh Tuy - Hà Nội
  - Cs10: Căn 10N08, ngõ 25 Hoàng Quán Chi - Dịch Vọng - P. Cầu Giấy - Hà Nội
  - Cs11: Villa 11 - Đường Đ5 Sài Gòn Pearl - P. Thạnh Mỹ Tây - Tp. HCM

### 4. Hero / slogan
- Trên: `HỆ THỐNG PHÒNG TẬP GYMKID ĐẦU TIÊN TẠI VIỆT NAM (SINCE 2017)`
- Logo: `FIT CITY` · Dưới: `CHUYÊN HUẤN LUYỆN VIÊN 1 KÈM 1`
- Slogan: `BỨT TỐC CHIỀU CAO - SỬA GÙ CHỈNH DÁNG` · `DÀNH CHO TRẺ TỪ 6 - 16 TUỔI`
- Nút: `Học thử miễn phí - Khám phá chương trình` (nút "Khám phá chương trình" trỏ section Chương trình).
- Block phụ: slogan `TẬP SỚM CAO SỚM` + text `Vận động khoa học, an toàn, không xâm lấn là nền tảng phát triển thể chất cho trẻ từ 6 đến 16 tuổi.`

### 5. Section chương trình (3 thẻ, tất cả 6-16 tuổi)
- Sub-title: `Mỗi chương trình thiết kế riêng theo độ tuổi, dẫn dắt bởi HLV 9+ năm kinh nghiệm vận động trẻ em.` (đang 7+ → 9+).
- 3 thẻ GymKid / Boxing Kid / PilatesKid (đang là GymKid/PilatesKid/Chỉnh tư thế), mỗi thẻ nút "Tìm hiểu ngay":
  - Gymkid (6-16) — "Vận động & phát triển chiều cao": Bài tập vận động như bật nhảy và tăng cường cơ bắp, hỗ trợ trẻ phát triển chiều cao và sự nhanh nhẹn một cách an toàn, khoa học theo từng độ tuổi.
  - Boxing Kid (6-16) — "Vận động & tăng cường nền tảng thể lực": Bài tập boxing thiết kế phù hợp theo độ tuổi, giúp trẻ nâng cao sức bền, cải thiện thể lực, phát triển sức mạnh toàn thân và rèn luyện phản xạ, tự vệ an toàn.
  - PilatesKid (6-16) — "Cột sống khoẻ & dáng đẹp": Bài tập giúp điều chỉnh cơ lõi, kéo giãn cột sống, cải thiện thăng bằng, nền tảng cho tư thế chuẩn.

### 6. Footer
- Cột trái: logo Fit City + `HỆ THỐNG PHÒNG TẬP GYMKID ĐẦU TIÊN TẠI VIỆT NAM (SINCE 2017)` + `CHUYÊN HUẤN LUYỆN VIÊN 1 KÈM 1` + `BỨT TỐC CHIỀU CAO - SỬA GÙ CHỈNH DÁNG` + `DÀNH CHO TRẺ TỪ 6 - 16 TUỔI` + nút `Đọc cẩm nang phụ huynh →`.
- Cột CHƯƠNG TRÌNH: Gymkid · Boxingkid · Pilateskid · Lịch học.
- Cột HỆ THỐNG CƠ SỞ: `FIT CITY HÀ NỘI` + `FIT CITY TP. HỒ CHÍ MINH` (trỏ section cơ sở).
- Cột LIÊN HỆ: Hotline `090.4554.333` (đang 1900 xxxx) · Email `fitcityofficial@gmail.com` (đang contact@fitcity.vn) · Facebook `https://www.facebook.com/profile.php?id=61573604414502`.

### 7. Dọn chung
- Thay mọi "5-16 tuổi" → "6-16 tuổi". Hotline trong phần chi tiết → 090.4554.333.

## Acceptance
- Grep source: không còn `#c3d500`, không còn "chi nhánh", không còn "5-16 tuổi", không còn email/hotline cũ.
- 11 cơ sở thật hiển thị đúng; 3 thẻ chương trình đúng tên + mô tả.
- Build Astro thành công, verify headless trang load không lỗi.
- Commit local (KHÔNG push).


---

## Kết quả (claude)

FITCITY-1 hoàn tất. Tóm tắt:

- **Màu:** `#c3d500` không còn trong source — token `lime=#EC6B25`, `forest=#016F44` đã đúng từ trước.
- **"Chi nhánh" → "cơ sở":** Sửa breadcrumb `/chi-nhanh/`, eyebrow "Cơ sở gần bạn", 8 blog posts đổi link text "cơ sở gần nhà/các cơ sở".
- **Programs:** `BoxingKid` thay `Chỉnh tư thế` trong bộ lọc timetable + `progColor`; AGES bỏ `5–8` → `6–8`; summary BoxingKid ti

📄 File output: `/root/lucy/tasks/done/FITCITY-1-output.md`
