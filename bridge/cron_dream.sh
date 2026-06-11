#!/usr/bin/env bash
# Dream đêm — "gộp đêm" trí nhớ Lucy: Brain/inbox signal → preference → active.md (+ dọn inbox quá hạn).
# THUẦN DETERMINISTIC, 0 token. Chạy xong reindex để recall thấy note mới trong ngày.
# Cron 2h sáng VN:
#   0 2 * * * /root/lucy/bridge/cron_dream.sh >> /root/lucy-workspace/dream-cron.log 2>&1
set -e
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
export PATH="$PATH:/usr/local/bin:/usr/bin"

VAULT="${LUCY_VAULT:-$HOME/lucy/lucy-vault}"
AM_DIR="$(cd .. && pwd)/agent-machine"
DATE_STR="$(date +%F)"

echo "== dream $DATE_STR $(date +%T) =="
OUT_ERR=""
OUT="$(cd "$AM_DIR" && LUCY_VAULT="$VAULT" npm run --silent dream 2>&1)" || OUT_ERR=1
echo "$OUT"

# reindex incremental (mtime+checksum — rẻ) → recall + tab Bộ não thấy mọi note ghi trong ngày
(cd "$AM_DIR" && LUCY_VAULT="$VAULT" npm run --silent reindex 2>&1) || true

# Báo Telegram CHỈ khi não có thay đổi (no-op → im lặng, đừng spam chủ nhân mỗi sáng)
if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${LUCY_ALLOWED_USER_ID:-}" ]; then
  MSG=""
  if [ -n "$OUT_ERR" ]; then
    MSG="⚠️ Dream đêm $DATE_STR lỗi — chủ nhân xem log: dream-cron.log
$(echo "$OUT" | head -c 600)"
  elif ! echo "$OUT" | grep -q "không có gì mới"; then
    MSG="🌙 Dream đêm $DATE_STR — em vừa gộp trí nhớ:
$(echo "$OUT" | head -c 2800)
Xem tab Bộ não / Tinh hà để thấy hành tinh mới ạ."
  fi
  if [ -n "$MSG" ]; then
    curl -s "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
      -d chat_id="$LUCY_ALLOWED_USER_ID" \
      --data-urlencode "text=$MSG" >/dev/null || true
  fi
fi
