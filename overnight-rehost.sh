#!/usr/bin/env bash
# Chờ runner đêm (UI+M2+M3) dừng (tới ~8h) → tsc-gate → build web → restart services (KHÔNG bridge) → báo Telegram.
cd /root/lucy
LOG=/root/lucy/rehost.log
TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' bridge/.env | cut -d= -f2-)
CHAT=$(grep -E '^LUCY_ALLOWED_USER_ID=' bridge/.env | cut -d= -f2-)
tg(){ curl -s --data-urlencode "text=$1" -d chat_id="$CHAT" "https://api.telegram.org/bot$TOKEN/sendMessage" >/dev/null; }
echo "$(date '+%H:%M:%S') [night] wait runner stop (≤8h)..." >> $LOG
for i in $(seq 1 480); do   # 480 × 60s = 8h
  S=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);b=[p for p in d if p['name']=='lucy-autobuild'];print(b[0]['pm2_env']['status'] if b else 'gone')")
  [ "$S" != "online" ] && { echo "$(date '+%H:%M:%S') [night] autobuild=$S" >> $LOG; break; }
  sleep 60
done
sleep 5
A=$(cd agent-machine && npx tsc --noEmit 2>&1 | head -3)
H=$(cd hub/server && npx tsc --noEmit 2>&1 | head -3)
W=$(cd hub/web && npx tsc --noEmit 2>&1 | head -3)
if [ -n "$A$H$W" ]; then
  echo "$(date '+%H:%M:%S') [night] TSC FAIL: $A $H $W" >> $LOG
  tg "⚠️ Runner đêm dừng nhưng còn LỖI tsc — em KHÔNG rehost (tránh deploy code lỗi). Sáng chủ nhân xem rehost.log + auto-build.log."
  exit 1
fi
echo "$(date '+%H:%M:%S') [night] tsc OK, build web..." >> $LOG
(cd hub/web && npm run build) >> $LOG 2>&1
pm2 restart lucy-hub lucy-coordinator lucy-autopilot lucy-vps-worker >> $LOG 2>&1
BUNDLE=$(ls -t hub/web/dist/assets/index-*.js 2>/dev/null | head -1 | xargs basename)
echo "$(date '+%H:%M:%S') [night] REHOST DONE (no bridge) bundle=$BUNDLE" >> $LOG
tg "☀️ Chào buổi sáng chủ nhân! Runner đêm (UI U2-U5 + M2 tay/MCP + M3 tự học) đã chạy xong + rehost sạch (bundle $BUNDLE, KHÔNG đụng bridge). Tóm tắt từng task em đã báo trong đêm. CẦN CHỦ NHÂN: cắm Google OAuth + GITHUB_TOKEN để bật phần 'tay' (mail/lịch/drive/github). Chi tiết: docs/MORNING-HANDOFF.md + 3 plan (ui-redesign/M2-MCP/M3-SELFLEARN)."