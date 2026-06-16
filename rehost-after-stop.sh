#!/usr/bin/env bash
# Chờ auto-build (F+K4) dừng → tsc-gate → build web → restart services (KHÔNG bridge) → báo Telegram.
cd /root/lucy
LOG=/root/lucy/rehost.log
TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' bridge/.env | cut -d= -f2-)
CHAT=$(grep -E '^LUCY_ALLOWED_USER_ID=' bridge/.env | cut -d= -f2-)
tg(){ curl -s --data-urlencode "text=$1" -d chat_id="$CHAT" "https://api.telegram.org/bot$TOKEN/sendMessage" >/dev/null; }
echo "$(date '+%H:%M:%S') wait auto-build stop..." >> $LOG
# chờ auto-build dừng (tối đa ~50 phút)
for i in $(seq 1 150); do
  S=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);b=[p for p in d if p['name']=='lucy-autobuild'];print(b[0]['pm2_env']['status'] if b else 'gone')")
  [ "$S" != "online" ] && { echo "$(date '+%H:%M:%S') autobuild=$S" >> $LOG; break; }
  sleep 20
done
sleep 5
# tsc-gate 3 package
A=$(cd agent-machine && npx tsc --noEmit 2>&1 | head -3)
H=$(cd hub/server && npx tsc --noEmit 2>&1 | head -3)
W=$(cd hub/web && npx tsc --noEmit 2>&1 | head -3)
if [ -n "$A$H$W" ]; then
  echo "$(date '+%H:%M:%S') TSC FAIL, skip rehost: $A $H $W" >> $LOG
  tg "⚠️ F+K4 xong nhưng còn LỖI tsc — em KHÔNG rehost (tránh deploy code lỗi). Chờ chủ nhân xem rehost.log."
  exit 1
fi
echo "$(date '+%H:%M:%S') tsc OK, build web..." >> $LOG
(cd hub/web && npm run build) >> $LOG 2>&1
pm2 restart lucy-hub lucy-coordinator lucy-autopilot lucy-vps-worker >> $LOG 2>&1
echo "$(date '+%H:%M:%S') REHOST DONE (no bridge)" >> $LOG
BUNDLE=$(ls -t hub/web/dist/assets/index-*.js 2>/dev/null | head -1 | xargs basename)
tg "✅ F+K4 xong + đã rehost SẠCH (build web + restart hub/coordinator/autopilot/worker, KHÔNG đụng bridge). Bundle: $BUNDLE. Hard-refresh Hub (Ctrl+Shift+R). Test mới: màn quản persona (K4). Chi tiết test: docs/TEST-GUIDE.md 🫡"
