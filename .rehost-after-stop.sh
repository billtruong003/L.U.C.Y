#!/usr/bin/env bash
cd /root/lucy
LOG=/root/lucy/rehost.log
TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' bridge/.env | cut -d= -f2-)
CHAT=$(grep -E '^LUCY_ALLOWED_USER_ID=' bridge/.env | cut -d= -f2-)
tg(){ curl -s --data-urlencode "text=$1" -d chat_id="$CHAT" "https://api.telegram.org/bot$TOKEN/sendMessage" >/dev/null; }
echo "$(date '+%H:%M:%S') wait auto-build stop..." >> $LOG
# 1) chờ auto-build dừng (tối đa ~45 phút)
for i in $(seq 1 135); do
  S=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);b=[p for p in d if p['name']=='lucy-autobuild'];print(b[0]['pm2_env']['status'] if b else 'gone')")
  [ "$S" != "online" ] && { echo "$(date '+%H:%M:%S') autobuild=$S" >> $LOG; break; }
  sleep 20
done
sleep 5
# 2) tsc-gate: chắc task cuối để repo sạch
TSC_AM=$(cd agent-machine && npx tsc --noEmit 2>&1 | head -3)
TSC_HUB=$(cd hub/server && npx tsc --noEmit 2>&1 | head -3)
if [ -n "$TSC_AM$TSC_HUB" ]; then
  echo "$(date '+%H:%M:%S') TSC FAIL, skip rehost: $TSC_AM $TSC_HUB" >> $LOG
  tg "⚠️ Auto-build đã dừng nhưng task cuối để lại LỖI tsc — em KHÔNG rehost (tránh deploy code lỗi). Chờ chủ nhân về xem. Chi tiết: rehost.log"
  exit 1
fi
# 3) rehost sạch: build web + restart tất cả
echo "$(date '+%H:%M:%S') tsc OK, building web..." >> $LOG
(cd hub/web && npm run build) >> $LOG 2>&1
pm2 restart lucy-hub lucy-coordinator lucy-autopilot lucy-vps-worker >> $LOG 2>&1
pm2 restart lucy-bridge >> $LOG 2>&1
echo "$(date '+%H:%M:%S') REHOST DONE" >> $LOG
tg "✅ Đã rehost SẠCH toàn bộ (build web + restart hết, gồm bridge cho lane-tool live). Hard-refresh Hub (Ctrl+Shift+R) xem tính năng mới nhé chủ nhân 🫡"
