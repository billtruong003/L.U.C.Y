# FITCITY-2 Output — Thay emoji/glyph AI bằng SVG brand icon

**Status:** DONE  
**Commit:** bf1ef08  
**Build:** 30 trang, 0 error

---

## Tóm tắt việc đã làm

### T2.1 — Icon.astro (đã có sẵn)
- Component `src/components/Icon.astro` với 25 line-icon SVG tối giản, ăn `currentColor`
- Tên: growth, strength, gymnast, shield, boxing-glove, bolt, lotus, spine, balance, leaf, posture, target, sprout, chart, pin, clock, phone, gift, check, search, turtle, bow, xray, rocket, kid

### T2.2 — Social band (đã có sẵn)
- `index.astro` social band: 4 SVG brand icon FB/IG/YT/TikTok inline
- FB link: `https://www.facebook.com/profile.php?id=61573604414502` ✓
- IG/YT/TikTok: `href="#"` + `data-todo="link"` + comment TODO

### T2.3 — Benefits program (đã có sẵn)
- `program-content.ts` dùng `icon: IconName` (không còn emoji glyph)
- `[program].astro` dùng `<RoundIcon><Icon name={b.icon} /></RoundIcon>`

### T2.4 — Emoji dọn sạch
- Tất cả promo banner (`🎁`) → `<Icon name="gift">`
- `index.astro` line 105: `glyph="🕒"` → `<Icon name="clock">`
- `dang-ky.astro`: 3 RoundIcon glyph (📞📍🎁) → Icon phone/pin/gift; `✅` success → Icon check
- `☎` glyph trong dang-ky.astro và Footer.astro → removed
- `chi-nhanh/[slug].astro`: `🧑‍🏫` coach badge → `<Icon name="target">`
- Blog pages (index + slug): `glyph={p.data.heroEmoji}` → `<RoundIcon><Icon name={heroIcon} /></RoundIcon>`

### T2.5 — HeroCollage
- `🚀 Bứt tốc...` và `👦 Dành cho trẻ...` → plain text (emoji stripped)

### T2.6 — BoxingKid placeholder
- `index.astro` card BoxingKid: placeholder text `"Ảnh đang cập nhật"` (có camera icon từ MediaFrame)
- Slot `program-boxingkid` tồn tại trong admin (auto-generated từ programs.json)

### T2.7 — Logo + favicon
- Nav/Footer đã dùng `slotImg('images/brand/logo.webp')` logo thật (F-badge fallback giữ nguyên khi thiếu)
- `public/favicon.svg`: `🏃` emoji → FC monogram (forest #016F44 + lime #c3d500)

### T2.8 — Build + Grep acceptance
- `npm run build` → 30 trang, 0 error ✓
- Spec emoji list (T2.3/T2.4/T2.5): **0 files** ✓
- Social glyph `◎ ▶ ♪`: **0 files** ✓
- FB link `61573604414502`: **30 files** (footer trên mọi trang) ✓
- BoxingKid "đang cập nhật": **1 file** (index.html) ✓

---

## Files thay đổi (18 files, 43 insertions, 35 deletions)

- `public/favicon.svg` — FC monogram brand
- `src/components/Footer.astro` — bỏ ☎ glyph
- `src/components/HeroCollage.astro` — bỏ 🚀 👦 emoji chip
- `src/content/config.ts` — `heroEmoji` → `heroIcon` (z.string, default 'target')
- `src/content/blog/*.md` (8 files) — heroEmoji → heroIcon với tên Icon tương ứng
- `src/pages/index.astro` — import Icon, promo gift icon, clock RoundIcon
- `src/pages/chuong-trinh/[program].astro` — promo gift icon
- `src/pages/chi-nhanh/[slug].astro` — coach tag emoji → Icon
- `src/pages/dang-ky.astro` — import Icon, 3 RoundIcon slot, ✅→Icon, ☎ removed
- `src/pages/blog/index.astro` — import Icon, promo, heroIcon slot
- `src/pages/blog/[...slug].astro` — import Icon, promo, heroIcon slot (2 chỗ)

---

## Ghi chú
- KHÔNG push (guard chặn) — Bill push tay
- rive-demo.astro còn `🎬` nhưng là trang demo ngoài scope task
- Favicon PNG cũ (256x109) = logo wordmark, không dùng được làm square favicon → dùng SVG FC monogram thay
