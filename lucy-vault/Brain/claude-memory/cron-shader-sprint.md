---
name: cron-shader-sprint
description: "Cron runner Stylized Shader Kit — 1 sprint/lần, push GitHub, theo token-window"
metadata: 
  node_type: memory
  type: project
  originSessionId: 45c885c9-31bf-442f-814b-2f152058e777
---

Cron `cron_shader_sprint.sh` (đặt 2026-06-16, Bill chốt) — `/root/lucy/bridge/cron_shader_sprint.sh`, crontab `40 4 * * *` (CHỈ 04:40/ngày — Bill chốt 2026-06-16, bỏ các khung khác), log `/root/lucy/cron-shader.log`.

LOOP NHIỀU SPRINT/WINDOW (Bill chốt 2026-06-16): 1 window làm sprint này xong→sang sprint kế→... tới khi hết token/BLOCKED/hết sprint mới ngưng; MỖI sprint vẫn 1 call claude -p riêng (khỏi timeout). Closed loop: đọc state `/root/lucy/shader-sprint.state` (0→5, NUM_SPRINTS=6) → làm ĐÚNG 1 sprint qua `claude -p opus` (đọc spec `/root/lucy-workspace/stylized-shader-kit-spec.md` + memory [[unity-shader-version-gotchas]]) → git push repo `github.com/billtruong003/stylized-toon-world-kit` → notify Telegram → state++. Sprint 0=Nền(P0 core lib+repo+ShaderGUI base), 1=P1,2=P3,3=P2,4=P4,5=P5.
- Phát hiện "session limit" → KHÔNG advance state, cron sau chạy lại (chờ token hồi).
- GitHub: token `~/.git-credentials` (không echo); repo tạo qua API idempotent; local dir `/root/lucy-workspace/shader-kit`.
- Vì sao: sprint nhỏ khép kín tránh đốt token/timeout [[sig-2026-06-16-small-sprint-closed-loop]]. Học case mới → ghi gotchas memory.
- Token reset ~04:34 → cron 04:40 chạy tiếp. CHẠY TAY lần đầu 2026-06-16 ~01:10 (Bill bảo chạy luôn). Prompt RESUME-AWARE: mỗi lần đọc git log + file repo để biết đã làm tới đâu (kể cả sprint dở vì hết token) → tiếp tục phần còn thiếu, không làm lại. Hết token → ngưng, 04:40 chạy tiếp.

- ⚠️ GOTCHA (2026-06-16): chạy runner nền bằng Bash-background của phiên Lucy → BỊ GIẾT mỗi khi Bill nhắn tin mới (process con của phiên claude bị bridge thay). Phải chạy DETACHED: `setsid bash cron_shader_sprint.sh >> log 2>&1 </dev/null &` (session riêng, sống sót) HOẶC để cron 04:40 (độc lập). Sprint 0 xong nhờ cron; Sprint 1+ chạy tay phải setsid.


## ⚠️ DEPRECATED 2026-06-16 — CHUYỂN SANG auto-build.py
Bill chốt: build kiểu này (dự án repo riêng) PHẢI đi từ `auto-build.py` (pm2 lucy-autobuild, SDK, ĐỘC LẬP session — KHÔNG bị giết khi Bill nhắn tin; có can_use_tool guard + đo cost), KHÔNG tự chế runner `claude -p` (bị giết + thiếu guard). Shader kit giờ = mục **SK** trong MASTER-SPEC Phần V; chạy: `AUTOBUILD_FOCUS='SK...' pm2 start auto-build.py --name lucy-autobuild`. cron_shader_sprint.sh + cron 04:40 ĐÃ GỠ. Bài học: mọi build nhiều bước → auto-build.py, đừng tự chế.

## ✅ HOÀN TẤT 2026-06-16 — SK-0..SK-5 XONG HẾT
Tất cả 6 sprint xong (autobuild): SK-0 nền P0 Core (5 hlsl include + URPCompat + ShaderGUI base), SK-1 P1 Toon/Outline (6), SK-2 P3 VFX (7), SK-3 P2 Environment (7), SK-4 P4 Surface (6), SK-5 P5 Anime NPR (5: Body/FaceSDF/Hair/Eye/SkinSSS). **Tổng 31 shader pack + P0 Core**, package 0.6.0, commit local tới 4e99010. ⚠️ TẤT CẢ commit local CHƯA push (autobuild guard chặn `git push`) → Bill/cron push `github.com/billtruong003/stylized-toon-world-kit`. Research docs ở `lucy-vault/Reference/unity-urp/` (toon/vfx/environment/surface/anime-npr). Static-check sạch mọi sprint (chưa compile Unity thật — cần GameCI/Unity verify trước khi bán). Còn lại = đóng gói Gumroad/itch + demo scene + ảnh/gif (việc Bill/người).
