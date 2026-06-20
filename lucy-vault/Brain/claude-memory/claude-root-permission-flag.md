---
name: claude-root-permission-flag
description: claude CLI 2.1.173+ cấm bypassPermissions/--dangerously-skip-permissions khi chạy ROOT → dùng --allowedTools thay
metadata: 
  node_type: memory
  type: reference
  originSessionId: dfefdf60-3a56-4920-a80e-b4fece057360
---

**Gotcha (phát hiện 2026-06-15, claude CLI 2.1.173):** chạy `claude -p` bằng **root** với `--permission-mode bypassPermissions` (hoặc `--dangerously-skip-permissions`) → lỗi *"--dangerously-skip-permissions cannot be used with root/sudo privileges for security reasons"*. Output bị thay bằng dòng lỗi đó (vd cron brief ra report rỗng "3 tab lỗi").

**Fix:** thay bằng `--allowedTools "Bash WebSearch WebFetch Read Glob Grep"` (allowlist tool cần, KHÔNG bypass toàn cục) + giữ `IS_SANDBOX=1`. Verified: claude -p root chạy Bash tool OK, is_error=false.

**Đã áp:** `bridge/cron_brief.sh` (daily brief) — đổi bypassPermissions→allowedTools + sửa bug bash line 14 (`|| echo 0` gây "integer expression expected", pgrep -c đã tự in 0). Brief 15/06 regen 28KB, 3 tab đủ, Telegram OK.

**BỔ SUNG 2026-06-17:** `bridge/morning_orchestrator.py` (báo cáo SÁNG 06:50, 4 stage market/vn/tech/trend) BỊ BỎ SÓT — vẫn dùng `--permission-mode bypassPermissions` (dòng ~91 `run_claude`) → MỌI báo cáo sáng nhiều ngày ra file .md **92 byte = đúng câu lỗi đó** (html vẫn 14K vì template render error). Cron CHIỀU (cron_brief/vn/trend) đã sửa nên OK, chỉ MORNING fail. ĐÃ FIX: đổi sang `--allowedTools "Bash WebSearch WebFetch Read Glob Grep"`, test claude root trả OK is_error=false, chạy lại orchestrator regen. ⚠️ Dấu hiệu nhận lỗi này: file .md ~92 byte / report "lỗi". (Phụ: cron Telegram thỉnh thoảng "TELEGRAM FAIL" = ISP VN chặn Bot API, cần proxy WARP — vấn đề DELIVERY khác content.)

**BỔ SUNG 2 (2026-06-17):** 2 HARNESS python CÒN SÓT (morning orchestrator + cron 8h/18h gọi tới): `bridge/vn_trending.py:122` + `bridge/tech_harness.py:175` vẫn `--permission-mode bypassPermissions` & KHÔNG set IS_SANDBOX → report VN trending + tech digest hằng ngày lại lỗi. ĐÃ FIX: cả 2 đổi `--allowedTools "Bash WebSearch WebFetch Read Glob Grep"` + thêm `env={**os.environ,"IS_SANDBOX":"1"}` vào subprocess.run. py_compile OK + test claude root → is_error=false "pong". ⚠️ CÒN `cron_shader_sprint.sh:50` cũng dùng bypassPermissions NHƯNG là sprint build Opus (không phải daily report) — fix khi đụng tới. Khi gặp lại "report lỗi/rỗng": grep `bypassPermissions|dangerously-skip` toàn bridge/, MỌI đường `claude -p` root phải dùng allowedTools.

**Áp cho:** mọi script gọi `claude -p` bằng root sau này. Đường SDK (auto-build.py, bridge SDK) KHÔNG dính (dùng permission_mode + IS_SANDBOX qua SDK, chạy root OK). Liên quan [[daily-brief-setup]].
