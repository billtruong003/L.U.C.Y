---
title: "UI Refactor — SPRINTS (execute, theo R1 'A+')"
date: 2026-06-15
author: Lucy
status: done
parent: 2026-06-15-R1-ui-overhaul-research.md
---

# UI Refactor — Sprints execute

> Bám khuyến nghị R1 = **"A+"**: khung Cockpit 3 cột (calm, work mọi nơi) + 1 trang chủ Reactor kiểu Jarvis (hero 1 chỗ, ring map metric thật) + kỷ luật perf/a11y xuyên suốt. Theme "Jarvis Cockpit" (token cyan/gold/dark + .glass/.hover-reveal/.num/.arc-reactor/.hud-ring đã có từ T1). Thứ tự R1: Phase 0 → 1 → 3 → 2 → 4. Detail từng E-task ở R1 mục 9.

## S1 — Nền tảng token + a11y (Phase 0) ⭐ PHẢI XONG TRƯỚC ✅ DONE (2026-06-15)
- ✅ E0.1 design tokens — giữ Tailwind v3 (repo đang v3.4.17, không migrate v4 để khỏi rủi ro): CSS-variable token ở `:root` là single source; thêm `--glass-solid/-hi` (fallback đặc) + thang `--space-*`. Class .glass/.hover-reveal/.num/.arc-reactor/.hud-ring đã map token từ T1.
- ✅ E0.2 switch toàn cục: media-query `prefers-reduced-motion` / `prefers-reduced-transparency` / `prefers-contrast` trong index.css + class `.reduce-fx` (fx.ts, initFx() ở main.tsx) + toggle "Giảm hiệu ứng" trong Settings (localStorage `lucy.reduceFx`). reduce-fx: tắt animation/transition, glass→nền đặc, gỡ mọi backdrop-blur.
- ✅ E0.3 contrast: glass-bg đặc-hoá khi reduce-transparency (--glass-solid #0c1626 trên nền tối → ≥4.5:1); prefers-contrast nâng --line/--inkfaint/--inkdim.
- Verify: tsc 3 pkg sạch · build web OK · reduce-fx/prefers-* có trong dist CSS · lucy-hub restart HTTP 200.

## S2 — Khung Cockpit 3 cột (Phase 1) ✅ DONE (2026-06-15)
- ✅ E1.1 inverted-L: nav dọc Spaces (gom nhóm, dịu) + header + work area — đã có từ T2/U3, giữ nguyên.
- ✅ E1.2 chat trung tâm cap 768px (max-w-3xl) + composer neo đáy + "jump to latest": auto-scroll CHỈ khi đang ở đáy (atBottom, ngưỡng 80px), nút nổi "↓ tin mới nhất" khi cuộn lên đọc lịch sử.
- ✅ E1.3 Cmd+K palette (điều hướng tab + jump dự án) — tái dùng CommandPalette T2/U3, không tạo mới.
- ✅ E1.4 HUD panel phải context-aware (HudRail.tsx): header theo Space hiện tại + "Đang chạy" (lane inFlight/queued/card mở — số THẬT từ amConfig/amState) + Activity Feed THẬT (amState.channels, poll 6s, relTime); gập được (persist localStorage `lucy.hud.collapsed`), dải dọc khi gập.
- ✅ E1.5 responsive: bottom bar mobile (`md:hidden`, 4 Space chính + Menu, safe-area-inset) · HUD panel phải → sheet trượt (`lg:hidden`, nút 📡 ở header) · hover→tap qua `.reveal-host`/`@media hover`.
- Verify: tsc 3 pkg sạch · build web OK · lucy-hub restart HTTP 200 · bundle served khớp build mới.

## S3 — Đại tu từng khu (Phase 3) ✅ DONE (2026-06-15)
- ✅ E3.1 Galaxy: render PAUSE khi tab ẩn (`if(!r.visible) return` trong tick → 0 draw-call khi không xem), cap `pixelRatio=min(dpr,2)`, autoRotate tắt khi ẩn/đang kéo slider, dispose-on-unmount + removeChild, mount-once (giữ WebGL context khi đổi Live⟷Galaxy). Đã đạt từ T-trước, giữ nguyên. (2D fallback non-WebGL = defer S5).
- ✅ E3.2 Persona: master-detail grid (RPG hero roster: arc-reactor avatar + kind/model/lane badge + tags) + inline character-sheet edit (system prompt · tool override · maxTurns/timeout) + auto-route consult + chat panel. Đạt spec, giữ nguyên.
- ⏳ E3.3 Dashboard: KPI band/cost/providers/agent-insights ĐÃ có; sparkline + time-range (7d/24h/30d) = DEFER (Dashboard.tsx 841 dòng, thêm time-series rủi ro cao → tách vòng riêng, không gộp vào S3).
- ✅ E3.4 Task pipeline → KANBAN: 2 cột theo status (Đang chạy · Hoàn tất) + count badge, card mở → kết quả live (poll) Markdown, "↻ Chạy lại" phát lại prompt (giữ tier model). Hub job chỉ running/done nên không cột 'failed' giả.
- ✅ E3.5 MCP (Connect): tách nhóm **Đang kết nối** (live) vs **Có sẵn** (chờ bật/creds) + status badge + scope/creds chip + hướng dẫn bật. Revoke/manage = env-flag ở worker (read-only UI, không toggle giả).
- ✅ E3.6 Skills: grid card + grouping (Lucy nội bộ / Thư viện / Đề xuất chờ duyệt) + search bỏ-dấu. Toggle = move thủ công (proposed không vào INDEX), read-only đúng thiết kế. Đạt spec, giữ nguyên.
- Verify: tsc 3 pkg sạch · build web OK (index-BuJQ6QsZ.js) · lucy-hub restart HTTP 200 · bundle served khớp.

## S4 — Trang chủ Reactor (Phase 2, liều B — hero Jarvis) ⚠️ gu-nhạy → flag-gated ✅ DONE (2026-06-15) — chờ chủ nhân duyệt vibe
- ✅ E2.1 arc-reactor hero (`ReactorHome.tsx`) + 3 vòng đo **map metric THẬT**: lõi reactor = chi phí ngày ($), vòng token (token-guard used/hardLimit, đỏ khi chạm ngưỡng), vòng lane (inFlight/maxLanes), vòng card (cardsRunning/cardsTotal). RingGauge SVG fill thật theo pct; metric chưa có ngưỡng → chỉ hiện số, không vẽ cung (không bịa). Vòng `.hud-ring` spin trang trí tự tắt qua reduce-fx/prefers-reduced-motion (no-motion-first, arc-breathe 3.4s ≤3 flash/s). Honest caption: feed thị trường ở Telegram, chưa nối Hub. Poll 8s CHỈ khi visible.
- ✅ E2.2 radial entry — grid 6 Space chính (chat/memory/brain/workspace/tasks/dashboard) `onNavigate(pick)`.
- ✅ FLAG-GATED: localStorage `lucy.reactorHome` (mặc định **TẮT** → app y nguyên dashboard). Bật ở Settings (toggle "Trang chủ Reactor ⚛️" → reload). Khi bật: chèn tab `reactor` đầu nhóm Tổng quan + làm tab mặc định. Tái dùng class T1 `.arc-reactor/.hud-ring/.glass/.num` — KHÔNG theme mới.
- Verify: tsc 3 pkg sạch · build web OK (index-DXerpPu7.js) · lucy-hub restart HTTP 200 · bundle served khớp · flag OFF mặc định = an toàn.
- ⏭️ Chủ nhân: bật toggle ở Settings để xem vibe, OK thì để mặc định bật.

## S5 — Perf hardening + QA (Phase 4) ✅ DONE (2026-06-15)
- ✅ E4.1 giảm tải render: pixelRatio cap `min(dpr,2)` (giữ từ S3) + **render-on-demand** khi giảm chuyển động — `reduceMotion` (OS `prefers-reduced-motion` HOẶC toggle `reduce-fx`) → tắt auto-rotate + đóng băng cuộn shader/sao, chỉ vẽ frame khi còn animation/tương tác (`wake()` bơm `renderUntil` cho born ~1.7s · pulse recall ~2.7s · hover/cfg/edge ~0.42s · damping camera qua event `change`). Idle + reduce = 0 draw-call. Lớp backdrop-blur (search/slider/cfg/note) bị gỡ hẳn ở `reduce-fx` (CSS S1) cho máy yếu. Listener `matchMedia('change')` + `MutationObserver` class `<html>` → đổi gu live không cần reload.
- ✅ E4.2 timeline drag không lag (đã throttle qua `requestAnimationFrame` trong `scrub()`, applyFilter chỉ đổi visibility + alpha attribute — không re-layout) + touch (OrbitControls + canvas `touch-action:none`) + **2D fallback non-WebGL** (defer từ S3): `hasWebGL()` false → render `Galaxy2D.tsx` — canvas 2D vẽ hành tinh (note thật) + đường sao + cụm theo zone, pan/zoom/hover/click mở note, render-on-demand (chỉ vẽ khi `dirty`), badge "🛰️ chế độ 2D".
- ✅ E4.3 a11y pass: focus-visible ring cyan (chỉ keyboard, nâng width/contrast ở `prefers-contrast`) + `.sr-only` util trong index.css · aria-label cho mọi nút icon-only (galaxy: recall/bỏ-focus/về-giờ/núm-vặn/đóng-note + `aria-expanded` + slider `aria-label`/`aria-valuetext`; App: menu/tạo-dự-án/xoá-dự-án) · reduced-motion honor cả galaxy (E4.1) lẫn `.hud-ring`/`.arc-reactor` (CSS S1) · contrast đa điều kiện (`prefers-contrast`/`reduce-fx` nâng `--line`/`--inkfaint`/focus ring — S1).
- Verify: tsc 3 pkg sạch · build web OK (index-BXy45db1.js · index-C4u_wqEa.css) · lucy-hub restart HTTP 200 · bundle served khớp build mới.

## LUẬT execute (tự động)
Mỗi sprint: tsc 3 pkg + build web + smoke liên quan SẠCH → deploy hub → cập nhật ✅. KHÔNG restart lucy-bridge · KHÔNG git push/xoá data · mọi thay đổi lớn flag-gated (nhất là S4 Reactor) để revert nếu lệch gu · fail không fix nổi → ghi + sang sprint kế. Cuối → rehost + báo Telegram. S4 (hero) báo riêng để chủ nhân duyệt vibe trước khi để mặc định.
