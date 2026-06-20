---
name: jarvis-cockpit-theme-tokens
description: Jarvis Cockpit UI theme — token + utility class names cho hub/web (dùng ở T2-T6)
metadata: 
  node_type: memory
  type: project
  originSessionId: fa3bee79-4658-4e6d-a44d-e257a9b29736
---

T1/U0 (2026-06-15) lập nền theme "Jarvis Cockpit" cho hub/web. Các vòng UI sau (T2 nav+Cmd+K, T3 persona roster, T5 tab Kết nối, T6 tab Kỹ năng) PHẢI tái dùng, đừng tạo class mới:

- Màu Tailwind: `cyan` (chính), `gold` #f5b54a (live/thị trường/tiền), `rose` (danger). CSS vars: `--gold`/`--gold-rgb`/`--gold-hi`/`--gold-lo`, `--rose-rgb`, `--glass-*`.
- Glass panel: class `.glass` (+ `.glass-hi`, `.glass-hover`, `.glass-gold`). Nền glass-minimalism, backdrop-blur.
- Progressive disclosure: cha thêm `.reveal-host`, con thêm `.hover-reveal` (ẩn→hiện khi hover; `@media(hover:none)` tự hiện sẵn cho mobile/tap).
- Số/data: class `.num` (JetBrains Mono, tabular-nums). Font đã load ở index.html.
- Jarvis hero: `.arc-reactor` (lõi thở) + `.hud-ring`/`.hud-ring-rev`/`.hud-ring-gold` (vòng HUD xoay). Mẫu dùng: xem landing tab Bộ não (Memory.tsx overview).
- Bridge mở tab Tinh hà từ component khác: `openGalaxyTab()` trong galaxyFocus.ts (App + NeuralTab nghe, bỏ qua path). Tinh hà CHỈ còn ở tab brain/Tinh hà (đã gỡ khỏi Memory).

File: hub/web/src/index.css (tokens+utility), tailwind.config.js, index.html (font). Liên quan [[lucy-hub-ui-redesign]] [[lucy-hub-web-command-center]].
