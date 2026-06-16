#!/usr/bin/env bash
# Chuỗi tuần tự (tránh tranh claude): cron_tech → cron_vn → S5 auto-build → arm watcher.
cd /root/lucy/bridge
echo "$(date '+%Y-%m-%d %H:%M') [chain] cron_tech regen ===" >> /root/lucy/cron-tech.log
bash cron_tech.sh >> /root/lucy/cron-tech.log 2>&1
echo "$(date '+%Y-%m-%d %H:%M') [chain] cron_vn morning regen ===" >> /root/lucy/cron-vn.log
bash cron_vn.sh morning >> /root/lucy/cron-vn.log 2>&1

# S5 — UI perf hardening + a11y QA
cd /root/lucy
rm -f .autobuild-stop
export AUTOBUILD_MODEL="opus"
export AUTOBUILD_MAX_ITERS="2"
export AUTOBUILD_FOCUS="BỎ QUA MASTER-SPEC. TIẾP TỤC UI REFACTOR theo /root/lucy/docs/UI-REFACTOR-SPRINTS.md. S1-S4 ĐÃ XONG (✅). Làm SPRINT CUỐI S5 — Perf hardening + a11y QA (R1 Phase 4): E4.1 giảm tải render (cap pixelRatio=2, giảm số lớp backdrop-blur, render-on-demand), E4.2 timeline galaxy kéo KHÔNG lag + touch ok + 2D fallback non-WebGL cho galaxy (defer từ S3), E4.3 a11y pass (keyboard nav, focus ring, aria nút icon, contrast đa điều kiện, honor reduced-motion/transparency). LUẬT CỨNG: tsc 3 pkg + build web SẠCH mới DONE; deploy hub; KHÔNG restart lucy-bridge; KHÔNG git push/xoá data; flag-gated nếu rủi ro; cập nhật ✅ doc. Xong → AUTOBUILD: ALL_DONE — UI refactor S1-S5 hoàn tất."
pm2 delete lucy-autobuild >/dev/null 2>&1
pm2 start /root/lucy/autobuild-wrapper.sh --name lucy-autobuild --interpreter none --no-autorestart >> /root/lucy/auto-build-cron.log 2>&1

# arm watcher (rehost khi S5 xong)
nohup /root/lucy/overnight-rehost.sh >/dev/null 2>&1 &
echo "$(date '+%Y-%m-%d %H:%M') [chain] DONE crons + S5 launched" >> /root/lucy/cron-tech.log
