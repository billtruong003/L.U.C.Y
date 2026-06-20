---
id: FITCITY-2
title: Thay sạch icon "AI làm" (emoji badge + social glyph) bằng SVG brand + asset thật
priority: 1
tier: claude
model: sonnet
status: queued
---

# FITCITY-2: Thay sạch icon "AI làm" bằng icon SVG brand + asset thật

**Priority:** HIGH
**Project dir:** `/root/lucy-workspace/fitcity-web`
**Build:** Astro. Mỗi sub-task xong → build lại + verify headless (`--force-prefers-reduced-motion` per gotcha cũ). CHỈ commit local (guard chặn push), KHÔNG push.

## Bối cảnh (đọc trước khi làm — tránh làm lại việc đã xong)
- Logo wordmark `public/images/brand/logo.webp` ĐÃ là logo THẬT (cam #EC6B25 + xanh #016F44 "FIT CITY"). KHÔNG đụng.
- Ảnh 3 chương trình + hero + branch ĐÃ seed ảnh thật từ web cũ (`scripts/seed-images.mjs`). KHÔNG đụng.
- Card chương trình ĐÃ refactor sang `MediaFrame` ảnh thật (không còn icon cartoon AI ở section đó).
- **Thứ CÒN "mùi AI" cần thay (đây là trọng tâm task này):**
  1. **Emoji nhét trong huy hiệu tròn `RoundIcon`** rải khắp site → nhìn như auto-gen, không pro.
  2. **Icon social chữ thô** `f ◎ ▶ ♪` ở `index.astro`, link chết `href:'#'`.

## Hướng design (mặc định — Lucy chốt, Bill redirect được)
- Giữ NGUYÊN layout huy hiệu tròn `RoundIcon` (bố cục đẹp), chỉ **thay phần ruột emoji → inline SVG line-icon đơn sắc** ăn `currentColor` (kế thừa màu brand forest/cam của badge). KHÔNG thêm thư viện icon (giữ build nhẹ) — tự vẽ path tối giản (stroke 1.5, 24x24).
- KHÔNG bịa ảnh/icon AI mới. Chỗ chưa có asset thật → placeholder rõ ràng + đánh dấu slot.

---

## Việc cần làm (chia nhỏ — làm tuần tự, mỗi cái build verify)

### T2.1 — Tạo component icon SVG (`src/components/Icon.astro`)
- Tạo 1 component nhận prop `name` + `class`, render inline `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">` với `<path>` tối giản.
- Bộ icon cần (phủ HẾT emoji đang dùng — xem T2.3/T2.4 để biết tên):
  `growth, strength, gymnast, shield, boxing-glove, bolt, lotus, spine, balance, leaf, posture, target, sprout, chart, pin, clock, phone, gift, check, search, turtle, bow, xray, rocket, kid`
- `RoundIcon.astro`: thêm khả năng nhận SVG qua slot (đã có `<slot/>`) — KHÔNG phá prop `glyph` cũ (để day-letter T2/T3 trong lịch học vẫn dùng chữ).
- **Acceptance:** `npm run build` pass; Icon.astro export đủ tên trên; render thử 1 icon ra `currentColor`.

### T2.2 — Social band thật (`src/pages/index.astro` dòng ~36–41, ~243–249)
- Thay 4 mục `{icon:'f'|'◎'|'▶'|'♪', href:'#'}` → inline SVG brand thật (Facebook/Instagram/YouTube/TikTok).
- Link: Facebook = `https://www.facebook.com/profile.php?id=61573604414502` (đã biết). IG/YouTube/TikTok = **CHƯA có** → để `href="#"` + thêm `data-todo="link"` + comment `<!-- TODO: link thật từ anh Quân -->` (KHÔNG bịa URL).
- **Acceptance:** dist không còn glyph `◎ ▶ ♪`; FB link đúng id; 3 link còn lại đánh dấu TODO rõ.

### T2.3 — Emoji benefits chương trình (`src/lib/program-content.ts`)
- 14 `glyph` emoji (📈💪🤸🛡️🥊⚡🧘🦴⚖️🌿🧍🎯🌱📊) → đổi sang tên Icon T2.1 tương ứng (vd 📈→growth, 🥊→boxing-glove, 🧘→lotus, 🦴→spine, 🛡️→shield, 📊→chart...).
- `chuong-trinh/[program].astro` dòng ~104: `RoundIcon` nhận Icon qua slot thay `glyph={b.glyph}`.
- Đổi type `Benefit.glyph` → `icon: IconName` cho khớp.
- **Acceptance:** 4 trang `/chuong-trinh/*` không còn emoji trong dist; badge giữ màu brand/lime/leaf/sky như cũ.

### T2.4 — Emoji contact / promo / blog hero
- `chi-nhanh/[slug].astro` (📍🕒📞 dòng ~51/56/60) → pin/clock/phone.
- `index.astro` promo 🎁 (dòng ~49) + featured 🕒 (dòng ~93) → gift/clock.
- `dang-ky.astro` (📞☎📍🎁✅) → phone/phone/pin/gift/check.
- `blog/index.astro` + `blog/[...slug].astro`: `heroEmoji` badge (🐢🙇🩻🔎🧍⚖️🧘💪) → map sang turtle/bow/xray/search/posture/balance/lotus/strength. Đổi field `heroEmoji` trong `content/config.ts` + 8 file `content/blog/*.md` sang `heroIcon: <name>` (giữ default an toàn).
- `Footer.astro` ☎ (dòng ~45) → phone.
- **Acceptance:** grep dist toàn bộ KHÔNG còn các emoji trên.

### T2.5 — HeroCollage dọn emoji (`src/components/HeroCollage.astro` dòng ~50–51)
- 🚀👦 → thay icon rocket/kid SVG hoặc bỏ hẳn nếu chỉ là trang trí thừa (ưu tiên gọn, không làm rối hero).
- **Acceptance:** hero không còn emoji; layout không vỡ (verify headless).

### T2.6 — BoxingKid: placeholder rõ ràng (KHÔNG bịa ảnh)
- `images/programs/boxingkid.webp` CHƯA có (chủ ý) → MediaFrame đang hiện placeholder `Ảnh lớp BoxingKid — chờ ảnh thật`.
- Làm placeholder "pro" hơn: nền `bg-night-card` + icon boxing-glove (T2.1) + chữ `Ảnh đang cập nhật`, KHÔNG để khoảng trống trơ.
- Giữ slot `program-boxingkid` trong `admin/slots.js` để dashboard up ảnh thật sau (kiểm tra slot đã tồn tại — slots.js dựng từ programs.json nên tự có).
- **Acceptance:** card BoxingKid hiện placeholder có icon + chữ, không trống; slot tồn tại trong catalog admin.

### T2.7 — Logo + favicon thật, bỏ phụ thuộc F-badge
- Verify `Nav.astro` + `Footer.astro` đang dùng `slotImg('images/brand/logo.webp')` (logo thật) — F-badge chỉ là fallback khi thiếu logo; logo đang CÓ nên fallback không hiện. OK thì giữ.
- `public/favicon.svg`: nếu đang là chữ "F" tự vẽ / generic → thay bằng favicon thật web cũ (`fit-favicon` ladicdn, nguồn trong `fitcity-oldsite-assets.md`). Nếu tải lỗi → giữ nguyên + ghi TODO.
- **Acceptance:** favicon load 200; nav/footer hiện wordmark thật (không phải badge F).

### T2.8 — Build + verify + acceptance grep
- `npm run build` → 30 trang, 0 error.
- Headless verify 3 trang chính (`/`, `/chuong-trinh/gymkid`, 1 trang `/chi-nhanh/<slug>`) với `--force-prefers-reduced-motion`.
- **Grep acceptance (phải PASS hết):**
  - `0` emoji trong `dist/**/*.html` (scan dải emoji ở list T2.3/T2.4/T2.5).
  - `0` glyph social `◎ ▶ ♪` trong dist.
  - FB link đúng `61573604414502` trong footer + social band.
  - Card BoxingKid có placeholder (text "đang cập nhật" hoặc icon).
  - Build 30 trang 0 error.

---

## Ghi chú execute
- Mỗi sub-task = 1 đơn vị commit local riêng (dễ rollback). Đừng gộp 1 commit khổng lồ.
- KHÔNG push (guard chặn) → Bill push tay.
- Asset từ web cũ ladicdn: danh sách URL ở `/root/lucy-workspace/fitcity-oldsite-assets.md`.
- Màu brand: forest `#016F44`, cam `#EC6B25` (token đã có trong tailwind/global.css).


---

## Kết quả (claude)

---

**FITCITY-2 DONE** — commit `bf1ef08`.

Tóm tắt kết quả:

- **18 files** thay đổi, build **30 trang 0 error**
- **Tất cả spec emoji sạch:** 0 emoji từ list T2.3/T2.4/T2.5 trong dist (scan targeted), 0 social glyph `◎ ▶ ♪`
- **Social band:** 4 SVG brand icon thật (FB link đúng `61573604414502`, 3 link TODO marked)
- **Blog heroEmoji → heroIcon:** 8 .md files + config.ts + cả blog/index + blog/

📄 File output: `/root/lucy/tasks/done/FITCITY-2-output.md`
