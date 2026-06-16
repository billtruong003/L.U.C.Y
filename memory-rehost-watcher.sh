#!/usr/bin/env bash
# Chờ auto-build (memory Phase 0-1-2) dừng → tsc-gate → build web → restart TẤT CẢ (gồm bridge để kích Phase 0 prefetch) → báo Telegram.
cd /root/lucy
LOG=/root/lucy/rehost.log
TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' bridge/.env | cut -d= -f2-)
CHAT=$(grep -E '^LUCY_ALLOWED_USER_ID=' bridge/.env | cut -d= -f2-)
tg(){ curl -s --data-urlencode "text=$1" -d chat_id="$CHAT" "https://api.telegram.org/bot$TOKEN/sendMessage" >/dev/null; }
echo "$(date '+%H:%M:%S') [mem] wait auto-build stop..." >> $LOG
for i in $(seq 1 180); do
  S=$(pm2 jlist 2>/dev/null | python3 -c "import sys,json;d=json.load(sys.stdin);b=[p for p in d if p['name']=='lucy-autobuild'];print(b[0]['pm2_env']['status'] if b else 'gone')")
  [ "$S" != "online" ] && { echo "$(date '+%H:%M:%S') [mem] autobuild=$S" >> $LOG; break; }
  sleep 20
done
sleep 5
A=$(cd agent-machine && npx tsc --noEmit 2>&1 | head -3)
H=$(cd hub/server && npx tsc --noEmit 2>&1 | head -3)
W=$(cd hub/web && npx tsc --noEmit 2>&1 | head -3)
if [ -n "$A$H$W" ]; then
  echo "$(date '+%H:%M:%S') [mem] TSC FAIL: $A $H $W" >> $LOG
  tg "⚠️ Memory build (Phase 0-1-2) dừng nhưng còn LỖI tsc — em KHÔNG rehost. Chờ chủ nhân xem rehost.log."
  exit 1
fi
echo "$(date '+%H:%M:%S') [mem] tsc OK, build web..." >> $LOG
(cd hub/web && npm run build) >> $LOG 2>&1
pm2 restart lucy-hub lucy-coordinator lucy-autopilot lucy-vps-worker >> $LOG 2>&1
pm2 restart lucy-bridge >> $LOG 2>&1   # CẦN: kích Phase 0 prefetch trên đường Telegram
echo "$(date '+%H:%M:%S') [mem] REHOST DONE (incl bridge)" >> $LOG
tg "🧠 Memory Phase 0-1-2 xong + đã rehost (gồm restart bridge để kích prefetch trí nhớ). Giờ chat Telegram/Hub sẽ tự nhớ xuyên phiên. Phase 3-4 (xoá/forgetting memory) chờ chủ nhân duyệt. Em sẽ tóm tắt khi chủ nhân quay lại."