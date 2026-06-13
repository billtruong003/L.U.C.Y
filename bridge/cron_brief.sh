#!/usr/bin/env bash
# Daily Market Brief — chạy 2 lần/ngày qua cron (sáng 7h, chiều 17h)
# Crontab:
#   0 7  * * * /root/lucy/bridge/cron_brief.sh morning
#   0 17 * * * /root/lucy/bridge/cron_brief.sh afternoon
# Host trực tiếp trên VPS: http://14.225.255.73/reports/  (lưu archive đối chiếu)
set -e
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
export IS_SANDBOX=1

# Guard: chờ claude rảnh (≤1 process) tối đa 10 phút, nếu vẫn bận thì bỏ qua (chống fail khi sprint chạy nặng)
_WAIT=0; _MAX=1800
while [ "$(pgrep -c claude 2>/dev/null || echo 0)" -gt 1 ] && [ $_WAIT -lt $_MAX ]; do
  sleep 15; _WAIT=$((_WAIT+15))
done
if [ $_WAIT -ge $_MAX ]; then
  echo "$(date '+%Y-%m-%d %H:%M') SKIP: claude busy sau ${_MAX}s — brief bỏ qua lần này"
  exit 0
fi

# --- Buổi (morning/afternoon) ---
SESSION="${1:-morning}"
case "$SESSION" in
  afternoon|chieu|pm)
    LABEL="Brief chiều"; SLUG="pm"
    SESS_NOTE="Đây là BÁO CÁO CHIỀU (chốt phiên). Nhấn mạnh DIỄN BIẾN trong phiên hôm nay so với sáng, \
biến động đáng chú ý, và định hướng cho phiên tối/đêm (US session). " ;;
  *)
    LABEL="Brief sáng"; SLUG="am"
    SESS_NOTE="Đây là BÁO CÁO SÁNG (mở ngày). Nhấn mạnh bức tranh tổng thể đầu ngày và kế hoạch theo dõi trong ngày. " ;;
esac

WORKDIR="${LUCY_WORKDIR:-$HOME/lucy-workspace}"; mkdir -p "$WORKDIR"
WEB_ROOT="/var/www/lucy-reports"
ARCHIVE="$WEB_ROOT/archive"
mkdir -p "$ARCHIVE"
PUBLIC_BASE="${LUCY_REPORTS_URL:-http://14.225.255.73/reports}"

DATE_STR="$(date +%F)"
MD_OUT="$WORKDIR/brief-$DATE_STR-$SLUG.md"
HTML_OUT="$WORKDIR/brief-$DATE_STR-$SLUG.html"
RES="$(mktemp)"
SUMM_FILE="$(mktemp)"

# 1. Gọi Claude sinh báo cáo — chi tiết, nguồn là LINK click được
"${CLAUDE_BIN:-claude}" -p --model claude-opus-4-8 \
  "Làm BÁO CÁO THỊ TRƯỜNG hôm nay, CHI TIẾT, CHUYÊN NGHIỆP, GÓC TRADER. LỌC NHIỄU MẠNH TAY — \
ưu tiên thứ thực sự tác động giá/danh mục, BỎ tin shill/PR. Số liệu THẬT từ web/API (ghi rõ nguồn + giờ lấy). \
$SESS_NOTE\
\
=== CÔNG CỤ NHANH (DÙNG TRƯỚC khi web-browse cho số crypto) === \
Chạy 'bash ~/lucy/tools/crypto.sh bitcoin ethereum solana binancecoin ripple' để lấy giá/%24h/7d/30d/mcap; \
'bash ~/lucy/tools/global.sh' để lấy total mcap + BTC dominance. \
\
=== PHÂN TẦNG === \
TẦNG 1 (LUÔN báo nếu có dữ liệu): \
- CRYPTO: BTC, ETH + 2-3 top mover 24h (giá, %24h/7d, mcap, vùng hỗ trợ/kháng cự, funding/OI nếu có). \
- VÀNG: XAU/USD + SJC + chênh lệch trong-ngoài. \
- CHỨNG KHOÁN VN: VN-Index (điểm, %, thanh khoản, khối ngoại mua/bán ròng, nhóm dẫn dắt). \
- CHỨNG KHOÁN MỸ: S&P500, Nasdaq (điểm, %, nhóm dẫn dắt). \
TẦNG 2 (CHỈ khi BOM TẤN, tác động rộng): Macro — Fed/FOMC, CPI/PCE, NFP/jobs, DXY, giá dầu, tin địa chính trị lớn, dòng tiền ETF. Bình thường gộp ngắn, đừng nhồi. \
TẦNG 3 (CHỈ khi thực sự có sóng): altcoin/cổ phiếu lẻ đáng chú ý. Không có thì BỎ. \
\
=== NGUỒN ĐỂ QUÉT (kiểm lần lượt, ghi link) === \
Crypto: [CoinGecko](https://www.coingecko.com), [CoinMarketCap](https://coinmarketcap.com), [CoinDesk](https://www.coindesk.com), [The Block](https://www.theblock.co), [Coinglass](https://www.coinglass.com) (funding/OI). \
Vàng/Macro: [Kitco](https://www.kitco.com), [Investing.com](https://www.investing.com), [TradingEconomics](https://tradingeconomics.com), [Reuters Markets](https://www.reuters.com/markets/). \
Chứng khoán VN: [CafeF](https://cafef.vn), [Vietstock](https://vietstock.vn), [FireAnt](https://fireant.vn). \
Chứng khoán Mỹ: [Investing.com](https://www.investing.com), [Yahoo Finance](https://finance.yahoo.com), [Finviz](https://finviz.com), [CNBC](https://www.cnbc.com). \
\
=== QUY TẮC === \
- Mỗi tài sản nêu: xu hướng + mức kháng cự/hỗ trợ gần + 'KHI NÀO NÊN VÀO' (điều kiện cụ thể) + RỦI RO. \
- Mỗi mục kèm LÝ DO 'tại sao đáng chú ý', không chỉ con số. \
- Nếu một mảng hôm nay KHÔNG có gì nổi bật → nói thẳng, ĐỪNG cố nhồi. \
\
=== ĐỊNH DẠNG FILE (markdown, cho web) === \
- Mở đầu mục '### 🔥 TOP 3 (chú ý nhất hôm nay)' — 3 thứ tác động danh mục nhất. \
- Heading ### cho từng mảng; **bảng markdown** cho số liệu so sánh; **đậm** cho số quan trọng; nguồn = link markdown. \
- Mục '### 🗓️ Radar sự kiện': lịch Fed/CPI/NFP/earnings lớn + đáo hạn phái sinh VN sắp tới (ghi còn bao lâu). \
- Mục cuối '### 🎯 Góc nhìn Lucy': nhận định tổng + 1-2 kèo + cảnh báo rủi ro. \
- Ghi FULL ra file $MD_OUT. \
\
=== OUTPUT === \
In TOÀN BỘ báo cáo (đầy đủ, đúng format file ở trên, có dùng bảng markdown cho số liệu) ra stdout làm CÂU TRẢ LỜI CHÍNH. \
KHÔNG cần tự ghi file — script sẽ tự lưu và tự rút gọn bản Telegram. \
Xưng em, gọi chủ nhân. TUYỆT ĐỐI KHÔNG bịa số — không lấy được thì ghi 'chưa lấy được'." \
  --permission-mode bypassPermissions \
  --output-format json \
  --append-system-prompt-file "${LUCY_PERSONA:-$HOME/lucy/bridge/persona.md}" \
  < /dev/null > "$RES" 2>/dev/null || true

# 2. Tách full report (ghi MD) + bản gọn Telegram (bỏ bảng) — KHÔNG phụ thuộc model tự ghi file
python3 -c "
import json, re
d = json.load(open('$RES'))
full = (d.get('result') or '').strip()
if not full:
    full = '(brief lỗi — không lấy được nội dung)'
open('$MD_OUT','w', encoding='utf-8').write(full)
# bản Telegram: bỏ dòng bảng markdown (| ... |) cho khỏi vỡ layout
tg = '\n'.join(l for l in full.split('\n') if not re.match(r'^\s*\|', l))
print(tg[:3000])
" 2>/dev/null > "$SUMM_FILE" || { echo "(brief lỗi)" > "$SUMM_FILE"; echo "(brief lỗi)" > "$MD_OUT"; }

SUMMARY="$(cat "$SUMM_FILE")"

# 3. Convert MD → HTML (Node + marked)
if [ -s "$MD_OUT" ]; then
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" report \
    "$MD_OUT" "$SUMM_FILE" "$HTML_OUT" "$DATE_STR" 2>/dev/null || true
fi

# 4. Host trên VPS: copy vào archive + regenerate index
PUBLIC_URL=""
if [ -s "$HTML_OUT" ]; then
  cp "$HTML_OUT" "$ARCHIVE/brief-$DATE_STR-$SLUG.html"
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" index 2>/dev/null || true
  PUBLIC_URL="$PUBLIC_BASE/archive/brief-$DATE_STR-$SLUG.html"
fi

# 5. Gửi Telegram
API="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"

if [ -n "$PUBLIC_URL" ]; then
  MSG="📊 *$LABEL* — $DATE_STR

$SUMMARY

🌐 Đọc đầy đủ: $PUBLIC_URL
📚 Tất cả báo cáo: $PUBLIC_BASE/"
else
  MSG="📊 *$LABEL* — $DATE_STR

$SUMMARY

⚠️ Tạo HTML thất bại — xem file: $MD_OUT"
fi

TG_RES=$(curl -s "$API/sendMessage" \
  -d chat_id="$LUCY_ALLOWED_USER_ID" \
  -d parse_mode="Markdown" \
  --data-urlencode "text=$MSG")
echo "$TG_RES" | python3 -c "import sys,json; d=json.load(sys.stdin); print('TELEGRAM', 'OK' if d.get('ok') else 'FAIL: '+d.get('description','?'))" 2>/dev/null || echo "TELEGRAM CURL_FAIL"

# 6. Post sang Discord qua Aki (radiant-bot) — summary + link cho anh em xem
if [ -n "$RADIANT_BOT_AGENT_SECRET" ] && [ -n "$LUCY_BRIEF_DISCORD_CHANNEL" ]; then
  AKI_URL="${RADIANT_BOT_API_URL:-http://127.0.0.1:3030}"
  if [ -n "$PUBLIC_URL" ]; then
    DISCORD_TEXT="📊 **$LABEL** — $DATE_STR

$SUMMARY

🌐 Đọc đầy đủ: $PUBLIC_URL
📚 Tất cả báo cáo: $PUBLIC_BASE/"
  else
    DISCORD_TEXT="📊 **$LABEL** — $DATE_STR

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
