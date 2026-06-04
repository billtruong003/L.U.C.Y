#!/usr/bin/env bash
# Daily Market Brief — DETERMINISTIC. System cron gọi script này (không qua model điều phối).
# Crontab: 0 7 * * * /root/lucy/bridge/cron_brief.sh   (7h sáng mỗi ngày)
set -e
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
export IS_SANDBOX=1   # cho phép bypassPermissions khi chạy root

WORKDIR="${LUCY_WORKDIR:-$HOME/lucy-workspace}"; mkdir -p "$WORKDIR"
OUT="$WORKDIR/brief-$(date +%F).md"
RES="$(mktemp)"

"${CLAUDE_BIN:-claude}" -p "Làm BÁO CÁO THỊ TRƯỜNG hôm nay. Số liệu THẬT lấy từ web (ghi rõ nguồn + giờ): \
crypto (BTC/ETH + top mover), vàng (XAU + SJC nếu có), chứng khoán (VN-Index/S&P500), macro (Fed/CPI nếu có). \
Nêu xu hướng + 'khi nào nên vào' + rủi ro. Ghi FULL ra $OUT (markdown chi tiết, có mục tóm tắt dễ hiểu cho \
người non-finance). In ra stdout CHỈ đoạn tóm tắt ngắn (<=1200 ký tự). Xưng em, gọi chủ nhân. KHÔNG bịa số." \
  --permission-mode bypassPermissions --output-format json \
  --append-system-prompt-file "$HOME/lucy/bridge/persona.md" < /dev/null > "$RES" 2>/dev/null || true

SUMMARY="$(python3 -c "import json;print(json.load(open('$RES')).get('result','(brief lỗi)')[:1200])" 2>/dev/null || echo "(brief lỗi — xem $OUT)")"
API="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"
curl -s "$API/sendMessage" -d chat_id="$LUCY_ALLOWED_USER_ID" --data-urlencode "text=📊 Brief sáng ạ:
$SUMMARY" >/dev/null || true
[ -s "$OUT" ] && curl -s -F chat_id="$LUCY_ALLOWED_USER_ID" -F document=@"$OUT" "$API/sendDocument" >/dev/null || true
rm -f "$RES"
