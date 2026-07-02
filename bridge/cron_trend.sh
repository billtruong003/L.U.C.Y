#!/usr/bin/env bash
# Radar Trending VN — quét xu hướng VN mỗi sáng để FEED nội dung (idea #3 kênh tin)
# + bắt TÍN HIỆU NHU CẦU (idea #4 AI tools/service). Khác cron_vn.sh (tin kinh tế/CK).
# Crontab:
#   0 8 * * * /root/lucy/bridge/cron_trend.sh >> /root/lucy/cron-trend.log 2>&1
set -e
cd "$(dirname "$0")"
set -a; [ -f .env ] && . ./.env; set +a
export IS_SANDBOX=1

# Guard: chờ claude rảnh (≤1 process) tối đa 30 phút
_WAIT=0; _MAX=1800
while [ "$(pgrep -c claude 2>/dev/null)" -gt 1 ] && [ $_WAIT -lt $_MAX ]; do
  sleep 15; _WAIT=$((_WAIT+15))
done
if [ $_WAIT -ge $_MAX ]; then
  echo "$(date '+%Y-%m-%d %H:%M') SKIP: claude busy sau ${_MAX}s — trend radar bỏ qua lần này"
  exit 0
fi

LABEL="Radar Trending VN"; SLUG="trend"

WORKDIR="${LUCY_WORKDIR:-$HOME/lucy-workspace}"; mkdir -p "$WORKDIR"
WEB_ROOT="/var/www/lucy-reports"
ARCHIVE="$WEB_ROOT/archive"
mkdir -p "$ARCHIVE"
PUBLIC_BASE="${LUCY_REPORTS_URL:-http://14.225.255.73/reports}"

DATE_STR="$(date +%F)"
MD_OUT="$WORKDIR/trend-$DATE_STR.md"
HTML_OUT="$WORKDIR/trend-$DATE_STR.html"
RES="$(mktemp)"
SUMM_FILE="$(mktemp)"

# 1. Gọi Claude sinh báo cáo trending
"${CLAUDE_BIN:-claude}" -p --model claude-sonnet-4-6 \
  "Làm BÁO CÁO RADAR TRENDING VIỆT NAM trong 24h qua. Mục tiêu KÉP: \
(A) FEED nội dung cho kênh tin/blog (biết VIẾT GÌ để ăn traffic), \
(B) bắt TÍN HIỆU NHU CẦU để làm AI tool/service (biết LÀM GÌ người ta đang cần trả tiền). \
LỌC NHIỄU MẠNH TAY — bỏ tin rác/giật tít/PR. Số liệu + chủ đề THẬT từ web (ghi rõ nguồn + giờ lấy). \
Tiếng Việt, gọn, đọc hết 3-5 phút. TUYỆT ĐỐI KHÔNG bịa — không lấy được thì ghi 'chưa lấy được'. \
\
=== PHÂN TẦNG ƯU TIÊN === \
TẦNG 1 (LUÔN BÁO) = Tech/AI/Dev/Lập trình đang hot ở VN + global (hợp chủ nhân: game dev, AI tooling, graphics). \
TẦNG 2 (CHỈ KHI BÙNG TO) = trend xã hội/giải trí/viral VN — chỉ nêu nếu đủ lớn để tạo SÓNG TRAFFIC đáng cưỡi. \
\
=== CẤU TRÚC === \
🔥 TOP TRENDING VN HÔM NAY (3-7 chủ đề) \
- Mỗi chủ đề: 1 dòng nó là gì + 'TẠI SAO HOT' + 'GÓC KHAI THÁC' (viết bài/post gì để ăn traffic) + link nguồn. \
\
🤖 TÍN HIỆU NHU CẦU (cho AI tool/service — idea #4) \
- Người VN/dev đang TÌM/PHÀN NÀN/CẦN gì (pain point lặp lại) → gợi ý 1-3 tool/service đáng làm. \
- Ưu tiên thứ hợp sở trường: visual/graphics/asset/video AI, automation, tool cho dev. \
\
💻 DEV/AI RADAR (global, ngắn) \
- Repo/tool/model/tin AI mới nổi đáng để ý (GitHub Trending, Hacker News, Product Hunt). \
- Mỗi cái 1 dòng 'tại sao đáng để ý'. \
\
📈 GÓC NỘI DUNG ĐỀ XUẤT (chốt hành động) \
- 3 ý tưởng bài/post/video NÊN làm hôm nay dựa trên trending trên, xếp theo độ dễ-ăn-traffic. \
\
=== NGUỒN (quét lần lượt, ghi link) === \
Google Trends VN: https://trends.google.com/trending?geo=VN \
YouTube Trending VN: https://www.youtube.com/feed/trending?gl=VN \
TikTok Creative Center (hashtag VN): https://ads.tiktok.com/business/creativecenter/inspiration/popular/hashtag/pc/en?region=VN \
Tinh tế: https://tinhte.vn  ·  GenK: https://genk.vn  ·  Kenh14 (viral trẻ): https://kenh14.vn \
VnExpress Số hoá: https://vnexpress.net/so-hoa  ·  VnExpress: https://vnexpress.net \
GitHub Trending: https://github.com/trending  ·  Hacker News: https://news.ycombinator.com \
Product Hunt: https://www.producthunt.com  ·  Reddit r/VietNam: https://www.reddit.com/r/VietNam/top/ \
X/Twitter trends VN: tìm 'trending Vietnam today' \
\
=== QUY TẮC === \
- Mỗi mục KÈM link nguồn + 'tại sao đáng chú ý/khai thác'. \
- Nếu hôm đó không có gì đáng kể ở 1 mục → nói thẳng, ĐỪNG nhồi. \
- Link dạng markdown [Tên](URL). \
\
=== VIẾT NHƯ NGƯỜI, KHÔNG GIỌNG AI === \
- Phân tích phải CỤ THỂ: nêu cái gì hot + lý do nhân-quả thật, đừng gắn đuôi rỗng 'góp phần/thể hiện/phản ánh/qua đó tạo nên'. \
- Cấm sáo rỗng: vô cùng, đa dạng và phong phú, ấn tượng, bùng nổ, gây sốt, không thể bỏ qua, trong bối cảnh, bức tranh tổng thể. \
- Cấm bộ ba nhồi cho đủ và cấm 'không chỉ... mà còn...'. Cắt danh từ hóa thừa (sự/việc/tính/một cách) khi câu vẫn rõ. \
- Cấm gạch ngang dài (— và –) trong văn; thay bằng dấu phẩy, chấm hoặc ngoặc. Đừng rào đón 'có lẽ phần nào có thể'. \
- Câu dài ngắn xen kẽ. In đậm CHỈ cho số/từ khóa quan trọng, đừng bôi tràn lan. Emoji chỉ ở header mục, đừng rải trong câu. \
\
=== ĐỊNH DẠNG === \
- Emoji header như cấu trúc trên. **đậm** cho chủ đề/số quan trọng. \
- KHÔNG dùng bảng markdown (để hiển thị tốt). \
- In TOÀN BỘ báo cáo ra stdout." \
  --allowedTools "Bash WebSearch WebFetch Read Glob Grep" \
  --output-format json \
  --append-system-prompt-file "${LUCY_PERSONA:-$HOME/lucy/bridge/persona.md}" \
  < /dev/null > "$RES" 2>/dev/null || true

# B1: cộng token vòng claude -p vào token-guard CHUNG (fire-and-forget, không gãy cron)
python3 "$(dirname "$0")/report_tok.py" "$RES" "trend" sonnet 2>/dev/null || true

# 2. Tách full report + bản gọn Telegram
python3 -c "
import json, re
d = json.load(open('$RES'))
full = (d.get('result') or '').strip()
if not full:
    full = '(trend radar lỗi — không lấy được nội dung)'
open('$MD_OUT','w', encoding='utf-8').write(full)
tg = '\n'.join(l for l in full.split('\n') if not re.match(r'^\s*\|', l))
print(tg[:3000])
" 2>/dev/null > "$SUMM_FILE" || { echo "(trend radar lỗi)" > "$SUMM_FILE"; echo "(trend radar lỗi)" > "$MD_OUT"; }

SUMMARY="$(cat "$SUMM_FILE")"

# 3. Convert MD → HTML
if [ -s "$MD_OUT" ]; then
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" report \
    "$MD_OUT" "$SUMM_FILE" "$HTML_OUT" "$DATE_STR" 2>/dev/null || true
fi

# 4. Host trên VPS
PUBLIC_URL=""
if [ -s "$HTML_OUT" ]; then
  cp "$HTML_OUT" "$ARCHIVE/trend-$DATE_STR.html"
  LUCY_WEB_ROOT="$WEB_ROOT" node "$(dirname "$0")/gen_brief.mjs" index 2>/dev/null || true
  PUBLIC_URL="$PUBLIC_BASE/archive/trend-$DATE_STR.html"
fi

# 5. Gửi Telegram
API="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN"
if [ -n "$PUBLIC_URL" ]; then
  MSG="🔥 *$LABEL* — $DATE_STR

$SUMMARY

🌐 Đọc đầy đủ: $PUBLIC_URL
📚 Tất cả báo cáo: $PUBLIC_BASE/"
else
  MSG="🔥 *$LABEL* — $DATE_STR

$SUMMARY

⚠️ Tạo HTML thất bại — xem file: $MD_OUT"
fi

source "$(dirname "$0")/lib/tg_send.sh"
tg_send "$API" "$LUCY_ALLOWED_USER_ID" "$MSG" || true

echo "done [trend $DATE_STR]."
