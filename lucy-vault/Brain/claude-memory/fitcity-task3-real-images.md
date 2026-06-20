---
name: fitcity-task3-real-images
description: FitCity TASK-3 — ảnh + content THẬT từ web cũ đổ vào public/images theo slot; seed-images.mjs reproducible
metadata: 
  node_type: memory
  type: project
  originSessionId: 207afb55-f008-408d-9fac-a8ef98e80471
---

FitCity TASK-3 DONE (2026-06-17, push `2d41c15`): đổ ẢNH THẬT làm placeholder từ web FitCity CŨ (ladicdn), KHÔNG Drive (creds chưa wire).

- Nguồn ảnh: `/root/lucy-workspace/fitcity-oldsite-assets.md` (60 URL ladicdn + content text). Tải bằng `curl -L -A Mozilla` (hotlink OK, không bị chặn).
- `scripts/seed-images.mjs` (reproducible): tải `/tmp/fc-src/src_<key>` → sharp resize maxW + `webp(q82)` → `public/images/` ĐÚNG **62 path slot** theo `admin/slots.js` (import `buildSlots`). EXPLICIT map cho home/program slot + POOL_HERO/POOL_GAL cycle cho 11 chi nhánh. Chọn ảnh hợp ngữ cảnh qua montage-review (sharp composite grid → Read ảnh) — loại ảnh text/graphic (vd `train1`/`449037790` thực ra là screenshot testimonial, KHÔNG phải ảnh tập).
- `src/lib/images.ts` `slotImg(file)`: phân giải build-time bằng `existsSync` trong `public/`, trả URL base-aware (`import.meta.env.BASE_URL`) → chạy đúng cả preview subpath `/reports/fitcity-preview`; thiếu file → undefined → MediaFrame hiện placeholder. Path `src` trùng `admin/slots.js` ⇒ dashboard up ảnh khách GHI ĐÈ khớp.
- Wired: HeroCollage 6 tile, index featured+proof+carousel bg, chi-nhanh hero+gallery, chuong-trinh lớp+đo trước/sau, `branches.json images[]`→slot hero, tagline "Bứt tốc chiều cao · Làm đẹp vóc dáng".
- ⚠️ `logo-512` URL = icon Messenger (hỏng) → giữ F-badge, KHÔNG dùng làm logo. Ảnh khách thật + Drive creds vẫn để Bill.
- Verify ảnh headless: chrome cần `--force-prefers-reduced-motion` (site `[data-reveal]` opacity:0 chờ IntersectionObserver, không có flag thì screenshot trắng nội dung). Browser binary: `/root/.cache/ms-playwright/chromium-1223/chrome-linux64/chrome --headless=new`.

Liên quan: [[fitcity-client-project]] · [[fitcity-autobuild-push-guard]]
