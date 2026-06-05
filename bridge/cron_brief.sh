#!/usr/bin/env bash
# Daily Market Brief — chạy lúc 7h sáng qua cron
# Crontab: 0 7 * * * /root/lucy/bridge/cron_brief.sh
# Host trực tiếp trên VPS: http://14.225.255.73/reports/  (lưu archive đối chiếu)
set -e
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
export IS_SANDBOX=1

WORKDIR="${LUCY_WORKDIR:-$HOME/lucy-workspace}"; mkdir -p "$WORKDIR"
WEB_ROOT="/var/www/lucy-reports"
ARCHIVE="$WEB_ROOT/archive"
mkdir -p "$ARCHIVE"
PUBLIC_BASE="${LUCY_REPORTS_URL:-http://14.225.255.73/reports}"

DATE_STR="$(date +%F)"
MD_OUT="$WORKDIR/brief-$DATE_STR.md"
HTML_OUT="$WORKDIR/brief-$DATE_STR.html"
RES="$(mktemp)"
SUMM_FILE="$(mktemp)"

# 1. Gọi Claude sinh báo cáo — chi tiết, nguồn là LINK click được
"${CLAUDE_BIN:-claude}" -p \
  "Làm BÁO CÁO THỊ TRƯỜNG hôm nay, CHI TIẾT và CHUYÊN NGHIỆP. Số liệu THẬT lấy từ web/API (ghi rõ nguồn + giờ lấy). \
Bao gồm các mảng: \
(1) CRYPTO: BTC, ETH, + 2-3 top mover 24h (giá, %24h/7d, market cap, vùng hỗ trợ/kháng cự). \
(2) VÀNG: XAU/USD + SJC + chênh lệch trong-ngoài nếu có. \
(3) CHỨNG KHOÁN: VN-Index, S&P500, Nasdaq (điểm, %, thanh khoản, nhóm dẫn dắt). \
(4) MACRO: Fed/lãi suất, CPI/jobs, DXY, tin lớn ảnh hưởng. \
Với MỖI tài sản nêu rõ: xu hướng hiện tại, mức kháng cự/hỗ trợ gần, 'KHI NÀO NÊN VÀO' (điều kiện cụ thể), và RỦI RO. \
QUAN TRỌNG về định dạng markdown: \
- Mọi NGUỒN phải viết dạng link markdown click được, vd [CoinGecko](https://www.coingecko.com), [Kitco](https://www.kitco.com), [Investing.com](https://www.investing.com). \
- Dùng heading ### cho từng mảng, dùng **bảng markdown** cho số liệu so sánh, dùng **đậm** cho số quan trọng. \
- Có mục '### 🎯 Góc nhìn Lucy' cuối cùng: nhận định tổng + 1-2 kèo đáng chú ý + cảnh báo rủi ro. \
Ghi FULL ra file $MD_OUT (markdown chi tiết, đầy đủ). \
In ra stdout CHỈ đoạn tóm tắt executive-summary (<=1200 ký tự, bullet '•' ngắn gọn cho Telegram). \
Xưng em, gọi chủ nhân. TUYỆT ĐỐI KHÔNG bịa số — không lấy được thì ghi 'chưa lấy được'." \
  --permission-mode bypassPermissions \
  --output-format json \
  --append-system-prompt-file "${LUCY_PERSONA:-$HOME/lucy/bridge/persona.md}" \
  < /dev/null > "$RES" 2>/dev/null || true

# 2. Lấy summary text
python3 -c "
import json
data = json.load(open('$RES'))
print(data.get('result','(brief lỗi — không lấy được summary)')[:1200])
" 2>/dev/null > "$SUMM_FILE" || echo "(brief lỗi)" > "$SUMM_FILE"

SUMMARY="$(cat "$SUMM_FILE")"

# 3. Convert MD → HTML (Node + marked)
if [ -s "$MD_OUT" ]; then
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" report \
    "$MD_OUT" "$SUMM_FILE" "$HTML_OUT" "$DATE_STR" 2>/dev/null || true
fi

# 4. Host trên VPS: copy vào archive + regenerate index
PUBLIC_URL=""
if [ -s "$HTML_OUT" ]; then
  cp "$HTML_OUT" "$ARCHIVE/brief-$DATE_STR.html"
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" index 2>/dev/null || true
  PUBLIC_URL="$PUBLIC_BASE/archive/brief-$DATE_STR.html"
fi

# 5. Gửi Telegram
API="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"

if [ -n "$PUBLIC_URL" ]; then
  MSG="📊 *Brief sáng* — $DATE_STR

$SUMMARY

🌐 Đọc đầy đủ: $PUBLIC_URL
📚 Tất cả báo cáo: $PUBLIC_BASE/"
else
  MSG="📊 *Brief sáng* — $DATE_STR

$SUMMARY

⚠️ Tạo HTML thất bại — xem file: $MD_OUT"
fi

curl -s "$API/sendMessage" \
  -d chat_id="$LUCY_ALLOWED_USER_ID" \
  -d parse_mode="Markdown" \
  --data-urlencode "text=$MSG" \
  >/dev/null || true

# 6. Post sang Discord qua Aki (radiant-bot) — summary + link cho anh em xem
if [ -n "$RADIANT_BOT_AGENT_SECRET" ] && [ -n "$LUCY_BRIEF_DISCORD_CHANNEL" ]; then
  AKI_URL="${RADIANT_BOT_API_URL:-http://127.0.0.1:3030}"
  if [ -n "$PUBLIC_URL" ]; then
    DISCORD_TEXT="📊 **Brief sáng** — $DATE_STR

$SUMMARY

🌐 Đọc đầy đủ: $PUBLIC_URL
📚 Tất cả báo cáo: $PUBLIC_BASE/"
  else
    DISCORD_TEXT="📊 **Brief sáng** — $DATE_STR

$SUMMARY"
  fi
  AKI_BODY="$(mktemp)"
  CH="$LUCY_BRIEF_DISCORD_CHANNEL" TXT="$DISCORD_TEXT" python3 -c "
import json, os
print(json.dumps({'channel': os.environ['CH'], 'text': os.environ['TXT']}, ensure_ascii=False))
" > "$AKI_BODY" 2>/dev/null
  SIG="sha256=$(openssl dgst -sha256 -hmac "$RADIANT_BOT_AGENT_SECRET" -r "$AKI_BODY" | awk '{print $1}')"
  curl -s -m 20 -X POST "$AKI_URL/api/agent/post" \
    -H 'content-type: application/json' \
    -H "x-lucy-signature: $SIG" \
    --data-binary @"$AKI_BODY" >/dev/null || true
  rm -f "$AKI_BODY"
fi

# Cleanup tmp files
rm -f "$RES" "$SUMM_FILE"
