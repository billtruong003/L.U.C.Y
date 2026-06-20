#!/usr/bin/env bash
# Watcher độc lập: poll workflow deep-research FitCity, khi XONG (idle) → nhắn Telegram. Tự thoát.
cd /root/lucy/bridge; set -a; [ -f .env ] && . ./.env; set +a
WF="/root/.claude/projects/-root-lucy-workspace/0ded98c3-60c8-4e72-a49d-0ebcaeafa57e/subagents/workflows/wf_53647717-bad"
API="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"
send(){ curl -s "$API/sendMessage" -d chat_id="$LUCY_ALLOWED_USER_ID" --data-urlencode text="$1" >/dev/null 2>&1; }
for i in $(seq 1 60); do   # tối đa ~60 phút
  sleep 60
  newest=$(ls -t "$WF"/*.jsonl 2>/dev/null | head -1)
  [ -z "$newest" ] && continue
  idle=$(( $(date +%s) - $(stat -c %Y "$newest" 2>/dev/null || echo 0) ))
  nres=$(grep -c '"type":"result"' "$WF/journal.jsonl" 2>/dev/null || echo 0)
  if [ "$idle" -gt 180 ] && [ "$nres" -ge 5 ]; then
    send "🔬 Deep research FitCity XONG (data đủ — $nres kết quả). Lucy đang tổng hợp task plan + sprint, lát có trang progress nhé chủ nhân 🦊"
    exit 0
  fi
done
send "⏳ Deep research FitCity chạy hơi lâu (watcher hết giờ canh). Lucy vẫn theo dõi + tổng hợp."
