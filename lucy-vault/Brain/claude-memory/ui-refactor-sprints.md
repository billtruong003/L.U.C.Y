---
name: ui-refactor-sprints
description: "UI overhaul \"A+\" execute theo UI-REFACTOR-SPRINTS.md — S1-S5 XONG HẾT, Tailwind giữ v3 (KHÔNG migrate v4)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 0ac14afa-e0af-4dfb-85ff-50a18d32448a
---

Đợt đại tu UI Hub theo `/root/lucy/docs/UI-REFACTOR-SPRINTS.md` (hướng "A+": Cockpit 3 cột + trang chủ Reactor). Làm TUẦN TỰ 1 sprint/vòng: S1 token+a11y → S2 khung Cockpit 3 cột → S3 đại tu từng khu → S4 Reactor (flag-gated, cần Bill duyệt vibe) → S5 perf/a11y QA.

**Quyết định cứng:** repo `hub/web` đang **Tailwind v3.4.17** — GIỮ v3, KHÔNG migrate v4 `@theme` (spec gốc gợi v4 nhưng migrate = rủi ro). Single source token = CSS variables ở `:root` của `hub/web/src/index.css` + map sang `tailwind.config.js`.

**S1 ✅ (2026-06-15):** a11y switches trong index.css (`prefers-reduced-motion`/`-transparency`/`-contrast`) + class `.reduce-fx` (`hub/web/src/fx.ts`, `initFx()` ở main.tsx) + toggle "Giảm hiệu ứng" trong Settings (localStorage `lucy.reduceFx`). reduce-fx = tắt animation + glass→`--glass-solid` + gỡ backdrop-blur. Theme Jarvis Cockpit, tái dùng class T1 `.glass/.hover-reveal/.num/.arc-reactor/.hud-ring` — ĐỪNG tạo theme mới.

**S2 ✅ (2026-06-15):** khung Cockpit 3 cột. E1.1 inverted-L đã có (T2/U3). E1.2 chat: auto-scroll chỉ khi atBottom + nút "↓ tin mới nhất" (Chat.tsx). E1.3 Cmd+K tái dùng CommandPalette. E1.4 **HudRail.tsx** = cột phải context-aware. E1.5 bottom bar mobile + HUD → sheet (`lg:hidden`, nút 📡).

**S3 ✅ (2026-06-15):** đại tu từng khu. E3.4 **Tasks→KANBAN** (2 cột running/done + count + "↻ Chạy lại" phát lại prompt giữ tier model — hub job chỉ running/done nên không cột failed giả). E3.5 **Connect** tách nhóm "Đang kết nối"(live)/"Có sẵn"(chờ creds), ServerCard tách hàm. E3.1 Galaxy (pause-khi-ẩn + pixelRatio cap + dispose), E3.2 Persona (hero roster + inline edit), E3.6 Skills (grid+grouping) — ĐÃ đạt từ trước, giữ nguyên + mark done. **E3.3 Dashboard sparkline+time-range = DEFER** (841 dòng, rủi ro, tách vòng riêng). KẾ: **S4 Trang chủ Reactor — FLAG-GATED, cần chủ nhân duyệt vibe** (arc-reactor hero + HUD ring map metric thật, no-motion-first); rồi S5 perf/a11y QA.

**S5 ✅ (2026-06-15) — SPRINT CUỐI, đại tu UI HOÀN TẤT:** perf/a11y QA. E4.1 **render-on-demand** trong Galaxy.tsx khi `reduceMotion` (OS prefers-reduced-motion HOẶC reduce-fx) — tắt auto-rotate + đóng băng shader/sao, chỉ vẽ khi còn animation/tương tác (helper `wake()` bơm `renderUntil`; damping qua event `change`; listener matchMedia + MutationObserver class `<html>` đổi gu live). E4.2 **2D fallback non-WebGL** = `hub/web/src/components/Galaxy2D.tsx` (canvas 2D, pan/zoom/hover/click, render-on-demand) khi `hasWebGL()` false; timeline drag đã throttle rAF từ trước. E4.3 a11y: focus-visible ring cyan (keyboard-only, nâng ở prefers-contrast) + `.sr-only` trong index.css + aria-label mọi nút icon-only (Galaxy + App). Build: index-CJC-etE8.js.

Luật mỗi sprint: tsc 3 pkg (agent-machine + hub/server + hub/web) + build web + smoke sạch → `pm2 restart lucy-hub` (TUYỆT ĐỐI KHÔNG lucy-bridge) → verify HTTP 200 → cập nhật ✅ doc.
